package com.cloudcast.app.ui.uploads

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.files.AutoFilePrompt

@Composable
fun AutoFileDialog(
    prompt: AutoFilePrompt,
    onCreate: () -> Unit,
    onHere: () -> Unit,
    onCancel: () -> Unit,
) {
    val fileWord = if (prompt.count == 1) "file" else "files"
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text("Auto-file uploads") },
        text = {
            Text("Create folder \"${prompt.targetName}\" and file ${prompt.count} $fileWord there?")
        },
        confirmButton = {
            TextButton(onClick = onCreate) { Text("Create & file") }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onCancel) { Text("Cancel") }
                TextButton(onClick = onHere) { Text("Upload here instead") }
            }
        },
    )
}
