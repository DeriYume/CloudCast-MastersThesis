package com.cloudcast.app.ui.uploads

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.ui.files.FilingDecision
import com.cloudcast.app.ui.files.FilingRow

@Composable
fun FilingReviewDialog(
    rows: List<FilingRow>,
    folders: List<FolderDto>,
    onApply: (List<FilingRow>) -> Unit,
    onDismiss: () -> Unit,
) {
    val topLevel = remember(folders) { folders.filter { it.parent_id == null } }
    val edited = remember(rows) { mutableStateMapOf<String, FilingDecision>().apply {
        rows.forEach { put(it.fileId, it.decision) }
    } }

    AlertDialog(
        onDismissRequest = {},
        properties = DialogProperties(dismissOnClickOutside = false, dismissOnBackPress = false),
        title = { Text(if (rows.size == 1) "File this upload?" else "File ${rows.size} uploads?") },
        text = {
            Box(Modifier.fillMaxWidth().heightIn(min = 80.dp, max = 380.dp)) {
                LazyColumn(Modifier.fillMaxWidth()) {
                    items(rows, key = { it.fileId }) { row ->
                        FilingRowEditor(
                            row = row,
                            folders = topLevel,
                            decision = edited[row.fileId] ?: row.decision,
                            onChange = { edited[row.fileId] = it },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onApply(rows.map { it.copy(decision = edited[it.fileId] ?: it.decision) })
            }) { Text("File them") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Leave in place") } },
    )
}

@Composable
private fun FilingRowEditor(
    row: FilingRow,
    folders: List<FolderDto>,
    decision: FilingDecision,
    onChange: (FilingDecision) -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    var newName by remember(row.fileId) {
        mutableStateOf((decision as? FilingDecision.New)?.name ?: row.suggestedName)
    }

    fun label(d: FilingDecision): String = when (d) {
        is FilingDecision.Existing ->
            folders.firstOrNull { it.id == d.folderId }?.name ?: "Existing folder"
        is FilingDecision.New -> "New folder: ${d.name}"
        is FilingDecision.Root -> "Leave at the top level"
    }

    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(row.fileName, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
        Spacer8()
        TextButton(onClick = { menuOpen = true }) { Text(label(decision)) }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            folders.forEach { f ->
                DropdownMenuItem(
                    text = { Text(f.name) },
                    onClick = { onChange(FilingDecision.Existing(f.id)); menuOpen = false },
                )
            }
            if (row.suggestedName.isNotBlank()) {
                DropdownMenuItem(
                    text = { Text("New folder: ${row.suggestedName}") },
                    onClick = {
                        newName = row.suggestedName
                        onChange(FilingDecision.New(row.suggestedName))
                        menuOpen = false
                    },
                )
            }
            DropdownMenuItem(
                text = { Text("Leave at the top level") },
                onClick = { onChange(FilingDecision.Root); menuOpen = false },
            )
        }
        if (decision is FilingDecision.New) {
            OutlinedTextField(
                value = newName,
                onValueChange = { newName = it; onChange(FilingDecision.New(it)) },
                label = { Text("Folder name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun Spacer8() = androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))
