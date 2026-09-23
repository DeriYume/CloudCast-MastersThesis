package com.cloudcast.app.ui.files

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
fun SelectionToolbar(
    selectedCount: Int,
    allSelected: Boolean,

    folderSelected: Boolean,
    onClear: () -> Unit,
    onToggleSelectAll: () -> Unit,
    onMove: () -> Unit,
    onDelete: () -> Unit,
    onDownloadZip: () -> Unit,
    onDownloadIndividual: () -> Unit,

    zipping: Boolean = false,
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
            IconButton(onClick = onToggleSelectAll) {
                if (allSelected) {
                    MaterialSymbol(AppIcons.deselect, size = 24, contentDescription = "Deselect all")
                } else {
                    MaterialSymbol(AppIcons.selectAll, size = 24, contentDescription = "Select all")
                }
            }
            if (zipping) {

                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp).padding(end = 4.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                IconButton(onClick = { downloadOpen = true }) {
                    MaterialSymbol(AppIcons.download, size = 24, contentDescription = "Download selected")
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
            }
            IconButton(onClick = onMove) {
                MaterialSymbol(AppIcons.driveFileMove, size = 24, contentDescription = "Move selected")
            }
            IconButton(onClick = onDelete) {
                MaterialSymbol(AppIcons.delete, size = 24, contentDescription = "Delete selected")
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
