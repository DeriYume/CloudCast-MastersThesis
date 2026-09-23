package com.cloudcast.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.data.repository.AuthRepository
import com.cloudcast.app.data.repository.QrOffer
import com.cloudcast.app.data.repository.QrPendingState
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

sealed interface QrIssuePhase {

    data object Loading : QrIssuePhase

    data class Showing(val code: String, val secondsRemaining: Int) : QrIssuePhase

    data class Confirm(val code: String, val transferPkB64: String) : QrIssuePhase

    data object Approving : QrIssuePhase

    data object Done : QrIssuePhase

    data class Error(val message: String) : QrIssuePhase
}

data class QrIssueUiState(val phase: QrIssuePhase = QrIssuePhase.Loading)

class QrIssueViewModel(private val repo: AuthRepository) : ViewModel() {

    private val _state = MutableStateFlow(QrIssueUiState())
    val state: StateFlow<QrIssueUiState> = _state.asStateFlow()

    private var job: Job? = null

    fun begin() {
        job?.cancel()
        _state.value = QrIssueUiState(QrIssuePhase.Loading)
        job = viewModelScope.launch {
            while (currentCoroutineContext().isActive) {
                val offer = try {
                    repo.offerQrCode()
                } catch (e: CancellationException) {

                    throw e
                } catch (e: Exception) {
                    fail(friendlyError(e, "Couldn't create a sign-in code."))
                    return@launch
                }

                if (!runOffer(offer)) return@launch
            }
        }
    }

    private suspend fun runOffer(offer: QrOffer): Boolean {
        var ticksSincePoll = 0
        while (currentCoroutineContext().isActive) {
            val remainingMs = offer.expiresAtMillis - System.currentTimeMillis()
            if (remainingMs <= 0) return true
            _state.update {
                it.copy(
                    phase = QrIssuePhase.Showing(
                        code = offer.code,

                        secondsRemaining = ((remainingMs + 999) / 1000).toInt(),
                    ),
                )
            }
            delay(TICK_MS)

            if (++ticksSincePoll < POLL_TICKS) continue
            ticksSincePoll = 0
            val pending = try {
                repo.qrPending(offer.code)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {

                continue
            }
            when (pending) {
                is QrPendingState.Registered -> {
                    _state.update {
                        it.copy(phase = QrIssuePhase.Confirm(offer.code, pending.transferPkB64))
                    }
                    return false
                }
                QrPendingState.Waiting -> Unit
                is QrPendingState.Stale -> return true
            }
        }
        return false
    }

    fun approve() {
        val phase = _state.value.phase
        if (phase !is QrIssuePhase.Confirm) return
        job?.cancel()
        _state.update { it.copy(phase = QrIssuePhase.Approving) }
        job = viewModelScope.launch {
            try {
                repo.approveLogin(phase.code, phase.transferPkB64)
                _state.update { it.copy(phase = QrIssuePhase.Done) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                fail(friendlyError(e, "Couldn't approve that device."))
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private fun fail(message: String) = _state.update { it.copy(phase = QrIssuePhase.Error(message)) }

    private companion object {
        const val TICK_MS = 1_000L

        const val POLL_TICKS = 3
    }
}

class QrIssueViewModelFactory(private val repo: AuthRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = QrIssueViewModel(repo) as T
}
