package com.cloudcast.app.ui.virtualfolders

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.SharePermissions
import com.cloudcast.app.core.RefreshGate
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.data.network.withFavorite
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.ui.sharing.ShareController
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class VirtualFolderMode { SHARED_WITH_ME, SHARED_BY_ME, EXPIRING, FAVORITES }

data class SharedCrumb(val id: String, val name: String)

data class VirtualFolderUiState(
    val files: List<FileDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,

    val message: String? = null,

    val path: List<SharedCrumb> = emptyList(),

    val selectionMode: Boolean = false,
    val selectedFileIds: Set<String> = emptySet(),
    val selectedFolderIds: Set<String> = emptySet(),

    val bulkBusy: Boolean = false,
) {
    val isEmpty: Boolean get() = files.isEmpty() && folders.isEmpty()
    val inFolder: Boolean get() = path.isNotEmpty()
    val currentTitle: String? get() = path.lastOrNull()?.name

    val selectedFiles: List<FileDto> get() = files.filter { it.id in selectedFileIds }
    val selectedFolders: List<FolderDto> get() = folders.filter { it.id in selectedFolderIds }

    val selectedCount: Int get() = selectedFiles.size + selectedFolders.size

    val allSelected: Boolean
        get() {
            val total = files.size + folders.size
            return total > 0 && selectedCount == total
        }

    fun isFileSelected(id: String): Boolean = id in selectedFileIds
    fun isFolderSelected(id: String): Boolean = id in selectedFolderIds

    val allSelectedCanDownload: Boolean
        get() = selectedCount > 0 &&
            selectedFiles.all { SharePermissions.canDownload(it.permission) } &&
            selectedFolders.all { SharePermissions.canDownload(it.permission) }

    val allSelectedCanSave: Boolean
        get() = selectedFolderIds.isEmpty() && selectedFileIds.isNotEmpty() &&
            selectedFiles.all { SharePermissions.canSave(it.permission) }
}

class VirtualFolderViewModel(
    private val files: FileRepository,
    private val shares: ShareRepository,
    private val events: EventStream,
    private val mode: VirtualFolderMode,
) : ViewModel() {

    private val _state = MutableStateFlow(VirtualFolderUiState())
    val state: StateFlow<VirtualFolderUiState> = _state.asStateFlow()

    val share = ShareController(shares, viewModelScope)

    private val resumeGate = RefreshGate()

    fun refreshOnResume() {
        if (!resumeGate.shouldRefresh()) return
        refreshCurrent()
    }

    init {

        viewModelScope.launch {
            events.events().collect { event ->
                if (event == "files") refreshCurrent()
            }
        }
    }

    fun refreshCurrent() {
        val here = _state.value.path.lastOrNull()

        if (here == null) load(silent = true) else loadFolder(here.id, silent = true)
    }

    fun load(silent: Boolean = false) {
        val hasContent = !_state.value.isEmpty
        _state.update { it.copy(loading = !(silent || hasContent), error = null) }
        viewModelScope.launch {
            try {

                runCatching { files.refreshFavorites() }
                val (f, d) = when (mode) {
                    VirtualFolderMode.SHARED_WITH_ME -> shares.sharedWithMe()
                    VirtualFolderMode.SHARED_BY_ME -> shares.sharedByMe()
                    VirtualFolderMode.EXPIRING -> files.expiring()
                    VirtualFolderMode.FAVORITES -> files.listFavorites() to emptyList()
                }
                val sortedFiles = if (mode == VirtualFolderMode.EXPIRING) f.sortedBy { it.expires_at ?: "" } else f
                val sortedFolders = if (mode == VirtualFolderMode.EXPIRING) d.sortedBy { it.expires_at ?: "" } else d
                resumeGate.mark()
                _state.update {
                    it.copy(files = sortedFiles, folders = sortedFolders, loading = false, path = emptyList())
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendlyError(e, "Couldn't load")) }
            }
        }
    }

    fun openFolder(folder: FolderDto) {
        val crumb = SharedCrumb(folder.id, folder.name)
        clearSelection()
        _state.update { it.copy(path = it.path + crumb) }
        loadFolder(folder.id)
    }

    fun goBack(): Boolean {
        val current = _state.value
        if (current.path.isEmpty()) return false
        clearSelection()
        val newPath = current.path.dropLast(1)
        if (newPath.isEmpty()) {
            load()
        } else {
            _state.update { it.copy(path = newPath) }
            loadFolder(newPath.last().id)
        }
        return true
    }

    private fun loadFolder(folderId: String, silent: Boolean = false) {
        _state.update {
            if (silent) {
                it.copy(error = null)
            } else {
                it.copy(loading = true, error = null, files = emptyList(), folders = emptyList())
            }
        }
        viewModelScope.launch {
            try {
                val folder = files.getFolder(folderId)
                val folderFiles = files.listFolderFiles(folderId)

                resumeGate.mark()
                _state.update { s ->
                    val path = s.path.toMutableList()
                    if (path.isNotEmpty()) path[path.size - 1] = SharedCrumb(folder.id, folder.name)
                    s.copy(files = folderFiles, folders = emptyList(), loading = false, path = path)
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendlyError(e, "Couldn't load")) }
            }
        }
    }

    fun toggleFavorite(id: String) {
        val current = _state.value.files.find { it.id == id } ?: return
        val next = !current.is_favorite
        viewModelScope.launch {
            try {
                files.setFavorite(id, next)
                _state.update { s ->
                    if (mode == VirtualFolderMode.FAVORITES && !next) {
                        s.copy(files = s.files.filterNot { it.id == id })
                    } else {
                        s.copy(files = s.files.map { if (it.id == id) it.withFavorite(next) else it })
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't update favourite")) }
            }
        }
    }

    fun removeFromMyList(id: String, isFolder: Boolean) {
        viewModelScope.launch {
            try {
                if (isFolder) shares.leave(folderId = id) else shares.leave(fileId = id)
                dropRow(id, isFolder)
                _state.update { it.copy(message = "Removed from your list") }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't remove")) }
            }
        }
    }

    fun setShareExpiry(id: String, isFolder: Boolean, expiresAt: String?) {
        viewModelScope.launch {
            try {
                if (isFolder) shares.setShareExpiry(folderId = id, expiresAt = expiresAt)
                else shares.setShareExpiry(fileId = id, expiresAt = expiresAt)
                _state.update {
                    it.copy(message = if (expiresAt == null) "Expiry cleared" else "Expiry set")
                }
                refreshCurrent()
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't update expiry")) }
            }
        }
    }

    fun stopSharing(id: String, isFolder: Boolean) {
        viewModelScope.launch {
            try {
                if (isFolder) shares.unshareAll(folderId = id) else shares.unshareAll(fileId = id)
                dropRow(id, isFolder)
                _state.update { it.copy(message = "Stopped sharing") }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't stop sharing")) }
            }
        }
    }

    private fun dropRow(id: String, isFolder: Boolean) {
        _state.update { s ->
            if (isFolder) s.copy(folders = s.folders.filterNot { it.id == id })
            else s.copy(files = s.files.filterNot { it.id == id })
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

    fun messageShown() = _state.update { it.copy(message = null) }

    fun download(id: String, dest: Uri) {
        viewModelScope.launch {
            try {
                files.saveTo(id, dest)
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Download failed")) }
            }
        }
    }

    fun startSelection(fileId: String? = null, folderId: String? = null) {
        _state.update {
            it.copy(
                selectionMode = true,
                selectedFileIds = if (fileId != null) it.selectedFileIds + fileId else it.selectedFileIds,
                selectedFolderIds = if (folderId != null) it.selectedFolderIds + folderId else it.selectedFolderIds,
            )
        }
    }

    fun toggleFile(id: String) = _state.update {
        val next = if (id in it.selectedFileIds) it.selectedFileIds - id else it.selectedFileIds + id
        it.copy(selectedFileIds = next, selectionMode = true)
    }

    fun toggleFolder(id: String) = _state.update {
        val next = if (id in it.selectedFolderIds) it.selectedFolderIds - id else it.selectedFolderIds + id
        it.copy(selectedFolderIds = next, selectionMode = true)
    }

    fun selectAll() = _state.update {
        it.copy(
            selectionMode = true,
            selectedFileIds = it.files.mapTo(HashSet()) { f -> f.id },
            selectedFolderIds = it.folders.mapTo(HashSet()) { f -> f.id },
        )
    }

    fun clearSelection() = _state.update {
        it.copy(selectionMode = false, selectedFileIds = emptySet(), selectedFolderIds = emptySet())
    }

    fun bulkSaveToCloud() = runBulk("Saved", "couldn't be saved") { snapshot ->
        var failures = 0
        for (file in snapshot.selectedFiles) {
            try { files.saveSharedFile(file.id) } catch (_: Exception) { failures++ }
        }
        failures to snapshot.selectedFiles.size
    }

    fun bulkRemoveFromMyList() = runBulk("Removed", "couldn't be removed") { snapshot ->
        var failures = 0
        for (f in snapshot.selectedFiles) {
            try { shares.leave(fileId = f.id) } catch (_: Exception) { failures++ }
        }
        for (d in snapshot.selectedFolders) {
            try { shares.leave(folderId = d.id) } catch (_: Exception) { failures++ }
        }
        failures to snapshot.selectedCount
    }

    fun bulkStopSharing() = runBulk("Stopped sharing", "couldn't be updated") { snapshot ->
        var failures = 0
        for (f in snapshot.selectedFiles) {
            try { shares.unshareAll(fileId = f.id) } catch (_: Exception) { failures++ }
        }
        for (d in snapshot.selectedFolders) {
            try { shares.unshareAll(folderId = d.id) } catch (_: Exception) { failures++ }
        }
        failures to snapshot.selectedCount
    }

    fun bulkSetExpiry(expiresAt: String?) =
        runBulk(if (expiresAt == null) "Expiry cleared" else "Expiry set", "couldn't be updated") { snapshot ->
            var failures = 0
            for (f in snapshot.selectedFiles) {
                try { shares.setShareExpiry(fileId = f.id, expiresAt = expiresAt) } catch (_: Exception) { failures++ }
            }
            for (d in snapshot.selectedFolders) {
                try { shares.setShareExpiry(folderId = d.id, expiresAt = expiresAt) } catch (_: Exception) { failures++ }
            }
            failures to snapshot.selectedCount
        }

    fun downloadSelectedIndividually(treeUri: Uri) =
        runBulk("Downloaded", "couldn't be saved", refresh = false) { snapshot ->
            var failures = 0
            for (file in snapshot.selectedFiles) {
                try {
                    files.saveContentInto(treeUri, file.original_name, file.mime_type, file.id)
                } catch (_: Exception) {
                    failures++
                }
            }
            failures to snapshot.selectedFiles.size
        }

    fun downloadSelectedZip(dest: Uri) =
        runBulk("Downloaded", "couldn't be archived", refresh = false) { snapshot ->
            files.saveArchive(
                files = snapshot.selectedFiles.map { it.id to it.original_name },
                folders = snapshot.selectedFolders.map { it.id to it.name },
                dest = dest,
            )
            0 to snapshot.selectedCount
        }

    private fun runBulk(
        successVerb: String,
        failureNoun: String,
        refresh: Boolean = true,
        block: suspend (VirtualFolderUiState) -> Pair<Int, Int>,
    ) {
        val snapshot = _state.value
        if (snapshot.selectedCount == 0 || snapshot.bulkBusy) return
        _state.update { it.copy(bulkBusy = true, error = null) }
        viewModelScope.launch {
            try {
                val (failures, attempted) = block(snapshot)
                clearSelection()
                _state.update {
                    it.copy(
                        bulkBusy = false,
                        message = if (failures == 0) {
                            "$successVerb ${plural(attempted)}."
                        } else {
                            "$failures of $attempted $failureNoun."
                        },
                    )
                }
                if (refresh) refreshCurrent()
            } catch (e: Exception) {
                _state.update { it.copy(bulkBusy = false, error = friendlyError(e, "Couldn't complete that")) }
            }
        }
    }

    private fun plural(n: Int) = if (n == 1) "1 item" else "$n items"
}

class VirtualFolderViewModelFactory(
    private val files: FileRepository,
    private val shares: ShareRepository,
    private val events: EventStream,
    private val mode: VirtualFolderMode,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        VirtualFolderViewModel(files, shares, events, mode) as T
}
