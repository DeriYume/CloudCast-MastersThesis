package com.cloudcast.app.ui.filedetail

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.core.SharePermissions
import com.cloudcast.app.core.formatBytes
import com.cloudcast.app.core.formatDate
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.core.timeLeft
import com.cloudcast.app.ui.common.AppTopBar
import com.cloudcast.app.ui.common.ConfirmDialog
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.MetaRow
import com.cloudcast.app.ui.files.MoveFileDialog
import com.cloudcast.app.ui.files.fileIcon
import com.cloudcast.app.ui.preview.AiAnalysisCard
import com.cloudcast.app.ui.preview.AudioPreview
import com.cloudcast.app.ui.preview.FullscreenImage
import com.cloudcast.app.ui.preview.ImagePreview
import com.cloudcast.app.ui.preview.PdfPreview
import com.cloudcast.app.ui.preview.PreviewPane
import com.cloudcast.app.ui.preview.TextPreview
import com.cloudcast.app.ui.preview.VideoPreview
import com.cloudcast.app.ui.preview.ZipContents
import com.cloudcast.app.ui.sharing.ExpiryDialog
import com.cloudcast.app.ui.sharing.ShareDialog
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.FavoriteAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileDetailScreen(
    viewModel: FileDetailViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val deleted by viewModel.deleted.collectAsStateWithLifecycle()
    var showFullscreen by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(deleted) { if (deleted) onBack() }
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.messageShown() }
    }

    val saveLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("*/*")
    ) { uri -> if (uri != null) viewModel.download(uri) }

    val file = state.file
    val perm = file?.permission
    val isOwner = perm == null || perm == SharePermissions.OWNER
    val canDownload = isOwner || SharePermissions.canDownload(perm)
    val canSave = file != null && !isOwner && SharePermissions.canSave(perm)

    Scaffold(
        topBar = {
            AppTopBar(
                title = file?.original_name ?: "File",
                onBack = onBack,
                actions = {

                    if (file != null) {
                        IconButton(onClick = { viewModel.toggleFavorite() }) {
                            MaterialSymbol(
                                name = AppIcons.star,
                                fill = file.is_favorite,
                                size = 24,
                                contentDescription = if (file.is_favorite) "Remove from favourites" else "Add to favourites",
                                tint = if (file.is_favorite) FavoriteAmber else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (file != null) {
                FileDetailActionBar(
                    canDownload = canDownload,
                    canSave = canSave,
                    downloading = state.downloading,
                    saving = state.saving,
                    onDownload = { saveLauncher.launch(file.original_name) },
                    onSave = { viewModel.saveToCloud() },
                    onShare = if (isOwner) ({ viewModel.openShareDialog() }) else null,
                    onDelete = if (isOwner) ({ showDeleteConfirm = true }) else null,
                    onMove = if (isOwner) ({ viewModel.openMoveDialog() }) else null,
                    onSetExpiry = if (isOwner) ({ viewModel.openExpiryDialog() }) else null,
                )
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                state.loading && file == null -> {
                    CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(32.dp))
                }
                state.error != null && file == null -> {
                    ErrorText(state.error!!)
                }
                file != null -> {

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center,
                    ) {
                        when (state.previewKind) {
                            PreviewKind.IMAGE -> ImagePreview(
                                image = state.image,
                                onImageClick = { showFullscreen = true },
                            )
                            PreviewKind.PDF -> PdfPreview(pages = state.pdfPages)
                            PreviewKind.VIDEO -> state.videoFile?.let { VideoPreview(file = it) }
                                ?: CircularProgressIndicator()
                            PreviewKind.AUDIO -> state.audioFile?.let { AudioPreview(file = it) }
                                ?: CircularProgressIndicator()
                            PreviewKind.ZIP -> ZipContents(
                                entries = state.zipEntries,
                                truncated = state.zipTruncated,
                                modifier = Modifier.fillMaxSize(),
                            )
                            PreviewKind.TEXT -> TextPreview(
                                text = state.textContent,
                                truncated = state.textTruncated,
                                modifier = Modifier.fillMaxSize(),
                            )
                            PreviewKind.OTHER -> PreviewPane(icon = fileIcon(file.mime_type))
                        }
                    }

                    Column(Modifier.padding(16.dp)) {

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                MetaRow("Name", file.original_name)
                                MetaRow("Type", file.mime_type)
                                MetaRow("Size", formatBytes(file.size_bytes))
                                MetaRow("Added", formatDate(file.created_at))
                                file.expires_at?.let { MetaRow("Expires", formatDateTime(it)) }
                                file.shared_by?.let { MetaRow("Shared by", it) }
                                file.share_expires_at?.let { MetaRow("Access ends", "${formatDateTime(it)} \u00b7 ${timeLeft(it)}") }
                            }
                        }

                        if (state.isAnalyzable) {
                            Spacer(Modifier.size(12.dp))
                            AiAnalysisCard(
                                aiSummary = state.aiSummary,
                                aiModel = state.aiModel,
                                aiLoading = state.aiLoading,
                                aiError = state.aiError,
                                onAnalyze = { regenerate -> viewModel.analyze(regenerate) },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }

                        if (state.error != null) {
                            Spacer(Modifier.size(8.dp))
                            ErrorText(state.error!!)
                        }
                    }
                }
            }
        }
    }

    if (showFullscreen && state.image != null) {
        FullscreenImage(image = state.image!!, onDismiss = { showFullscreen = false })
    }

    if (showDeleteConfirm) {
        ConfirmDialog(
            title = "Delete file?",
            message = "This file will be permanently deleted.",
            confirmLabel = "Delete",
            onConfirm = { showDeleteConfirm = false; viewModel.delete() },
            onDismiss = { showDeleteConfirm = false },
        )
    }

    if (state.showMoveDialog && file != null) {
        MoveFileDialog(
            folders = state.folders,
            currentFolderId = file.folder_id,
            fileName = file.original_name,
            loading = state.foldersLoading || state.moving,
            error = state.moveError,
            onMove = { target -> viewModel.move(target) },
            onDismiss = { viewModel.dismissMoveDialog() },
        )
    }

    if (state.showExpiryDialog && file != null) {
        ExpiryDialog(
            itemName = file.original_name,
            currentExpiresAt = file.expires_at,
            onConfirm = { iso -> viewModel.setExpiry(iso) },
            onDismiss = { viewModel.dismissExpiryDialog() },
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
