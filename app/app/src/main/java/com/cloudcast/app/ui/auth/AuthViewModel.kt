package com.cloudcast.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.emailIsValid
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.core.passwordIsValid
import com.cloudcast.app.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class AuthViewModel(private val repo: AuthRepository) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    private val _authenticated = MutableStateFlow(false)
    val authenticated: StateFlow<Boolean> = _authenticated.asStateFlow()

    private val _pendingDeletion = MutableStateFlow<String?>(null)
    val pendingDeletion: StateFlow<String?> = _pendingDeletion.asStateFlow()

    init {

        viewModelScope.launch {
            val cached = repo.emailFlow.first()
            if (!cached.isNullOrBlank()) {
                _state.update { if (it.email.isBlank()) it.copy(email = cached) else it }
            }
        }
    }

    fun setEmail(v: String) = _state.update { it.copy(email = v, error = null) }
    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun setConfirm(v: String) = _state.update { it.copy(confirm = v, error = null) }
    fun setRecoveryInput(v: String) = _state.update { it.copy(recoveryInput = v, error = null) }

    fun toggleMode() = _state.update {
        it.copy(
            mode = if (it.mode == AuthMode.LOGIN) AuthMode.REGISTER else AuthMode.LOGIN,
            confirm = "",
            error = null,
        )
    }

    fun showRecover() = _state.update {
        it.copy(mode = AuthMode.RECOVER, password = "", confirm = "", error = null, recoverySucceeded = false)
    }

    fun showLogin() = _state.update {
        it.copy(mode = AuthMode.LOGIN, password = "", confirm = "", recoveryInput = "", error = null, recoverySucceeded = false)
    }

    fun canSubmit(s: AuthUiState): Boolean {
        if (!emailIsValid(s.email)) return false
        return when (s.mode) {
            AuthMode.LOGIN -> s.password.isNotEmpty()
            AuthMode.REGISTER ->
                passwordIsValid(s.password) && s.confirm.isNotEmpty() && s.confirm == s.password
            AuthMode.RECOVER ->
                s.recoveryInput.isNotBlank() &&
                    passwordIsValid(s.password) && s.confirm.isNotEmpty() && s.confirm == s.password
        }
    }

    fun submit() {
        val s = _state.value
        if (s.loading || !canSubmit(s)) return
        val email = s.email.trim().lowercase()
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                when (s.mode) {
                    AuthMode.LOGIN -> signIn(email, s.password)

                    AuthMode.REGISTER -> {
                        val code = repo.register(email, s.password)
                        _state.update { it.copy(recoveryCode = code) }
                    }

                    AuthMode.RECOVER -> {
                        repo.recover(email, s.recoveryInput, s.password)
                        _state.update {
                            it.copy(recoverySucceeded = true, mode = AuthMode.LOGIN, recoveryInput = "", password = "", confirm = "")
                        }
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Something went wrong")) }
            } finally {
                _state.update { it.copy(loading = false) }
            }
        }
    }

    fun acknowledgeRecoveryCode() {
        val s = _state.value
        if (s.loading || s.recoveryCode == null) return
        val email = s.email.trim().lowercase()
        val password = s.password
        _state.update { it.copy(loading = true, recoveryCode = null, error = null) }
        viewModelScope.launch {
            try {
                signIn(email, password)
            } catch (e: Exception) {

                _state.update {
                    it.copy(
                        mode = AuthMode.LOGIN,
                        error = "Account created, but signing in failed: ${friendlyError(e, "Something went wrong")}",
                    )
                }
            } finally {
                _state.update { it.copy(loading = false) }
            }
        }
    }

    private suspend fun signIn(email: String, password: String) {
        val outcome = repo.login(email, password)
        _pendingDeletion.value = outcome.pendingDeletion
        _authenticated.value = true
    }
}

class AuthViewModelFactory(private val repo: AuthRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = AuthViewModel(repo) as T
}
