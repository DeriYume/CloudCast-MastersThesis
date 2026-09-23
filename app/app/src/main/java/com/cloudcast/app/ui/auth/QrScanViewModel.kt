package com.cloudcast.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.SignInCode
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.crypto.wipe
import com.cloudcast.app.data.repository.AuthRepository
import com.cloudcast.app.data.repository.QrRedeemResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.net.URLDecoder

data class QrScanUiState(

    val manualEntry: Boolean = false,
    val typedCode: String = "",

    val claiming: Boolean = false,

    val waiting: Boolean = false,
    val error: String? = null,
    val signedIn: Boolean = false,
)

class QrScanViewModel(private val repo: AuthRepository) : ViewModel() {

    private val _state = MutableStateFlow(QrScanUiState())
    val state: StateFlow<QrScanUiState> = _state.asStateFlow()

    @Volatile
    private var handling = false

    private var job: Job? = null

    fun showManualEntry(show: Boolean) = _state.update {
        it.copy(manualEntry = show, error = null)
    }

    fun onTypedCodeChange(value: String) = _state.update {
        it.copy(typedCode = SignInCode.formatAsTyped(value), error = null)
    }

    fun typedCodeComplete(): Boolean =
        SignInCode.isComplete(SignInCode.normalize(_state.value.typedCode).orEmpty())

    fun onCodeScanned(raw: String) {
        if (busy()) return
        val code = normalise(raw) ?: return
        submit(code)
    }

    fun submitTypedCode() {
        if (busy()) return
        val code = normalise(_state.value.typedCode)
        if (code == null) {
            _state.update { it.copy(error = "Enter the code shown on your signed-in device.") }
            return
        }
        submit(code)
    }

    fun dismissError() {
        handling = false
        _state.update { it.copy(error = null) }
    }

    private fun busy(): Boolean =
        handling || _state.value.claiming || _state.value.waiting || _state.value.signedIn

    private fun submit(code: String) {
        handling = true
        job?.cancel()
        _state.update { it.copy(claiming = true, error = null) }
        job = viewModelScope.launch {
            val transfer = try {
                repo.registerQrTransfer(code)
            } catch (e: CancellationException) {

                throw e
            } catch (e: Exception) {

                fail(friendlyError(e, "Couldn't use that code."))
                return@launch
            }
            _state.update { it.copy(claiming = false, waiting = true) }
            try {
                while (currentCoroutineContext().isActive) {
                    delay(POLL_MS)
                    val result = try {
                        repo.pollQrRedeem(code, transfer)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {

                        continue
                    }
                    when (result) {
                        QrRedeemResult.Success -> {
                            _state.update { it.copy(waiting = false, signedIn = true) }
                            return@launch
                        }
                        is QrRedeemResult.NotReady -> {

                            if (result.status == "pending") continue
                            fail(messageFor(result.status))
                            return@launch
                        }
                        is QrRedeemResult.Failed -> {

                            fail(
                                friendlyError(
                                    result.cause,
                                    "The sign-in completed but the keys couldn't be opened. " +
                                        "Start again with a new code.",
                                ),
                            )
                            return@launch
                        }
                    }
                }
            } finally {

                transfer.privateKey.wipe()
            }
        }
    }

    private fun fail(message: String) {
        handling = false
        _state.update { it.copy(claiming = false, waiting = false, error = message) }
    }

    private fun normalise(raw: String): String? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null
        val code = if (trimmed.startsWith(QR_PREFIX)) {
            runCatching { URLDecoder.decode(trimmed.substring(QR_PREFIX.length), "UTF-8") }.getOrNull()
        } else {
            trimmed
        } ?: return null
        return SignInCode.normalize(code)
    }

    private fun messageFor(status: String): String = when (status) {
        "expired" -> "That code expired - grab the current one from your signed-in device."
        "consumed" -> "That code was already used. Generate a new one."
        else -> "That code is no longer valid. Generate a fresh one on the other device."
    }

    companion object {

        const val QR_PREFIX = "cloudcast://qrlogin?code="

        private const val POLL_MS = 3_000L
    }
}

class QrScanViewModelFactory(private val repo: AuthRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = QrScanViewModel(repo) as T
}
