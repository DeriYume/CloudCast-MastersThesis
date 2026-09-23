package com.cloudcast.app.ui.uploads

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.files.ConflictPrompt

@Composable
fun ConflictDialog(
    prompt: ConflictPrompt,
    onResolve: (action: String, applyAll: Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    var applyAll by remember { mutableStateOf(false) }
    val kind = prompt.info.type.ifBlank { "item" }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Name already exists") },
        text = {
            Column {
                Text("A $kind named \"${prompt.info.name}\" already exists here. What would you like to do?")
                if (kind == "folder") {
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Replacing a folder deletes the existing folder and everything inside it.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                if (prompt.bulk) {
                    Spacer(Modifier.size(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = applyAll, onCheckedChange = { applyAll = it })
                        Text("Apply to all remaining conflicts")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onResolve("replace", applyAll) }) {
                Text("Replace", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { onResolve("skip", applyAll) }) { Text("Skip") }
                TextButton(onClick = { onResolve("rename", applyAll) }) { Text("Keep both") }
            }
        },
    )
}
