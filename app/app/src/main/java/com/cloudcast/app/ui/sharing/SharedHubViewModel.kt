package com.cloudcast.app.ui.sharing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.RefreshGate
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.ShareRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface SharedRecent {
    val incoming: Boolean

    val id: String

    val createdAt: String

    data class Item(val file: FileDto, override val incoming: Boolean) : SharedRecent {
        override val id get() = file.id
        override val createdAt get() = file.created_at
    }

    data class Folder(val folder: FolderDto, override val incoming: Boolean) : SharedRecent {
        override val id get() = folder.id
        override val createdAt get() = folder.created_at
    }
}

data class SharedHubUiState(
    val recents: List<SharedRecent> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

class SharedHubViewModel(
    private val shares: ShareRepository,
    private val files: FileRepository,
    private val events: EventStream,
) : ViewModel() {

    private val _state = MutableStateFlow(SharedHubUiState())
    val state: StateFlow<SharedHubUiState> = _state.asStateFlow()

    val share = ShareController(shares, viewModelScope)

    private val resumeGate = RefreshGate()

    fun refreshOnResume() {
        if (!resumeGate.shouldRefresh()) return

        refresh()
    }

    init {

        viewModelScope.launch {
            events.events().collect { event ->
                if (event == "files" || event == "notification") refresh(silent = true)
            }
        }
    }

    fun refresh(silent: Boolean = false) {
        val hasContent = _state.value.recents.isNotEmpty()
        _state.update { it.copy(loading = !(silent || hasContent), error = null) }
        viewModelScope.launch {
            try {

                val (incoming, outgoing) = coroutineScope {
                    val a = async { shares.sharedWithMe() }
                    val b = async { shares.sharedByMe() }
                    a.await() to b.await()
                }

                val merged = buildList {
                    incoming.first.forEach { add(SharedRecent.Item(it, incoming = true)) }
                    incoming.second.forEach { add(SharedRecent.Folder(it, incoming = true)) }
                    outgoing.first.forEach { add(SharedRecent.Item(it, incoming = false)) }
                    outgoing.second.forEach { add(SharedRecent.Folder(it, incoming = false)) }
                }

                    .sortedByDescending { it.createdAt }

                    .distinctBy { it.id }

                resumeGate.mark()
                _state.update { it.copy(recents = merged, loading = false) }
            } catch (e: Exception) {
                _state.update {
                    it.copy(loading = false, error = friendlyError(e, "Couldn't load shared files"))
                }
            }
        }
    }

    fun download(id: String, dest: android.net.Uri) {
        viewModelScope.launch {
            try {
                files.saveTo(id, dest)
                _state.update { it.copy(message = "Saved") }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Download failed")) }
            }
        }
    }

    fun saveToCloud(id: String) {
        viewModelScope.launch {
            try {
                files.saveSharedFile(id)
                _state.update { it.copy(message = "Saved to your cloud") }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't save")) }
            }
        }
    }

    fun removeFromMyList(id: String, isFolder: Boolean) =
        mutate(id, "Removed from your list", "Couldn't remove") {
            if (isFolder) shares.leave(folderId = id) else shares.leave(fileId = id)
        }

    fun setShareExpiry(id: String, isFolder: Boolean, expiresAt: String?) {
        viewModelScope.launch {
            try {
                if (isFolder) shares.setShareExpiry(folderId = id, expiresAt = expiresAt)
                else shares.setShareExpiry(fileId = id, expiresAt = expiresAt)
                _state.update {
                    it.copy(message = if (expiresAt == null) "Expiry cleared" else "Expiry set")
                }
                refresh(silent = true)
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't update expiry")) }
            }
        }
    }

    fun stopSharing(id: String, isFolder: Boolean) =
        mutate(id, "Stopped sharing", "Couldn't stop sharing") {
            if (isFolder) shares.unshareAll(folderId = id) else shares.unshareAll(fileId = id)
        }

    private fun mutate(id: String, success: String, failure: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
                _state.update { s ->
                    s.copy(
                        recents = s.recents.filterNot { it.id == id },
                        message = success,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, failure)) }
            }
        }
    }

    fun messageShown() = _state.update { it.copy(message = null) }

    fun errorShown() = _state.update { it.copy(error = null) }
}

class SharedHubViewModelFactory(
    private val shares: ShareRepository,
    private val files: FileRepository,
    private val events: EventStream,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        SharedHubViewModel(shares, files, events) as T
}
