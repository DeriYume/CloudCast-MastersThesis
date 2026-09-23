package com.cloudcast.app.ui.sharing

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.core.SharePermissions
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.ui.common.ConfirmDialog
import com.cloudcast.app.ui.files.FileRow
import com.cloudcast.app.ui.folders.FolderRow
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.virtualfolders.VirtualFolderRow
import com.cloudcast.app.ui.common.SectionHeading
import com.cloudcast.app.ui.files.SortKey
import com.cloudcast.app.ui.files.TabTopBar
import com.cloudcast.app.ui.files.defaultAscending
import com.cloudcast.app.ui.notifications.NotificationsViewModel

private data class HubFolder(
    val key: String,
    val title: String,
    val icon: String,
    val onOpen: () -> Unit,
)

@Composable
fun SharedHub(
    onOpenSharedByMe: () -> Unit,
    onOpenSharedWithMe: () -> Unit,
    viewModel: SharedHubViewModel,
    onOpenFile: (String) -> Unit,

    bottomBar: @Composable () -> Unit = {},
    onOpenSearch: (() -> Unit)? = null,
    onOpenProfile: (() -> Unit)? = null,
    notificationsViewModel: NotificationsViewModel? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var confirm by remember { mutableStateOf<RecentConfirm?>(null) }

    var expiryTarget by remember { mutableStateOf<RecentExpiry?>(null) }

    var downloadTarget by remember { mutableStateOf<FileDto?>(null) }
    val saveLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("*/*"),
    ) { uri ->
        if (uri != null) downloadTarget?.let { viewModel.download(it.id, uri) }
        downloadTarget = null
    }

    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.messageShown() }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refreshOnResume() }

    var sortKey by rememberSaveable { mutableStateOf(SortKey.NAME) }
    var sortAscending by rememberSaveable { mutableStateOf(true) }
    val onSortSelect: (SortKey) -> Unit = { key ->
        if (key == sortKey) sortAscending = !sortAscending
        else { sortKey = key; sortAscending = defaultAscending(key) }
    }

    val folders = listOf(
        HubFolder("shared-files", "Shared files", AppIcons.send, onOpenSharedByMe),
        HubFolder("shared-with-me", "Shared with me", AppIcons.group, onOpenSharedWithMe),
    )
    val sortedFolders = remember(sortKey, sortAscending) {
        when (sortKey) {

            SortKey.NAME -> folders.sortedBy { it.title.lowercase() }
                .let { if (sortAscending) it else it.reversed() }

            else -> folders
        }
    }

    Scaffold(

        topBar = {
            TabTopBar(
                title = "Shared",
                sortKey = sortKey,
                sortAscending = sortAscending,
                onSortSelect = onSortSelect,
                onBack = null,
                onOpenSearch = onOpenSearch,
                onOpenProfile = onOpenProfile,
                notificationsViewModel = notificationsViewModel,
                onOpenFile = onOpenFile,
                onOpenShared = onOpenSharedWithMe,
            )
        },
        bottomBar = bottomBar,
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(Modifier.fillMaxSize()) {
                item { SectionHeading("Folders") }
                items(sortedFolders, key = { it.key }) { folder ->
                    VirtualFolderRow(
                        folder.title,
                        folder.icon,
                        onOpen = folder.onOpen,
                    )
                }

                if (state.recents.isNotEmpty() || state.loading) {
                    item { SectionHeading("Recently shared") }
                    items(state.recents, key = { "recent-${it.id}" }) { recent ->
                        when (recent) {
                            is SharedRecent.Folder -> {
                                val folder = recent.folder

                                FolderRow(
                                    folder = folder,
                                    onOpen = {
                                        if (recent.incoming) onOpenSharedWithMe() else onOpenSharedByMe()
                                    },
                                    onShare = if (!recent.incoming) {
                                        ({ viewModel.share.openForFolder(folder.id, folder.name) })
                                    } else {
                                        null
                                    },
                                    onSetExpiry = if (!recent.incoming) {
                                        ({
                                            expiryTarget = RecentExpiry(folder.id, folder.name, isFolder = true)
                                        })
                                    } else {
                                        null
                                    },
                                    onRemoveFromMyList = if (recent.incoming) {
                                        ({
                                            confirm = RecentConfirm(
                                                folder.id, folder.name, leaving = true, isFolder = true,
                                            )
                                        })
                                    } else {
                                        null
                                    },
                                    onStopSharing = if (!recent.incoming) {
                                        ({
                                            confirm = RecentConfirm(
                                                folder.id, folder.name, leaving = false, isFolder = true,
                                            )
                                        })
                                    } else {
                                        null
                                    },
                                )
                            }
                            is SharedRecent.Item -> {
                                val file = recent.file

                                val canSave = recent.incoming && SharePermissions.canSave(file.permission)
                                val canDownload = !recent.incoming ||
                                    SharePermissions.canDownload(file.permission)
                                FileRow(
                                    file = file,
                                    onOpen = { onOpenFile(file.id) },
                                    onDownload = {
                                        downloadTarget = file
                                        saveLauncher.launch(file.original_name)
                                    },
                                    showDownload = canDownload,
                                    onSave = if (canSave) ({ viewModel.saveToCloud(file.id) }) else null,
                                    onShare = if (!recent.incoming) {
                                        ({ viewModel.share.openForFile(file.id, file.original_name) })
                                    } else {
                                        null
                                    },
                                    onSetExpiry = if (!recent.incoming) {
                                        ({
                                            expiryTarget = RecentExpiry(
                                                file.id, file.original_name, isFolder = false,
                                            )
                                        })
                                    } else {
                                        null
                                    },
                                    onRemoveFromMyList = if (recent.incoming) {
                                        ({
                                            confirm = RecentConfirm(
                                                file.id, file.original_name, leaving = true, isFolder = false,
                                            )
                                        })
                                    } else {
                                        null
                                    },
                                    onStopSharing = if (!recent.incoming) {
                                        ({
                                            confirm = RecentConfirm(
                                                file.id, file.original_name, leaving = false, isFolder = false,
                                            )
                                        })
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
    }

    confirm?.let { target ->
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
                confirm = null
            },
            onDismiss = { confirm = null },
        )
    }

    expiryTarget?.let { target ->
        ExpiryDialog(
            itemName = target.name,

            currentExpiresAt = null,
            onConfirm = { expiresAt ->
                viewModel.setShareExpiry(target.id, target.isFolder, expiresAt)
                expiryTarget = null
            },
            onDismiss = { expiryTarget = null },
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

private data class RecentConfirm(
    val id: String,
    val name: String,

    val leaving: Boolean,

    val isFolder: Boolean,
)

private data class RecentExpiry(
    val id: String,
    val name: String,
    val isFolder: Boolean,
)
