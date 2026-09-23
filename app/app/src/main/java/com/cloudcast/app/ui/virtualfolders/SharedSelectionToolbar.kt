package com.cloudcast.app.ui.virtualfolders

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedSelectionToolbar(
    selectedCount: Int,
    allSelected: Boolean,

    incoming: Boolean,
    canSave: Boolean,
    canDownload: Boolean,

    folderSelected: Boolean,
    busy: Boolean,
    onClear: () -> Unit,
    onToggleSelectAll: () -> Unit,
    onSave: () -> Unit,
    onDownloadZip: () -> Unit,
    onDownloadIndividual: () -> Unit,
    onRemove: () -> Unit,
    onSetExpiry: () -> Unit,
    onStopSharing: () -> Unit,
) {
    var downloadOpen by remember { mutableStateOf(false) }

    TopAppBar(
        title = { Text("$selectedCount selected", maxLines = 1) },
        navigationIcon = {
            IconButton(onClick = onClear) {
                MaterialSymbol(AppIcons.close, size = 24, contentDescription = "Clear selection")
            }
        },
        actions = {
            IconButton(onClick = onToggleSelectAll, enabled = !busy) {
                if (allSelected) {
                    MaterialSymbol(AppIcons.deselect, size = 24, contentDescription = "Deselect all")
                } else {
                    MaterialSymbol(AppIcons.selectAll, size = 24, contentDescription = "Select all")
                }
            }

            if (busy) {

                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp).padding(end = 8.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else if (incoming) {
                IconButton(onClick = onSave, enabled = canSave) {
                    MaterialSymbol(
                        AppIcons.save,
                        size = 24,
                        contentDescription = if (canSave) {
                            "Save selected to my cloud"
                        } else {
                            "Save unavailable - every selected file must allow saving, and folders can't be saved"
                        },
                    )
                }
                IconButton(onClick = { downloadOpen = true }, enabled = canDownload) {
                    MaterialSymbol(
                        AppIcons.download,
                        size = 24,
                        contentDescription = if (canDownload) {
                            "Download selected"
                        } else {
                            "Download unavailable - every selected item must allow it"
                        },
                    )
                }
                DropdownMenu(expanded = downloadOpen, onDismissRequest = { downloadOpen = false }) {
                    DropdownMenuItem(
                        text = { Text("Download as .zip") },
                        onClick = { downloadOpen = false; onDownloadZip() },
                    )
                    DropdownMenuItem(
                        text = { Text("Download individually") },

                        enabled = !folderSelected,
                        onClick = { downloadOpen = false; onDownloadIndividual() },
                    )
                }
                IconButton(onClick = onRemove) {
                    MaterialSymbol(AppIcons.close, size = 24, contentDescription = "Remove from my list")
                }
            } else {
                IconButton(onClick = onSetExpiry) {
                    MaterialSymbol(AppIcons.schedule, size = 24, contentDescription = "Set expiry for selected")
                }
                IconButton(onClick = onStopSharing) {
                    MaterialSymbol(AppIcons.group, size = 24, contentDescription = "Stop sharing selected")
                }
            }
        },

        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primary,
            titleContentColor = MaterialTheme.colorScheme.onPrimary,
            navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
            actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    )
}
