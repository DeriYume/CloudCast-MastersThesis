package com.cloudcast.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.AutoFileMode
import com.cloudcast.app.core.displayNameFromEmail
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.data.SettingsStore
import com.cloudcast.app.data.network.AiPreferences
import com.cloudcast.app.data.repository.AuthRepository
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.ui.theme.ThemeMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
    val email: String = "",

    val displayName: String = "",
    val createdAt: String? = null,
    val loading: Boolean = true,
    val error: String? = null,

    val showPasswordDialog: Boolean = false,
    val showEmailDialog: Boolean = false,
    val showApproveLoginDialog: Boolean = false,
    val showRegenerateDialog: Boolean = false,
    val showDeleteDialog: Boolean = false,
    val accountBusy: Boolean = false,
    val accountError: String? = null,
    val message: String? = null,

    val newRecoveryCode: String? = null,

    val pendingDeletion: String? = null,

    val graceDays: Int = 30,

    val autoFileMode: AutoFileMode = AutoFileMode.OFF,

    val themeMode: ThemeMode = ThemeMode.SYSTEM,

    val staySignedIn: Boolean = true,

    val aiPreferences: AiPreferences? = null,

    val aiAvailable: Boolean = false,
    val semanticAvailable: Boolean = false,
)

class ProfileViewModel(
    private val repo: AuthRepository,
    private val settings: SettingsStore,
    private val files: FileRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    private val _loggedOut = MutableStateFlow(false)
    val loggedOut: StateFlow<Boolean> = _loggedOut.asStateFlow()

    init {
        load()
        loadAi()

        viewModelScope.launch {
            repo.pendingDeletionFlow.collect { purgeAfter ->
                _state.update { it.copy(pendingDeletion = purgeAfter) }
            }
        }
        viewModelScope.launch {
            settings.themeModeFlow.collect { mode ->
                _state.update { it.copy(themeMode = mode) }
            }
        }
        viewModelScope.launch {
            settings.staySignedInFlow.collect { on ->
                _state.update { it.copy(staySignedIn = on) }
            }
        }
    }

    fun setAutoFileMode(mode: AutoFileMode) {
        setAiPreference(autoFileMode = mode.key)
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { settings.setThemeMode(mode) }
    }

    private fun loadAi() {
        viewModelScope.launch {

            val config = runCatching { files.aiConfig() }.getOrNull() ?: return@launch
            _state.update {
                it.copy(
                    aiAvailable = config.ai,
                    semanticAvailable = config.semantic,
                    aiPreferences = config.preferences,
                    autoFileMode = AutoFileMode.fromKey(config.preferences.auto_file_mode),
                )
            }
        }
    }

    fun setAiPreference(
        analysis: Boolean? = null,
        semanticSearch: Boolean? = null,
        autoFileMode: String? = null,
    ) {
        val current = _state.value.aiPreferences ?: return
        val updated = current.copy(
            analysis = analysis ?: current.analysis,
            semantic_search = semanticSearch ?: current.semantic_search,
            auto_file_mode = autoFileMode ?: current.auto_file_mode,
        )
        _state.update { it.copy(aiPreferences = updated, autoFileMode = AutoFileMode.fromKey(updated.auto_file_mode)) }
        viewModelScope.launch {
            try {
                files.updateAiPreferences(updated)
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        aiPreferences = current,
                        autoFileMode = AutoFileMode.fromKey(current.auto_file_mode),
                        accountError = friendlyError(e, "Couldn't update AI settings"),
                    )
                }
            }
        }
    }

    fun setStaySignedIn(enabled: Boolean) {
        viewModelScope.launch {
            settings.setStaySignedIn(enabled)
            if (enabled) repo.refreshPersistedSession() else repo.forgetPersistedSession()
        }
    }

    private fun load() {
        viewModelScope.launch {

            val cached = repo.emailFlow.first().orEmpty()
            _state.update { it.copy(email = cached, displayName = displayNameFromEmail(cached)) }
            try {
                val user = repo.me()
                _state.update {
                    it.copy(
                        email = user.email,
                        displayName = user.display_name?.takeIf { n -> n.isNotBlank() }
                            ?: displayNameFromEmail(user.email),
                        createdAt = user.created_at,
                        graceDays = user.graceDays ?: it.graceDays,
                        loading = false,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendlyError(e, "Couldn't load profile")) }
            }
        }
    }

    fun openPasswordDialog() = _state.update { it.copy(showPasswordDialog = true, accountError = null) }
    fun openEmailDialog() = _state.update { it.copy(showEmailDialog = true, accountError = null) }
    fun openApproveLoginDialog() = _state.update { it.copy(showApproveLoginDialog = true, accountError = null) }

    fun dismissDialogs() = _state.update {
        it.copy(
            showPasswordDialog = false,
            showEmailDialog = false,
            showApproveLoginDialog = false,
            showRegenerateDialog = false,
            showDeleteDialog = false,
            accountError = null,
            accountBusy = false,

        )
    }

    fun openRegenerateDialog() = _state.update { it.copy(showRegenerateDialog = true, accountError = null) }
    fun openDeleteDialog() = _state.update { it.copy(showDeleteDialog = true, accountError = null) }

    fun messageShown() = _state.update { it.copy(message = null) }

    fun changePassword(current: String, new: String) {
        _state.update { it.copy(accountBusy = true, accountError = null) }
        viewModelScope.launch {
            try {
                repo.changePassword(current, new)
                _state.update {
                    it.copy(
                        accountBusy = false,
                        showPasswordDialog = false,
                        message = "Password changed. Other devices have been signed out.",
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(accountBusy = false, accountError = friendlyError(e, "Couldn't change password")) }
            }
        }
    }

    fun changeEmail(password: String, newEmail: String) {
        _state.update { it.copy(accountBusy = true, accountError = null) }
        viewModelScope.launch {
            try {
                val updated = repo.changeEmail(password, newEmail)
                _state.update {
                    it.copy(
                        accountBusy = false,
                        showEmailDialog = false,
                        email = updated,
                        message = "Email updated.",
                    )
                }

                refreshProfile()
            } catch (e: Exception) {
                _state.update { it.copy(accountBusy = false, accountError = friendlyError(e, "Couldn't change email")) }
            }
        }
    }

    fun regenerateRecoveryCode(password: String) {
        _state.update { it.copy(accountBusy = true, accountError = null) }
        viewModelScope.launch {
            try {
                val code = repo.regenerateRecoveryCode(password)
                _state.update {
                    it.copy(
                        accountBusy = false,
                        showRegenerateDialog = false,
                        newRecoveryCode = code,
                    )
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(accountBusy = false, accountError = friendlyError(e, "Couldn't regenerate the recovery code"))
                }
            }
        }
    }

    fun recoveryCodeAcknowledged() = _state.update {
        it.copy(newRecoveryCode = null, message = "New recovery code saved. The old one no longer works.")
    }

    fun deleteAccount(password: String) {
        _state.update { it.copy(accountBusy = true, accountError = null) }
        viewModelScope.launch {
            try {

                if (!repo.canConfirmPassword()) {
                    _state.update {
                        it.copy(
                            accountBusy = false,
                            accountError = "This device was signed in with a QR code, so your " +
                                "password can't be checked here. Sign in with your password " +
                                "on this device first, or delete the account from another one.",
                        )
                    }
                    return@launch
                }
                if (!repo.confirmPassword(password)) {
                    _state.update { it.copy(accountBusy = false, accountError = "That password isn't right.") }
                    return@launch
                }
                val purgeAfter = repo.deleteAccount()
                _state.update { it.copy(accountBusy = false, showDeleteDialog = false, pendingDeletion = purgeAfter) }

                repo.forceSignOut()
                _loggedOut.value = true
            } catch (e: Exception) {
                _state.update {
                    it.copy(accountBusy = false, accountError = friendlyError(e, "Couldn't delete the account"))
                }
            }
        }
    }

    fun restoreAccount() {
        _state.update { it.copy(accountBusy = true, accountError = null) }
        viewModelScope.launch {
            try {
                repo.restoreAccount()
                _state.update {
                    it.copy(accountBusy = false, pendingDeletion = null, message = "Account deletion cancelled.")
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(accountBusy = false, accountError = friendlyError(e, "Couldn't cancel the deletion"))
                }
            }
        }
    }

    private fun refreshProfile() {
        viewModelScope.launch {
            try {
                val user = repo.me()
                _state.update {
                    it.copy(
                        email = user.email,
                        displayName = user.display_name?.takeIf { n -> n.isNotBlank() }
                            ?: displayNameFromEmail(user.email),
                        createdAt = user.created_at,
                        graceDays = user.graceDays ?: it.graceDays,
                    )
                }
            } catch (_: Exception) {

            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repo.logout()
            _loggedOut.value = true
        }
    }
}

class ProfileViewModelFactory(
    private val repo: AuthRepository,
    private val settings: SettingsStore,
    private val files: FileRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        ProfileViewModel(repo, settings, files) as T
}
