package com.cloudcast.app.ui.files

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.ui.folders.MoveDestinationList

@Composable
fun MoveFolderDialog(
    folders: List<FolderDto>,
    currentParentId: String?,
    folderName: String,
    loading: Boolean = false,
    error: String? = null,
    onMove: (targetParentId: String?) -> Unit,
    onDismiss: () -> Unit,
) {

    var selected by remember { mutableStateOf(currentParentId) }
    val isSameLocation = selected == currentParentId

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Move \"$folderName\"") },
        text = {
            MoveDestinationList(
                folders = folders,
                currentId = currentParentId,
                selectedId = selected,
                onSelect = { selected = it },
                loading = loading,
                error = error,
            )
        },
        confirmButton = {
            TextButton(
                enabled = !isSameLocation && !loading,
                onClick = { onMove(selected) },
            ) {
                Text(if (isSameLocation) "Already here" else "Move here")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
