package com.cloudcast.app.ui.files

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.ui.common.BottomNavBar
import com.cloudcast.app.ui.common.BottomTab
import com.cloudcast.app.ui.common.ConfirmDialog
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.NameInputDialog
import com.cloudcast.app.ui.common.SectionHeading
import com.cloudcast.app.ui.folders.FolderRow
import com.cloudcast.app.ui.notifications.NotificationsViewModel
import com.cloudcast.app.ui.sharing.ExpiryDialog
import com.cloudcast.app.ui.sharing.ShareDialog
import com.cloudcast.app.ui.uploads.FilingReviewDialog
import com.cloudcast.app.ui.uploads.AutoFileDialog
import com.cloudcast.app.ui.uploads.ConflictDialog
import com.cloudcast.app.ui.uploads.NewFab
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilesScreen(
    viewModel: FilesViewModel,
    notificationsViewModel: NotificationsViewModel,
    onLoggedOut: () -> Unit,
    onOpenFile: (String) -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSharedWithMe: () -> Unit,
    onOpenExpiring: () -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenSearch: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val loggedOut by viewModel.loggedOut.collectAsStateWithLifecycle()

    var sortKey by rememberSaveable { mutableStateOf(SortKey.DATE) }
    var sortAscending by rememberSaveable { mutableStateOf(false) }
    val onSortSelect: (SortKey) -> Unit = { key ->
        if (key == sortKey) sortAscending = !sortAscending
        else { sortKey = key; sortAscending = defaultAscending(key) }
    }
    val sortedFiles = remember(state.files, sortKey, sortAscending) {
        sortFiles(state.files, sortKey, sortAscending)
    }
    val sortedFolders = remember(state.visibleFolders, sortKey, sortAscending) {
        sortFolders(state.visibleFolders, sortKey, sortAscending)
    }

    val dragState = remember { RowDragState() }
    var contentOrigin by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    val onDropToFolder: (String) -> Unit = { folderId ->
        if (folderId !in state.selectedFolderIds) viewModel.moveSelected(folderId)
    }

    var showCreate by remember { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<FolderDto?>(null) }
    var deleteTarget by remember { mutableStateOf<FolderDto?>(null) }
    var moveTarget by remember { mutableStateOf<FileDto?>(null) }
    var moveFolderTarget by remember { mutableStateOf<FolderDto?>(null) }
    var downloadTarget by remember { mutableStateOf<FileDto?>(null) }
    var renameFileTarget by remember { mutableStateOf<FileDto?>(null) }
    var expiryFileTarget by remember { mutableStateOf<FileDto?>(null) }
    var expiryFolderTarget by remember { mutableStateOf<FolderDto?>(null) }
    var showBulkDelete by remember { mutableStateOf(false) }
    var showBulkMove by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }

    val pickFile = rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris -> if (uris.isNotEmpty()) viewModel.upload(uris) }

    val saveLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("*/*")
    ) { uri -> if (uri != null) downloadTarget?.let { viewModel.download(it.id, uri) }; downloadTarget = null }

    val zipLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri -> if (uri != null) viewModel.downloadSelectedZip(uri) }

    val treeLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri -> if (uri != null) viewModel.downloadSelectedIndividually(uri) }

    LaunchedEffect(loggedOut) { if (loggedOut) onLoggedOut() }

    LaunchedEffect(state.filedNotice) {
        state.filedNotice?.let { snackbar.showSnackbar(it); viewModel.filedNoticeShown() }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { if (!state.selectionMode) viewModel.refreshOnResume() }

    BackHandler(enabled = state.selectionMode) { viewModel.clearSelection() }
    BackHandler(enabled = !state.selectionMode && !state.atRoot) { viewModel.goUp() }

    Scaffold(
        topBar = {
            if (state.selectionMode) {
                SelectionToolbar(
                    selectedCount = state.selectedCount,
                    allSelected = state.allSelected,
                    folderSelected = state.selectedFolderIds.isNotEmpty(),
                    onClear = { viewModel.clearSelection() },
                    onToggleSelectAll = {
                        if (state.allSelected) viewModel.clearSelection() else viewModel.selectAll()
                    },
                    onMove = { showBulkMove = true },
                    onDelete = { showBulkDelete = true },
                    onDownloadZip = { zipLauncher.launch("cloudcast-${java.time.LocalDate.now()}.zip") },
                    onDownloadIndividual = { treeLauncher.launch(null) },
                    zipping = state.zipping,
                )
            } else {
                TabTopBar(
                    title = state.currentFolder?.name ?: "My Files",
                    sortKey = sortKey,
                    sortAscending = sortAscending,
                    onSortSelect = onSortSelect,
                    onBack = if (!state.atRoot) ({ viewModel.goUp() }) else null,
                    onOpenSearch = onOpenSearch,
                    onOpenProfile = onOpenProfile,
                    notificationsViewModel = notificationsViewModel,
                    onOpenFile = onOpenFile,
                    onOpenShared = onOpenSharedWithMe,
                )
            }
        },
        bottomBar = {

            if (!state.selectionMode) {
                BottomNavBar(
                    selected = BottomTab.FILES,
                    onSelect = { tab ->
                        when (tab) {
                            BottomTab.FILES -> Unit
                            BottomTab.FAVOURITES -> onOpenFavorites()
                            BottomTab.SHARED -> onOpenSharedWithMe()
                            BottomTab.EXPIRING -> onOpenExpiring()
                        }
                    },
                )
            }
        },
        floatingActionButton = {

            if (!state.selectionMode) {
                NewFab(
                    enabled = !(state.uploading || state.smartFiling),
                    onNewFolder = { showCreate = true },
                    onUpload = { pickFile.launch("*/*") },
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .onGloballyPositioned { contentOrigin = it.positionInRoot() },
        ) {
            when {
                state.loading && state.allFolders.isEmpty() && state.files.isEmpty() -> {
                    CircularProgressIndicator(Modifier.align(Alignment.Center))
                }
                state.error != null && state.isEmpty -> {
                    ErrorText(state.error!!, modifier = Modifier.align(Alignment.Center))
                }
                state.isEmpty -> {
                    EmptyFilesState(
                        atRoot = state.atRoot,
                        onUpload = { pickFile.launch("*/*") },
                        uploading = state.uploading || state.smartFiling,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
                else -> {

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 88.dp),
                    ) {
                        if (state.visibleFolders.isNotEmpty()) {
                            item { SectionHeading("Folders") }
                        }
                        items(sortedFolders, key = { "folder-${it.id}" }) { folder ->
                            val selected = state.isFolderSelected(folder.id)
                            val rowMod = Modifier
                                .folderDropBounds(dragState, folder.id)
                                .let { if (selected) it.draggableSelectedRow(dragState, state.selectedCount, onDropToFolder) else it }
                            FolderRow(
                                folder = folder,
                                onOpen = { viewModel.openFolder(folder.id) },
                                onCreateSubfolder = { showCreate = true },
                                onRename = { renameTarget = folder },
                                onMove = { moveFolderTarget = folder },
                                onDelete = { deleteTarget = folder },
                                onSetExpiry = { expiryFolderTarget = folder },
                                onShare = { viewModel.share.openForFolder(folder.id, folder.name) },
                                selectionMode = state.selectionMode,
                                selected = selected,
                                onLongPress = { viewModel.startSelection(folderId = folder.id) },
                                onToggleSelect = { viewModel.toggleFolderSelected(folder.id) },
                                isDropTarget = dragState.active &&
                                    dragState.hoveredFolderId == folder.id &&
                                    folder.id !in state.selectedFolderIds,
                                modifier = rowMod,
                            )
                        }
                        if (sortedFiles.isNotEmpty()) {
                            item { SectionHeading("Files") }
                            items(sortedFiles, key = { "file-${it.id}" }) { file ->
                                val selected = state.isFileSelected(file.id)
                                FileRow(
                                    file = file,
                                    onOpen = { onOpenFile(file.id) },
                                    onToggleFavorite = { viewModel.toggleFavorite(file.id) },
                                    onDownload = { downloadTarget = file; saveLauncher.launch(file.original_name) },
                                    onMove = { moveTarget = file },
                                    onDelete = { viewModel.deleteFile(file.id) },
                                    onRename = { renameFileTarget = file },
                                    onSetExpiry = { expiryFileTarget = file },
                                    onShare = { viewModel.share.openForFile(file.id, file.original_name) },
                                    selectionMode = state.selectionMode,
                                    selected = selected,
                                    onLongPress = { viewModel.startSelection(fileId = file.id) },
                                    onToggleSelect = { viewModel.toggleFileSelected(file.id) },
                                    modifier = if (selected) {
                                        Modifier.draggableSelectedRow(dragState, state.selectedCount, onDropToFolder)
                                    } else {
                                        Modifier
                                    },
                                )
                            }
                        }
                    }
                }
            }

            if (dragState.active) {
                Surface(
                    color = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier.offset {
                        IntOffset(
                            (dragState.pointer.x - contentOrigin.x + 24f).roundToInt(),
                            (dragState.pointer.y - contentOrigin.y - 48f).roundToInt(),
                        )
                    },
                ) {
                    Text(
                        "Move ${dragState.badgeCount}",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }

            if (state.smartFiling) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    ) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.size(8.dp))
                        Text("Smart-filing uploads\u2026")
                    }
                }
            }
        }
    }

    if (showBulkDelete) {
        ConfirmDialog(
            title = "Delete selected?",
            message = "${state.selectedCount} item(s) will be permanently deleted. Folders delete everything inside them.",
            confirmLabel = "Delete",
            onConfirm = { viewModel.deleteSelected(); showBulkDelete = false },
            onDismiss = { showBulkDelete = false },
        )
    }

    if (showCreate) {
        NameInputDialog(
            title = "New folder",
            confirmLabel = "Create",
            initialName = "",
            fieldLabel = "Folder name",
            onConfirm = { name -> viewModel.createFolder(name); showCreate = false },
            onDismiss = { showCreate = false },
        )
    }

    renameTarget?.let { target ->
        NameInputDialog(
            title = "Rename folder",
            confirmLabel = "Rename",
            initialName = target.name,
            fieldLabel = "Folder name",
            onConfirm = { name -> viewModel.renameFolder(target.id, name); renameTarget = null },
            onDismiss = { renameTarget = null },
        )
    }

    renameFileTarget?.let { target ->
        NameInputDialog(
            title = "Rename file",
            confirmLabel = "Rename",
            initialName = target.original_name,
            fieldLabel = "File name",
            onConfirm = { name -> viewModel.renameFile(target.id, name); renameFileTarget = null },
            onDismiss = { renameFileTarget = null },
        )
    }

    deleteTarget?.let { target ->
        ConfirmDialog(
            title = "Delete folder?",
            message = "\"${target.name}\" and everything inside it will be permanently deleted.",
            confirmLabel = "Delete",
            onConfirm = { viewModel.deleteFolder(target.id); deleteTarget = null },
            onDismiss = { deleteTarget = null },
        )
    }

    moveTarget?.let { target ->
        MoveFileDialog(
            folders = state.allFolders,
            currentFolderId = target.folder_id,
            fileName = target.original_name,
            onMove = { folderId -> viewModel.moveFile(target.id, folderId); moveTarget = null },
            onDismiss = { moveTarget = null },
        )
    }

    expiryFileTarget?.let { target ->
        ExpiryDialog(
            itemName = target.original_name,
            currentExpiresAt = target.expires_at,
            onConfirm = { iso -> viewModel.setFileExpiry(target.id, iso); expiryFileTarget = null },
            onDismiss = { expiryFileTarget = null },
        )
    }

    expiryFolderTarget?.let { target ->
        ExpiryDialog(
            itemName = target.name,
            currentExpiresAt = target.expires_at,
            onConfirm = { iso -> viewModel.setFolderExpiry(target.id, iso); expiryFolderTarget = null },
            onDismiss = { expiryFolderTarget = null },
        )
    }

    val shareState by viewModel.share.state.collectAsStateWithLifecycle()
    shareState.target?.let { target ->
        ShareDialog(
            itemName = target.name,
            shares = shareState.shares,
            loading = shareState.loading,
            busy = shareState.busy,
            error = shareState.error,
            contacts = shareState.contacts,
            onAddShare = viewModel.share::add,
            onRevoke = viewModel.share::revoke,
            onChangePermission = viewModel.share::changePermission,
            onChangeExpiry = viewModel.share::changeExpiry,
            onSetExpiryForAll = viewModel.share::setExpiryForAll,
            onStopSharing = viewModel.share::unshareAll,
            onDismiss = viewModel.share::dismiss,
        )
    }

    fun descendantIds(folders: List<FolderDto>, rootId: String): Set<String> {
        val children = folders.filter { it.parent_id == rootId }.map { it.id }
        return children.toSet() + children.flatMap { descendantIds(folders, it) }
    }

    moveFolderTarget?.let { target ->
        val excluded = setOf(target.id) + descendantIds(state.allFolders, target.id)
        MoveFolderDialog(
            folders = state.allFolders.filterNot { it.id in excluded },
            currentParentId = target.parent_id,
            folderName = target.name,
            onMove = { parentId -> viewModel.moveFolder(target.id, parentId); moveFolderTarget = null },
            onDismiss = { moveFolderTarget = null },
        )
    }

    if (showBulkMove) {
        val excluded = state.selectedFolderIds +
            state.selectedFolderIds.flatMap { descendantIds(state.allFolders, it) }
        MoveFolderDialog(
            folders = state.allFolders.filterNot { it.id in excluded },
            currentParentId = state.currentParentId,
            folderName = "${state.selectedCount} item(s)",
            onMove = { parentId -> viewModel.moveSelected(parentId); showBulkMove = false },
            onDismiss = { showBulkMove = false },
        )
    }

    state.conflict?.let { prompt ->
        ConflictDialog(
            prompt = prompt,
            onResolve = { action, applyAll -> viewModel.resolveConflict(action, applyAll) },
            onDismiss = { viewModel.cancelConflict() },
        )
    }

    state.autoFilePrompt?.let { prompt ->
        AutoFileDialog(
            prompt = prompt,
            onCreate = { viewModel.resolveAutoFile(create = true) },
            onHere = { viewModel.resolveAutoFile(create = false) },
            onCancel = { viewModel.cancelAutoFile() },
        )
    }

    state.filingReview?.let { rows ->
        FilingReviewDialog(
            rows = rows,
            folders = state.allFolders,
            onApply = { confirmed -> viewModel.resolveFiling(confirmed) },
            onDismiss = { viewModel.cancelFiling() },
        )
    }

}
