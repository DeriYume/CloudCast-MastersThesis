package com.cloudcast.app.ui.search

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.ui.uploads.ConflictDialog
import com.cloudcast.app.ui.sharing.ExpiryDialog
import com.cloudcast.app.ui.files.MoveFileDialog
import com.cloudcast.app.ui.common.NameInputDialog
import com.cloudcast.app.ui.sharing.ShareDialog
import com.cloudcast.app.ui.common.AppTopBar
import com.cloudcast.app.ui.files.FileRow
import com.cloudcast.app.ui.folders.FolderRow
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.SectionHeading

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
    onBack: () -> Unit,
    onOpenFile: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.messageShown() }
    }
    var downloadTarget by remember { mutableStateOf<FileDto?>(null) }
    var renameFileTarget by remember { mutableStateOf<FileDto?>(null) }
    var moveTarget by remember { mutableStateOf<FileDto?>(null) }
    var expiryFileTarget by remember { mutableStateOf<FileDto?>(null) }

    val saveLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("*/*")
    ) { uri -> if (uri != null) downloadTarget?.let { viewModel.download(it.id, uri) }; downloadTarget = null }

    BackHandler(enabled = state.inFolder) { viewModel.goBack() }

    Scaffold(
        topBar = {
            AppTopBar(
                title = if (state.inFolder) (state.currentTitle ?: "Search") else "Search",
                onBack = { if (!viewModel.goBack()) onBack() },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {

            if (!state.inFolder) {
                SearchFilterBar(
                    mode = state.mode,
                    onModeChange = viewModel::onModeChange,
                    query = state.query,
                    onQueryChange = viewModel::onQueryChange,
                    onSubmit = viewModel::onSubmit,
                    smart = state.smart,
                    type = state.type,
                    onTypeChange = viewModel::onTypeChange,
                )
            }

            Box(Modifier.fillMaxSize()) {
                when {
                    state.loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))

                    state.smartUnavailable -> Text(
                        "Smart search isn't enabled on this server.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center),
                    )
                    state.error != null && state.isEmpty ->
                        ErrorText(state.error!!, modifier = Modifier.align(Alignment.Center))
                    !state.inFolder && !state.hasQuery -> Text(
                        if (state.smart) "Type to search your files by meaning."
                        else "Type to search your files and folders.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center),
                    )
                    state.isEmpty -> Column(
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            if (state.inFolder) "This folder is empty." else "No matches found.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        if (state.smart && !state.inFolder) {
                            Spacer(Modifier.size(12.dp))
                            Text(
                                "Files uploaded before Smart search was turned on aren't " +
                                    "indexed yet.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(Modifier.size(8.dp))
                            TextButton(
                                onClick = { viewModel.reindexSemantic() },
                                enabled = !state.reindexing,
                            ) {
                                Text(if (state.reindexing) "Indexing…" else "Index my files")
                            }
                        }
                    }
                    else -> LazyColumn(Modifier.fillMaxSize()) {
                        if (state.folders.isNotEmpty()) {
                            item { SectionHeading("Folders") }
                            items(state.folders, key = { "sfolder-${it.id}" }) { folder ->
                                FolderRow(
                                    folder = folder,
                                    onOpen = { viewModel.openFolder(folder) },

                                )
                            }
                        }
                        if (state.files.isNotEmpty()) {
                            item { SectionHeading("Files") }
                            items(state.files, key = { "sfile-${it.id}" }) { file ->
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

                                    showLocation = !state.inFolder,
                                )
                            }
                        }
                    }
                }
            }
        }
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

    state.conflict?.let { prompt ->
        ConflictDialog(
            prompt = prompt,
            onResolve = { action, applyAll -> viewModel.resolveConflict(action, applyAll) },
            onDismiss = { viewModel.cancelConflict() },
        )
    }
}
