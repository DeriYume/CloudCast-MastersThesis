package com.cloudcast.app.ui.virtualfolders

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.core.SharePermissions
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.ui.files.FileRow
import com.cloudcast.app.ui.folders.FolderRow
import com.cloudcast.app.ui.common.ConfirmDialog
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.SectionHeading
import com.cloudcast.app.ui.files.SortKey
import com.cloudcast.app.ui.files.TabTopBar
import com.cloudcast.app.ui.files.defaultAscending
import com.cloudcast.app.ui.files.sortFiles
import com.cloudcast.app.ui.files.sortFolders
import com.cloudcast.app.ui.notifications.NotificationsViewModel
import com.cloudcast.app.ui.sharing.ExpiryDialog
import com.cloudcast.app.ui.sharing.ShareDialog

@Composable
fun VirtualFolderScreen(
    title: String,
    emptyMessage: String,
    viewModel: VirtualFolderViewModel,
    onBack: () -> Unit,
    onOpenFile: (String) -> Unit,

    canBrowseFolders: Boolean = false,

    incoming: Boolean = false,

    sharedByMe: Boolean = false,

    bottomBar: @Composable () -> Unit = {},

    isRootTab: Boolean = false,

    onOpenSearch: (() -> Unit)? = null,
    onOpenProfile: (() -> Unit)? = null,
    notificationsViewModel: NotificationsViewModel? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var downloadTarget by remember { mutableStateOf<FileDto?>(null) }
    var shareConfirm by remember { mutableStateOf<ShareConfirm?>(null) }
    var bulkConfirm by remember { mutableStateOf<BulkConfirm?>(null) }
    var bulkExpiryOpen by remember { mutableStateOf(false) }

    var rowExpiry by remember { mutableStateOf<RowExpiry?>(null) }
    val snackbar = remember { SnackbarHostState() }

    val selectionEnabled = incoming || sharedByMe

    var sortKey by rememberSaveable { mutableStateOf(SortKey.DATE) }
    var sortAscending by rememberSaveable { mutableStateOf(false) }
    val onSortSelect: (SortKey) -> Unit = { key ->
        if (key == sortKey) sortAscending = !sortAscending
        else { sortKey = key; sortAscending = defaultAscending(key) }
    }
    val sortedFolders = remember(state.folders, sortKey, sortAscending) {
        sortFolders(state.folders, sortKey, sortAscending)
    }
    val sortedFiles = remember(state.files, sortKey, sortAscending) {
        sortFiles(state.files, sortKey, sortAscending)
    }

    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.messageShown() }
    }

    val saveLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("*/*")
    ) { uri -> if (uri != null) downloadTarget?.let { viewModel.download(it.id, uri) }; downloadTarget = null }

    val bulkZipLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri -> if (uri != null) viewModel.downloadSelectedZip(uri) }

    val bulkTreeLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri -> if (uri != null) viewModel.downloadSelectedIndividually(uri) }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refreshOnResume() }

    BackHandler(enabled = state.selectionMode) { viewModel.clearSelection() }

    BackHandler(enabled = state.inFolder && !state.selectionMode) { viewModel.goBack() }

    Scaffold(
        topBar = {
            if (state.selectionMode) {
                SharedSelectionToolbar(
                    selectedCount = state.selectedCount,
                    allSelected = state.allSelected,
                    incoming = incoming,
                    canSave = state.allSelectedCanSave,
                    canDownload = state.allSelectedCanDownload,
                    folderSelected = state.selectedFolderIds.isNotEmpty(),
                    busy = state.bulkBusy,
                    onClear = viewModel::clearSelection,
                    onToggleSelectAll = {
                        if (state.allSelected) viewModel.clearSelection() else viewModel.selectAll()
                    },
                    onSave = viewModel::bulkSaveToCloud,
                    onDownloadZip = {
                        bulkZipLauncher.launch("cloudcast-${java.time.LocalDate.now()}.zip")
                    },
                    onDownloadIndividual = { bulkTreeLauncher.launch(null) },
                    onRemove = { bulkConfirm = BulkConfirm(leaving = true, count = state.selectedCount) },
                    onSetExpiry = { bulkExpiryOpen = true },
                    onStopSharing = { bulkConfirm = BulkConfirm(leaving = false, count = state.selectedCount) },
                )
            } else {
                TabTopBar(
                    title = if (state.inFolder) (state.currentTitle ?: title) else title,
                    sortKey = sortKey,
                    sortAscending = sortAscending,
                    onSortSelect = onSortSelect,

                    onBack = if (isRootTab && !state.inFolder) null
                             else ({ if (!viewModel.goBack()) onBack() }),
                    onOpenSearch = onOpenSearch,
                    onOpenProfile = onOpenProfile,
                    notificationsViewModel = notificationsViewModel,
                    onOpenFile = onOpenFile,
                )
            }
        },
        bottomBar = bottomBar,
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.error != null && state.isEmpty ->
                    ErrorText(state.error!!, modifier = Modifier.align(Alignment.Center))
                state.isEmpty -> Text(
                    if (state.inFolder) "This folder is empty." else emptyMessage,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.Center),
                )
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    if (sortedFolders.isNotEmpty()) {
                        item { SectionHeading("Folders") }
                        items(sortedFolders, key = { "vfolder-${it.id}" }) { folder ->

                            FolderRow(
                                folder = folder,

                                onOpen = { if (canBrowseFolders) viewModel.openFolder(folder) },
                                selectionMode = state.selectionMode,
                                selected = state.isFolderSelected(folder.id),
                                onLongPress = if (selectionEnabled) {
                                    ({ viewModel.startSelection(folderId = folder.id) })
                                } else {
                                    null
                                },
                                onToggleSelect = { viewModel.toggleFolder(folder.id) },

                                onRemoveFromMyList = if (incoming) {
                                    ({ shareConfirm = ShareConfirm(folder.id, folder.name, isFolder = true, leaving = true) })
                                } else {
                                    null
                                },
                                onStopSharing = if (sharedByMe) {
                                    ({ shareConfirm = ShareConfirm(folder.id, folder.name, isFolder = true, leaving = false) })
                                } else {
                                    null
                                },

                                onShare = if (sharedByMe) {
                                    ({ viewModel.share.openForFolder(folder.id, folder.name) })
                                } else {
                                    null
                                },
                                onSetExpiry = if (sharedByMe) {
                                    ({ rowExpiry = RowExpiry(folder.id, folder.name, isFolder = true) })
                                } else {
                                    null
                                },
                            )
                        }
                    }
                    if (sortedFiles.isNotEmpty()) {
                        item { SectionHeading("Files") }
                        items(sortedFiles, key = { "vfile-${it.id}" }) { file ->

                            val perm = file.permission
                            val canDownload = !incoming || SharePermissions.canDownload(perm)
                            val canSave = incoming && SharePermissions.canSave(perm)
                            FileRow(
                                file = file,

                                onOpen = { onOpenFile(file.id) },
                                selectionMode = state.selectionMode,
                                selected = state.isFileSelected(file.id),
                                onLongPress = if (selectionEnabled) {
                                    ({ viewModel.startSelection(fileId = file.id) })
                                } else {
                                    null
                                },
                                onToggleSelect = { viewModel.toggleFile(file.id) },
                                onDownload = { downloadTarget = file; saveLauncher.launch(file.original_name) },

                                onToggleFavorite = if (incoming) {
                                    null
                                } else {
                                    ({ viewModel.toggleFavorite(file.id) })
                                },

                                showDownload = canDownload,
                                onSave = if (canSave) ({ viewModel.saveToCloud(file.id) }) else null,
                                onRemoveFromMyList = if (incoming) {
                                    ({ shareConfirm = ShareConfirm(file.id, file.original_name, isFolder = false, leaving = true) })
                                } else {
                                    null
                                },
                                onStopSharing = if (sharedByMe) {
                                    ({ shareConfirm = ShareConfirm(file.id, file.original_name, isFolder = false, leaving = false) })
                                } else {
                                    null
                                },

                                onShare = if (sharedByMe) {
                                    ({ viewModel.share.openForFile(file.id, file.original_name) })
                                } else {
                                    null
                                },
                                onSetExpiry = if (sharedByMe) {
                                    ({ rowExpiry = RowExpiry(file.id, file.original_name, isFolder = false) })
                                } else {
                                    null
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    shareConfirm?.let { target ->
        ConfirmDialog(
            title = if (target.leaving) "Remove from your list?" else "Stop sharing?",
            message = if (target.leaving) {
                "You'll lose access to “${target.name}”. The owner's copy isn't affected, " +
                    "and you'd need them to share it again."
            } else {
                "Everyone you shared “${target.name}” with will lose access. " +
                    "It stays in your own files."
            },
            confirmLabel = if (target.leaving) "Remove" else "Stop sharing",
            onConfirm = {
                if (target.leaving) viewModel.removeFromMyList(target.id, target.isFolder)
                else viewModel.stopSharing(target.id, target.isFolder)
                shareConfirm = null
            },
            onDismiss = { shareConfirm = null },
        )
    }

    bulkConfirm?.let { target ->
        val items = if (target.count == 1) "1 item" else "${target.count} items"
        ConfirmDialog(
            title = if (target.leaving) "Remove $items from your list?" else "Stop sharing $items?",
            message = if (target.leaving) {
                "You'll lose access to $items. The owners' copies aren't affected, and " +
                    "you'd need them to share each one again."
            } else {
                "Everyone you shared these $items with will lose access. " +
                    "They stay in your own files."
            },
            confirmLabel = if (target.leaving) "Remove" else "Stop sharing",
            onConfirm = {
                if (target.leaving) viewModel.bulkRemoveFromMyList() else viewModel.bulkStopSharing()
                bulkConfirm = null
            },
            onDismiss = { bulkConfirm = null },
        )
    }

    if (bulkExpiryOpen) {
        val items = if (state.selectedCount == 1) "1 item" else "${state.selectedCount} items"
        ExpiryDialog(
            itemName = items,

            currentExpiresAt = null,
            onConfirm = { expiresAt ->
                viewModel.bulkSetExpiry(expiresAt)
                bulkExpiryOpen = false
            },
            onDismiss = { bulkExpiryOpen = false },
        )
    }

    rowExpiry?.let { target ->
        ExpiryDialog(
            itemName = target.name,
            currentExpiresAt = null,
            onConfirm = { expiresAt ->
                viewModel.setShareExpiry(target.id, target.isFolder, expiresAt)
                rowExpiry = null
            },
            onDismiss = { rowExpiry = null },
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
}

private data class BulkConfirm(

    val leaving: Boolean,
    val count: Int,
)

private data class RowExpiry(
    val id: String,
    val name: String,
    val isFolder: Boolean,
)

private data class ShareConfirm(
    val id: String,
    val name: String,
    val isFolder: Boolean,

    val leaving: Boolean,
)
