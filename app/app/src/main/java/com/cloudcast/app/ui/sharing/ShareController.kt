package com.cloudcast.app.ui.sharing

import com.cloudcast.app.core.SharePermissions
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.data.repository.ShareRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ShareTarget(val id: String, val name: String, val isFolder: Boolean)

data class ShareUiState(

    val target: ShareTarget? = null,
    val shares: List<ShareRepository.ShareItem> = emptyList(),
    val contacts: List<ShareRepository.Contact> = emptyList(),
    val loading: Boolean = false,
    val busy: Boolean = false,
    val error: String? = null,
)

class ShareController(
    private val repo: ShareRepository,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(ShareUiState())
    val state: StateFlow<ShareUiState> = _state.asStateFlow()

    fun openForFile(id: String, name: String) = open(ShareTarget(id, name, isFolder = false))

    fun openForFolder(id: String, name: String) = open(ShareTarget(id, name, isFolder = true))

    private fun open(target: ShareTarget) {
        _state.update {
            ShareUiState(target = target, loading = true, contacts = it.contacts)
        }
        scope.launch {
            try {
                _state.update { it.copy(shares = listFor(target), loading = false) }
            } catch (e: Exception) {
                _state.update {
                    it.copy(loading = false, error = friendlyError(e, "Couldn't load who has access"))
                }
            }
        }

        scope.launch {
            runCatching { repo.contacts() }
                .onSuccess { list -> _state.update { it.copy(contacts = list) } }
        }
    }

    fun dismiss() {

        _state.update { ShareUiState(contacts = it.contacts) }
    }

    fun add(recipient: String, expiresAt: String?, permission: String) {
        val target = _state.value.target ?: return
        _state.update { it.copy(busy = true, error = null) }
        scope.launch {
            try {
                val resolved = repo.resolveRecipient(recipient)
                if (resolved == null) {
                    _state.update {
                        it.copy(busy = false, error = "No CloudCast account matches “$recipient”.")
                    }
                    return@launch
                }
                if (target.isFolder) {
                    repo.shareFolder(target.id, resolved, expiresAt, permission)
                } else {
                    repo.shareFile(target.id, resolved, expiresAt, permission)
                }
                refresh(target)

                runCatching { repo.contacts() }
                    .onSuccess { list -> _state.update { it.copy(contacts = list) } }
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = friendlyError(e, "Couldn't share")) }
            }
        }
    }

    fun revoke(shareId: String) = mutate("Couldn't revoke access") { repo.revoke(shareId) }

    fun changePermission(shareId: String, permission: String) =
        mutate("Couldn't change access") { repo.updatePermission(shareId, permission) }

    fun changeExpiry(shareId: String, expiresAt: String?) =
        mutate("Couldn't update expiry") { repo.updateShareExpiry(shareId, expiresAt) }

    fun unshareAll() {
        val target = _state.value.target ?: return
        _state.update { it.copy(busy = true, error = null) }
        scope.launch {
            try {
                if (target.isFolder) repo.unshareAll(folderId = target.id)
                else repo.unshareAll(fileId = target.id)
                dismiss()
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = friendlyError(e, "Couldn't stop sharing")) }
            }
        }
    }

    fun setExpiryForAll(expiresAt: String?) {
        val target = _state.value.target ?: return
        mutate("Couldn't update expiry") {
            if (target.isFolder) repo.setShareExpiry(folderId = target.id, expiresAt = expiresAt)
            else repo.setShareExpiry(fileId = target.id, expiresAt = expiresAt)
        }
    }

    fun refreshIfOpen() {
        val target = _state.value.target ?: return
        scope.launch { runCatching { refresh(target) } }
    }

    private fun mutate(failureMessage: String, block: suspend () -> Unit) {
        val target = _state.value.target ?: return
        _state.update { it.copy(busy = true, error = null) }
        scope.launch {
            try {
                block()
                refresh(target)
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = friendlyError(e, failureMessage)) }
            }
        }
    }

    private suspend fun refresh(target: ShareTarget) {
        _state.update { it.copy(shares = listFor(target), busy = false, loading = false) }
    }

    private suspend fun listFor(target: ShareTarget): List<ShareRepository.ShareItem> =
        if (target.isFolder) repo.listFolderShares(target.id) else repo.listFileShares(target.id)

    val permissions: List<String> get() = SharePermissions.selectable
}
