package com.cloudcast.app.ui.filedetail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.common.LoadingContent
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.PrimaryButton
import com.cloudcast.app.ui.theme.AppIcons

@Composable
internal fun FileDetailActionBar(
    modifier: Modifier = Modifier,
    canDownload: Boolean,
    canSave: Boolean,
    downloading: Boolean,
    saving: Boolean,
    onDownload: () -> Unit,
    onSave: () -> Unit,
    onShare: (() -> Unit)?,
    onDelete: (() -> Unit)?,
    onMove: (() -> Unit)?,
    onSetExpiry: (() -> Unit)?,
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()

                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            when {
                canDownload -> PrimaryButton(
                    onClick = onDownload,
                    enabled = !downloading,
                    modifier = Modifier.weight(1f),
                ) {
                    LoadingContent(isLoading = downloading, spinnerColor = MaterialTheme.colorScheme.onPrimary) {
                        MaterialSymbol(AppIcons.download, size = 18)
                        Spacer(Modifier.width(8.dp))
                        Text("Download")
                    }
                }
                canSave -> PrimaryButton(
                    onClick = onSave,
                    enabled = !saving,
                    modifier = Modifier.weight(1f),
                ) {
                    LoadingContent(isLoading = saving, spinnerColor = MaterialTheme.colorScheme.onPrimary) {
                        MaterialSymbol(AppIcons.save, size = 18)
                        Spacer(Modifier.width(8.dp))
                        Text("Save to my cloud")
                    }
                }
                else -> Spacer(Modifier.weight(1f))
            }

            if (onShare != null) {
                IconBoxButton(onClick = onShare) {
                    MaterialSymbol(
                        AppIcons.share,
                        size = 20,
                        contentDescription = "Share",
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            if (onDelete != null) {
                IconBoxButton(onClick = onDelete) {
                    MaterialSymbol(
                        AppIcons.delete,
                        size = 20,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            }

            if (onMove != null || onSetExpiry != null) {
                ActionBarOverflow { close ->
                    if (onMove != null) {
                        SheetAction("Move", AppIcons.driveFileMove, onClick = { close(); onMove() })
                    }
                    if (onSetExpiry != null) {
                        SheetAction("Set expiry", AppIcons.schedule, onClick = { close(); onSetExpiry() })
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ActionBarOverflow(actions: @Composable ColumnScope.(close: () -> Unit) -> Unit) {
    var open by remember { mutableStateOf(false) }
    IconBoxButton(onClick = { open = true }) {
        MaterialSymbol(
            AppIcons.moreVert,
            size = 22,
            contentDescription = "More actions",
            tint = MaterialTheme.colorScheme.primary,
        )
    }
    if (open) {
        ModalBottomSheet(
            onDismissRequest = { open = false },
            sheetState = rememberModalBottomSheetState(),

            containerColor = MaterialTheme.colorScheme.surface,
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(bottom = 12.dp),
            ) {
                actions { open = false }
            }
        }
    }
}

@Composable
private fun SheetAction(label: String, icon: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        MaterialSymbol(
            icon,
            size = 24,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun IconBoxButton(onClick: () -> Unit, content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier
            .size(46.dp)
            .clickable(onClick = onClick),
    ) {
        Box(contentAlignment = Alignment.Center) { content() }
    }
}
