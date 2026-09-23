package com.cloudcast.app.ui.search

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.NameConflictException
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.core.httpStatus
import com.cloudcast.app.core.matchesType
import com.cloudcast.app.core.parseApiError
import com.cloudcast.app.core.rankSemantic
import com.cloudcast.app.data.network.ConflictInfo
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.FolderRepository
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.ui.files.ConflictPrompt
import com.cloudcast.app.ui.sharing.ShareController
import com.cloudcast.app.ui.virtualfolders.SharedCrumb
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class SearchType(val label: String, val query: String?) {
    ALL("All", null),
    IMAGES("Images", "image"),
    VIDEO("Video", "video"),
    AUDIO("Audio", "audio"),
    PDF("PDF", "pdf"),
    TEXT("Text", "text"),
}

enum class SearchMode(val label: String) {
    NAME("Name"),
    SMART("Smart"),
}

data class SearchUiState(
    val query: String = "",
    val type: SearchType = SearchType.ALL,
    val mode: SearchMode = SearchMode.NAME,
    val files: List<FileDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,

    val smartUnavailable: Boolean = false,

    val path: List<SharedCrumb> = emptyList(),

    val allFolders: List<FolderDto> = emptyList(),
    val conflict: ConflictPrompt? = null,

    val reindexing: Boolean = false,

    val message: String? = null,
) {
    val inFolder: Boolean get() = path.isNotEmpty()
    val currentTitle: String? get() = path.lastOrNull()?.name
    val hasQuery: Boolean get() = query.isNotBlank()
    val isEmpty: Boolean get() = files.isEmpty() && folders.isEmpty()
    val smart: Boolean get() = mode == SearchMode.SMART
}

class SearchViewModel(
    private val files: FileRepository,
    private val folders: FolderRepository,
    shareRepo: ShareRepository,
    private val events: EventStream,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    val share = ShareController(shareRepo, viewModelScope)

    init {
        loadFolders()

        viewModelScope.launch {
            events.events().collect { event ->
                if (event == "files") {
                    loadFolders()

                    invalidateFileCache()
                    share.refreshIfOpen()
                }
            }
        }
    }

    private fun loadFolders() {
        viewModelScope.launch {
            try {
                _state.update { it.copy(allFolders = folders.list()) }
            } catch (_: Exception) {

            }
        }
    }

    private val debounceMs = 120L
    private var searchJob: Job? = null

    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query, path = emptyList()) }
        scheduleSearch()
    }

    fun onTypeChange(type: SearchType) {
        if (type == _state.value.type) return
        _state.update { it.copy(type = type, path = emptyList()) }
        scheduleSearch()
    }

    fun onModeChange(mode: SearchMode) {
        if (mode == _state.value.mode) return
        _state.update {
            it.copy(
                mode = mode,
                path = emptyList(),
                files = emptyList(),
                folders = emptyList(),
                error = null,
                smartUnavailable = false,
            )
        }
        scheduleSearch()
    }

    fun onSubmit() {
        scheduleSearch(immediate = true)
    }

    private fun scheduleSearch(immediate: Boolean = false) {
        searchJob?.cancel()
        val snapshot = _state.value
        if (!snapshot.hasQuery) {
            _state.update {
                it.copy(
                    files = emptyList(),
                    folders = emptyList(),
                    loading = false,
                    error = null,
                    smartUnavailable = false,
                )
            }
            return
        }
        _state.update { it.copy(loading = true, error = null, smartUnavailable = false) }
        searchJob = viewModelScope.launch {
            if (!immediate) delay(debounceMs)
            if (snapshot.mode == SearchMode.SMART) {
                runSemanticSearch(snapshot.query)
            } else {
                runSearch(snapshot.query, snapshot.type)
            }
        }
    }

    private var allFilesCache: List<FileDto>? = null

    private suspend fun allFiles(): List<FileDto> =
        allFilesCache ?: files.listAllFiles().also { allFilesCache = it }

    fun invalidateFileCache() {
        allFilesCache = null
    }

    fun reindexSemantic() {
        if (_state.value.reindexing) return
        _state.update { it.copy(reindexing = true, error = null) }
        viewModelScope.launch {
            try {
                val count = files.reindexSemantic()
                _state.update {
                    it.copy(
                        reindexing = false,
                        message = if (count == 0) {
                            "Nothing to index yet."
                        } else {
                            "Indexed $count file${if (count == 1) "" else "s"}."
                        },
                    )
                }

                scheduleSearch()
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        reindexing = false,

                        error = if (httpStatus(e) == 503 || httpStatus(e) == 403) {
                            "Smart search isn't available on this server."
                        } else {
                            friendlyError(e, "Couldn't index your files")
                        },
                    )
                }
            }
        }
    }

    fun messageShown() = _state.update { it.copy(message = null) }

    private suspend fun runSearch(query: String, type: SearchType) {
        try {
            val needle = query.trim().lowercase()
            val matchedFiles = allFiles()
                .filter { it.original_name.lowercase().contains(needle) }
                .filter { matchesType(it, type.query) }
            val matchedFolders = if (type == SearchType.ALL) {
                _state.value.allFolders.filter { it.name.lowercase().contains(needle) }
            } else {
                emptyList()
            }
            _state.update { it.copy(files = matchedFiles, folders = matchedFolders, loading = false) }
        } catch (e: Exception) {
            _state.update { it.copy(loading = false, error = friendlyError(e, "Search failed")) }
        }
    }

    private suspend fun runSemanticSearch(query: String) {
        try {
            val all = allFiles()
            var disabled = false
            var queryVector: FloatArray? = null
            var vectors: Map<String, FloatArray> = emptyMap()

            val words = runCatching { files.keywords() }.getOrDefault(emptyMap())
            try {
                queryVector = files.embedQuery(query)
                vectors = files.embeddings()
            } catch (e: Exception) {

                disabled = httpStatus(e) == 503 || httpStatus(e) == 403
            }

            val ranked = rankSemantic(all, query, queryVector, vectors, keywordsByFileId = words)
            val needle = query.trim().lowercase()
            val matchedFolders = _state.value.allFolders.filter { it.name.lowercase().contains(needle) }
            _state.update {
                it.copy(
                    files = ranked,
                    folders = matchedFolders,
                    loading = false,
                    error = null,
                    smartUnavailable = disabled && ranked.isEmpty() && matchedFolders.isEmpty(),
                )
            }
        } catch (e: Exception) {
            if (httpStatus(e) == 503) {
                _state.update {
                    it.copy(
                        files = emptyList(),
                        folders = emptyList(),
                        loading = false,
                        error = null,
                        smartUnavailable = true,
                    )
                }
            } else {
                _state.update { it.copy(loading = false, error = friendlyError(e, "Search failed")) }
            }
        }
    }

    fun openFolder(folder: FolderDto) {
        val crumb = SharedCrumb(folder.id, folder.name)
        _state.update { it.copy(path = it.path + crumb) }
        loadFolder(folder.id)
    }

    fun goBack(): Boolean {
        val current = _state.value
        if (current.path.isEmpty()) return false
        val newPath = current.path.dropLast(1)
        if (newPath.isEmpty()) {
            _state.update { it.copy(path = emptyList()) }
            scheduleSearch()
        } else {
            _state.update { it.copy(path = newPath) }
            loadFolder(newPath.last().id)
        }
        return true
    }

    private fun loadFolder(folderId: String) {
        searchJob?.cancel()
        _state.update { it.copy(loading = true, error = null, files = emptyList(), folders = emptyList()) }
        viewModelScope.launch {
            try {
                val folder = files.getFolder(folderId)
                val folderFiles = files.listFolderFiles(folderId)
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

    fun download(id: String, dest: Uri) {
        viewModelScope.launch {
            try {
                files.saveTo(id, dest)
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Download failed")) }
            }
        }
    }

    fun deleteFile(id: String) = mutate { files.delete(id) }
    fun renameFile(id: String, name: String) = mutateWithConflict { oc -> files.rename(id, name.trim(), oc) }
    fun moveFile(id: String, folderId: String?) = mutateWithConflict { oc -> files.move(id, folderId, oc) }
    fun setFileExpiry(id: String, expiresAt: String?) = mutate { files.setExpiry(id, expiresAt) }
    fun toggleFavorite(id: String) = mutate {
        val current = _state.value.files.find { it.id == id }?.is_favorite ?: false
        files.setFavorite(id, !current)
    }

    private var pendingConflict: CompletableDeferred<Pair<String, Boolean>?>? = null

    fun resolveConflict(action: String, applyAll: Boolean) {
        _state.update { it.copy(conflict = null) }
        pendingConflict?.complete(action to applyAll)
        pendingConflict = null
    }

    fun cancelConflict() {
        _state.update { it.copy(conflict = null) }
        pendingConflict?.complete(null)
        pendingConflict = null
    }

    private suspend fun askConflict(info: ConflictInfo): Pair<String, Boolean>? {
        val deferred = CompletableDeferred<Pair<String, Boolean>?>()
        pendingConflict = deferred
        _state.update { it.copy(conflict = ConflictPrompt(info, bulk = false)) }
        return deferred.await()
    }

    private class AppException(message: String?) : Exception(message)

    private suspend fun runWithConflict(op: suspend (onConflict: String?) -> Unit) {
        try {
            op(null)
        } catch (e: Exception) {

            val info: ConflictInfo? = when (e) {
                is NameConflictException -> ConflictInfo(
                    type = if (e.isFolder) "folder" else "file",
                    name = e.conflictName,
                    existing_id = e.existingId,
                )
                else -> parseApiError(e)?.takeIf { it.code == "NAME_CONFLICT" }?.conflict
            }
            if (info == null) {
                val parsed = parseApiError(e)
                throw AppException(parsed?.error ?: friendlyError(e, "Something went wrong"))
            }
            val picked = askConflict(info) ?: return
            if (picked.first == "skip") return
            op(picked.first)
        }
    }

    private fun refreshCurrent() {
        val s = _state.value
        if (s.inFolder) {
            loadFolder(s.path.last().id)
        } else if (s.hasQuery) {
            viewModelScope.launch {
                if (s.mode == SearchMode.SMART) runSemanticSearch(s.query)
                else runSearch(s.query, s.type)
            }
        }
    }

    private fun mutate(block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
                refreshCurrent()
                _state.update { it.copy(error = null) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Something went wrong")) }
            }
        }
    }

    private fun mutateWithConflict(op: suspend (onConflict: String?) -> Unit) {
        viewModelScope.launch {
            try {
                runWithConflict(op)
                refreshCurrent()
                _state.update { it.copy(error = null) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Something went wrong")) }
            }
        }
    }
}

class SearchViewModelFactory(
    private val files: FileRepository,
    private val folders: FolderRepository,
    private val shareRepo: ShareRepository,
    private val events: EventStream,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        SearchViewModel(files, folders, shareRepo, events) as T
}
