package com.cloudcast.app.ui.files

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.AutoFileMode
import com.cloudcast.app.core.ContentKind
import com.cloudcast.app.core.bestFolderMatch
import com.cloudcast.app.core.contentKind
import com.cloudcast.app.core.autoFileTarget
import com.cloudcast.app.core.findMatchingFolder
import com.cloudcast.app.core.NameConflictException
import com.cloudcast.app.core.EVENT_COALESCE_MS
import com.cloudcast.app.core.RefreshGate
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.core.parseApiError
import com.cloudcast.app.data.network.ConflictInfo
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.repository.AuthRepository
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.FolderRepository
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.ui.sharing.ShareController
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class FilesViewModel(
    private val folders: FolderRepository,
    private val files: FileRepository,
    private val shares: ShareRepository,
    private val auth: AuthRepository,
    private val events: EventStream,
) : ViewModel() {

    private val _state = MutableStateFlow(FilesUiState())
    val state: StateFlow<FilesUiState> = _state.asStateFlow()

    private val _loggedOut = MutableStateFlow(false)
    val loggedOut: StateFlow<Boolean> = _loggedOut.asStateFlow()

    init {

        viewModelScope.launch {
            events.events().collect { event ->
                if (event == "prefs") currentFilingMode()
                if (event == "files" && eventGate.shouldRefresh()) {
                    eventGate.mark()
                    refresh()

                    share.refreshIfOpen()
                }
            }
        }
    }

    init {

        viewModelScope.launch {
            runCatching { files.aiPreferences() }.onSuccess { prefs ->
                _state.update { it.copy(autoFileMode = AutoFileMode.fromKey(prefs.auto_file_mode)) }
            }
        }
    }

    fun setAutoFileMode(mode: AutoFileMode) {
        val previous = _state.value.autoFileMode
        _state.update { it.copy(autoFileMode = mode) }
        viewModelScope.launch {
            runCatching {
                val current = files.aiPreferences()
                files.updateAiPreferences(current.copy(auto_file_mode = mode.key))
            }.onFailure {
                _state.update { it.copy(autoFileMode = previous) }
            }
        }
    }

    private val resumeGate = RefreshGate()
    private val eventGate = RefreshGate(EVENT_COALESCE_MS)

    fun refreshOnResume() {
        if (!resumeGate.shouldRefresh()) return
        refresh()
    }

    fun refresh() {
        val hasContent = _state.value.let { it.files.isNotEmpty() || it.allFolders.isNotEmpty() }
        _state.update { it.copy(loading = !hasContent, error = null) }
        viewModelScope.launch {
            try {

                runCatching { files.refreshFavorites() }

                val v = loadVault()
                resumeGate.mark()
                _state.update {
                    it.copy(
                        allFolders = v.folders,
                        files = v.files,
                        favoriteFiles = v.favorites,
                        loading = false,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't load"), loading = false) }
            }
        }
    }

    fun openFolder(id: String) {
        _state.update { it.copy(currentParentId = id) }
        reloadFiles()
    }

    fun goUp() {
        _state.update { s ->
            s.copy(currentParentId = s.allFolders.find { it.id == s.currentParentId }?.parent_id)
        }
        reloadFiles()
    }

    private fun reloadFiles() {
        viewModelScope.launch {
            try {
                val list = files.list(_state.value.currentParentId)
                _state.update { it.copy(files = list) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't load files")) }
            }
        }
    }

    fun createFolder(name: String) = mutateWithConflict { oc -> folders.create(name.trim(), _state.value.currentParentId, oc) }
    fun renameFolder(id: String, name: String) = mutateWithConflict { oc -> folders.rename(id, name.trim(), oc) }
    fun deleteFolder(id: String) = mutate { folders.delete(id) }
    fun deleteFile(id: String) = mutate { files.delete(id) }

    fun renameFile(id: String, name: String) = mutateWithConflict { oc -> files.rename(id, name.trim(), oc) }
    fun moveFile(id: String, folderId: String?) = mutateWithConflict { oc -> files.move(id, folderId, oc) }
    fun moveFolder(id: String, parentId: String?) = mutateWithConflict { oc -> folders.move(id, parentId, oc) }

    fun setFileExpiry(id: String, expiresAt: String?) = mutate { files.setExpiry(id, expiresAt) }
    fun setFolderExpiry(id: String, expiresAt: String?) = mutate { folders.setExpiry(id, expiresAt) }

    fun toggleFavorite(id: String) = mutate {
        val current = (_state.value.files + _state.value.favoriteFiles)
            .find { it.id == id }?.is_favorite ?: false
        files.setFavorite(id, !current)
    }

    val share = ShareController(shares, viewModelScope)

    fun upload(uri: Uri) = upload(listOf(uri))

    private fun maybeExtractKeywords(file: com.cloudcast.app.data.network.FileDto) {
        viewModelScope.launch {
            runCatching {
                if (files.aiPreferences().semantic_search) {
                    files.extractKeywords(file.id, file.wrapped_dek)
                }
            }
        }
    }

    private fun maybeEmbed(file: com.cloudcast.app.data.network.FileDto) {
        when (contentKind(file.mime_type, file.original_name)) {
            ContentKind.TEXT, ContentKind.CODE, ContentKind.IMAGE -> Unit
            else -> return
        }
        viewModelScope.launch {
            runCatching {
                if (files.aiPreferences().semantic_search) {
                    files.embedFile(file.id, file.wrapped_dek)

                    runCatching { files.extractKeywords(file.id, file.wrapped_dek) }
                }
            }
        }
    }

    fun upload(uris: List<Uri>) {
        if (uris.isEmpty()) return
        _state.update { it.copy(uploading = true, error = null, filedNotice = null) }
        viewModelScope.launch {
            try {
                val parent = _state.value.currentParentId
                val mode = if (parent == null) currentFilingMode() else AutoFileMode.OFF

                var filed: Map<String, Int> = emptyMap()
                when (mode) {
                    AutoFileMode.OFF -> {

                        val memory = ConflictMemory()
                        val bulk = uris.size > 1
                        for (uri in uris) {
                            var uploaded: com.cloudcast.app.data.network.FileDto? = null
                            runWithConflict(bulk = bulk, memory) { oc ->
                                uploaded = files.upload(uri, parent, oc)
                            }
                            uploaded?.let { maybeEmbed(it) }
                        }
                    }
                    AutoFileMode.TYPE -> filed = uploadAutoFiled(uris)
                    AutoFileMode.SMART -> filed = uploadSmartFiled(uris)
                }
                reloadAll()
                _state.update {
                    it.copy(uploading = false, smartFiling = false, filedNotice = filedSummary(filed))
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Upload failed"), uploading = false, smartFiling = false) }
            }
        }
    }

    private suspend fun uploadAutoFiled(uris: List<Uri>): Map<String, Int> {

        val targets: List<Pair<Uri, String?>> = uris.map { uri ->
            uri to autoFileTarget(files.mimeOf(uri), files.nameOf(uri))
        }

        val resolved = HashMap<String, String?>()
        var cancelled = false

        fun findTopLevel(name: String): com.cloudcast.app.data.network.FolderDto? =
            _state.value.allFolders.firstOrNull {
                it.parent_id == null && it.name.equals(name, ignoreCase = true)
            }

        val distinctTargets = targets.mapNotNull { it.second }.distinct()
        for (target in distinctTargets) {
            if (cancelled) break
            val existing = findTopLevel(target)
            if (existing != null) {
                resolved[target] = existing.id
                continue
            }

            val count = targets.count { it.second == target }
            when (val choice = askAutoFile(target, count)) {
                AutoFileChoice.CANCEL -> { cancelled = true }
                AutoFileChoice.HERE -> { resolved[target] = null }
                AutoFileChoice.CREATE -> {
                    val created = folders.create(target, null, null)
                    resolved[target] = created.id

                    _state.update { it.copy(allFolders = it.allFolders + created) }
                }
            }
        }

        if (cancelled) return emptyMap()

        val filed = LinkedHashMap<String, Int>()
        val memory = ConflictMemory()
        val bulk = uris.size > 1
        for ((uri, target) in targets) {

            val folderId = if (target == null) null else resolved[target]
            var uploaded: com.cloudcast.app.data.network.FileDto? = null
            runWithConflict(bulk = bulk, memory) { oc ->
                uploaded = files.upload(uri, folderId, oc)
            }

            if (uploaded != null && target != null && folderId != null) {
                filed[target] = (filed[target] ?: 0) + 1
            }

            uploaded?.let { maybeEmbed(it) }
        }
        return filed
    }

    private suspend fun currentFilingMode(): AutoFileMode {
        files.clearAiCaches()
        val mode = runCatching { AutoFileMode.fromKey(files.aiPreferences().auto_file_mode) }
            .getOrElse { return _state.value.autoFileMode }
        _state.update { it.copy(autoFileMode = mode) }
        return mode
    }

    private suspend fun uploadSmartFiled(uris: List<Uri>): Map<String, Int> {
        _state.update { it.copy(smartFiling = true) }
        val filed = LinkedHashMap<String, Int>()
        val memory = ConflictMemory()
        val bulk = uris.size > 1

        fun findTopLevel(name: String): com.cloudcast.app.data.network.FolderDto? =
            _state.value.allFolders.firstOrNull {
                it.parent_id == null && it.name.equals(name, ignoreCase = true)
            }

        fun nameToDecision(name: String): FilingDecision {
            if (name.isBlank()) return FilingDecision.Root
            val existing = findTopLevel(name)
                ?: findMatchingFolder(_state.value.allFolders, name)
            return if (existing != null) FilingDecision.Existing(existing.id) else FilingDecision.New(name)
        }

        val centroids = runCatching { files.folderCentroids() }.getOrDefault(emptyMap())

        val rows = mutableListOf<FilingRow>()
        for (uri in uris) {
            var uploaded: com.cloudcast.app.data.network.FileDto? = null
            runWithConflict(bulk = bulk, memory) { oc ->
                uploaded = files.upload(uri, null, oc)
            }
            val file = uploaded ?: continue

            var suggestedName: String? = null
            var decision: FilingDecision? = null
            try {
                val suggestion = files.suggestFiling(file.id, file.wrapped_dek)
                suggestedName = suggestion.suggestedName.takeIf { it.isNotBlank() }
                val matched = bestFolderMatch(suggestion.embedding, centroids)
                decision = if (matched != null) FilingDecision.Existing(matched) else null
            } catch (_: Exception) {
            }
            maybeExtractKeywords(file)

            val target = suggestedName ?: autoFileTarget(file.mime_type, file.original_name)
            val proposal = decision ?: nameToDecision(target ?: "")
            rows += FilingRow(
                fileId = file.id,
                fileName = file.original_name,
                suggestedName = target ?: "",
                decision = proposal,
            )
        }
        if (rows.isEmpty()) return filed

        val confirmed = askFilingReview(rows) ?: return filed

        val createdByName = HashMap<String, String>()
        for (row in confirmed) {
            val folderId: String? = when (val d = row.decision) {
                is FilingDecision.Existing -> d.folderId
                is FilingDecision.Root -> null
                is FilingDecision.New -> {
                    val key = d.name.trim().lowercase()
                    createdByName[key] ?: run {
                        val existing = findTopLevel(d.name)
                        val id = existing?.id ?: folders.create(d.name.trim(), null, null).also { created ->
                            _state.update { it.copy(allFolders = it.allFolders + created) }
                        }.id
                        createdByName[key] = id
                        id
                    }
                }
            } ?: continue

            runWithConflict(bulk = bulk, memory) { oc ->
                files.move(row.fileId, folderId, oc)
            }
            _state.value.allFolders.firstOrNull { it.id == folderId }?.name?.let {
                filed[it] = (filed[it] ?: 0) + 1
            }
        }
        return filed
    }
    fun filedNoticeShown() {
        _state.update { it.copy(filedNotice = null) }
    }

    private fun filedSummary(filed: Map<String, Int>): String? {
        if (filed.isEmpty()) return null
        val total = filed.values.sum()
        val files = if (total == 1) "1 file" else "$total files"
        val top = filed.maxByOrNull { it.value }!!.key
        val others = filed.size - 1
        return when (others) {
            0 -> "$files filed into $top"
            1 -> "$files filed into $top and 1 other folder"
            else -> "$files filed into $top and $others other folders"
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

    fun downloadSelectedZip(dest: Uri) {
        val snapshot = _state.value
        val selectedFiles = (snapshot.files + snapshot.favoriteFiles)
            .distinctBy { it.id }
            .filter { it.id in snapshot.selectedFileIds }
            .map { it.id to it.original_name }
        val selectedFolders = snapshot.allFolders
            .filter { it.id in snapshot.selectedFolderIds }
            .map { it.id to it.name }
        if (selectedFiles.isEmpty() && selectedFolders.isEmpty()) return
        _state.update { it.copy(zipping = true) }
        viewModelScope.launch {
            try {
                files.saveArchive(selectedFiles, selectedFolders, dest)
                clearSelection()
                _state.update { it.copy(zipping = false) }
            } catch (e: Exception) {
                _state.update { it.copy(zipping = false, error = friendlyError(e, "Download failed")) }
            }
        }
    }

    fun downloadSelectedIndividually(treeUri: Uri) {
        val snapshot = _state.value
        val targets = (snapshot.files + snapshot.favoriteFiles)
            .distinctBy { it.id }
            .filter { it.id in snapshot.selectedFileIds }
        if (targets.isEmpty()) return
        viewModelScope.launch {
            var failures = 0
            for (file in targets) {
                try {
                    files.saveContentInto(treeUri, file.original_name, file.mime_type, file.id)
                } catch (e: Exception) {
                    failures++
                }
            }
            clearSelection()
            if (failures > 0) {
                _state.update { it.copy(error = "$failures file(s) couldn't be saved.") }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            auth.logout()
            _loggedOut.value = true
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

    fun toggleFileSelected(id: String) {
        _state.update {
            val next = if (id in it.selectedFileIds) it.selectedFileIds - id else it.selectedFileIds + id
            it.copy(selectedFileIds = next, selectionMode = true)
        }
    }

    fun toggleFolderSelected(id: String) {
        _state.update {
            val next = if (id in it.selectedFolderIds) it.selectedFolderIds - id else it.selectedFolderIds + id
            it.copy(selectedFolderIds = next, selectionMode = true)
        }
    }

    fun selectAll() {
        _state.update {
            it.copy(
                selectedFileIds = it.selectableFileIds,
                selectedFolderIds = it.selectableFolderIds,
                selectionMode = true,
            )
        }
    }

    fun clearSelection() {
        _state.update {
            it.copy(selectionMode = false, selectedFileIds = emptySet(), selectedFolderIds = emptySet())
        }
    }

    fun deleteSelected() {
        val snapshot = _state.value
        val fileIds = snapshot.selectedFileIds.toList()
        val folderIds = snapshot.selectedFolderIds.toList()
        if (fileIds.isEmpty() && folderIds.isEmpty()) return
        _state.update { it.copy(bulkDeleting = true, error = null) }
        viewModelScope.launch {
            var failures = 0
            for (id in fileIds) {
                try { files.delete(id) } catch (e: Exception) { failures++ }
            }
            for (id in folderIds) {
                try { folders.delete(id) } catch (e: Exception) { failures++ }
            }
            try {
                val v = loadVault()
                _state.update {
                    it.copy(
                        allFolders = v.folders,
                        files = v.files,
                        favoriteFiles = v.favorites,
                        bulkDeleting = false,
                        selectionMode = false,
                        selectedFileIds = emptySet(),
                        selectedFolderIds = emptySet(),
                        error = if (failures > 0) "$failures item(s) couldn't be deleted." else null,
                    )
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        bulkDeleting = false,
                        selectionMode = false,
                        selectedFileIds = emptySet(),
                        selectedFolderIds = emptySet(),
                        error = friendlyError(e, "Couldn't refresh after delete"),
                    )
                }
            }
        }
    }

    fun moveSelected(destFolderId: String?) {
        val snapshot = _state.value
        val fileIds = snapshot.selectedFileIds.toList()
        val folderIds = snapshot.selectedFolderIds.toList()
        if (fileIds.isEmpty() && folderIds.isEmpty()) return
        _state.update { it.copy(bulkMoving = true, error = null) }
        viewModelScope.launch {
            val memory = ConflictMemory()
            var failures = 0
            for (id in fileIds) {
                try { runWithConflict(bulk = true, memory) { oc -> files.move(id, destFolderId, oc) } }
                catch (e: Exception) { failures++ }
            }
            for (id in folderIds) {
                try { runWithConflict(bulk = true, memory) { oc -> folders.move(id, destFolderId, oc) } }
                catch (e: Exception) { failures++ }
            }
            try { reloadAll() } catch (_: Exception) {  }
            _state.update {
                it.copy(
                    bulkMoving = false,
                    selectionMode = false,
                    selectedFileIds = emptySet(),
                    selectedFolderIds = emptySet(),
                    error = if (failures > 0) "$failures item(s) couldn't be moved." else null,
                )
            }
        }
    }

    private enum class AutoFileChoice { CREATE, HERE, CANCEL }

    private var pendingAutoFile: CompletableDeferred<AutoFileChoice>? = null

    private var pendingFiling: CompletableDeferred<List<FilingRow>?>? = null

    fun resolveFiling(rows: List<FilingRow>) {
        _state.update { it.copy(filingReview = null) }
        pendingFiling?.complete(rows)
        pendingFiling = null
    }

    fun cancelFiling() {
        _state.update { it.copy(filingReview = null) }
        pendingFiling?.complete(null)
        pendingFiling = null
    }

    private suspend fun askFilingReview(rows: List<FilingRow>): List<FilingRow>? {
        val deferred = CompletableDeferred<List<FilingRow>?>()
        pendingFiling = deferred
        _state.update { it.copy(filingReview = rows) }
        return deferred.await()
    }

    fun resolveAutoFile(create: Boolean) {
        _state.update { it.copy(autoFilePrompt = null) }
        pendingAutoFile?.complete(if (create) AutoFileChoice.CREATE else AutoFileChoice.HERE)
        pendingAutoFile = null
    }

    fun cancelAutoFile() {
        _state.update { it.copy(autoFilePrompt = null) }
        pendingAutoFile?.complete(AutoFileChoice.CANCEL)
        pendingAutoFile = null
    }

    private suspend fun askAutoFile(targetName: String, count: Int): AutoFileChoice {
        val deferred = CompletableDeferred<AutoFileChoice>()
        pendingAutoFile = deferred
        _state.update { it.copy(autoFilePrompt = AutoFilePrompt(targetName, count)) }
        return deferred.await()
    }

    private class ConflictMemory { var current: Pair<String, Boolean>? = null }

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

    private suspend fun askConflict(info: ConflictInfo, bulk: Boolean): Pair<String, Boolean>? {
        val deferred = CompletableDeferred<Pair<String, Boolean>?>()
        pendingConflict = deferred
        _state.update { it.copy(conflict = ConflictPrompt(info, bulk)) }
        return deferred.await()
    }

    private suspend fun runWithConflict(
        bulk: Boolean,
        memory: ConflictMemory,
        op: suspend (onConflict: String?) -> Unit,
    ): Boolean {
        try {
            op(null)
            return true
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

            val choice = memory.current ?: run {
                val picked = askConflict(info, bulk) ?: return false
                if (picked.second) memory.current = picked
                picked
            }
            if (choice.first == "skip") return false
            op(choice.first)
            return true
        }
    }

    private class AppException(message: String?) : Exception(message)

    private data class VaultSnapshot(
        val folders: List<FolderDto>,
        val files: List<FileDto>,
        val favorites: List<FileDto>,
    )

    private suspend fun loadVault(): VaultSnapshot = coroutineScope {
        val parent = _state.value.currentParentId
        val folderJob = async { folders.list() }

        val fileJob = async { files.list(parent, all = parent == null) }
        val tree = folderJob.await()
        val everything = fileJob.await()

        VaultSnapshot(
            folders = tree,
            files = if (parent == null) everything.filter { it.folder_id == null } else everything,
            favorites = if (parent == null) everything.filter { it.is_favorite } else emptyList(),
        )
    }

    private suspend fun reloadAll() {
        val v = loadVault()
        _state.update {
            it.copy(allFolders = v.folders, files = v.files, favoriteFiles = v.favorites)
        }
    }

    private fun mutateWithConflict(op: suspend (onConflict: String?) -> Unit) {
        viewModelScope.launch {
            try {
                runWithConflict(bulk = false, ConflictMemory(), op)
                reloadAll()
                _state.update { it.copy(error = null) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Something went wrong")) }
            }
        }
    }

    private fun mutate(block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
                val v = loadVault()
                _state.update {
                    it.copy(
                        allFolders = v.folders,
                        files = v.files,
                        favoriteFiles = v.favorites,
                        error = null,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Something went wrong")) }
            }
        }
    }
}

class FilesViewModelFactory(
    private val folders: FolderRepository,
    private val files: FileRepository,
    private val shares: ShareRepository,
    private val auth: AuthRepository,
    private val events: EventStream,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        FilesViewModel(folders, files, shares, auth, events) as T
}
