package com.cloudcast.app.ui.uploads

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun NewFab(
    enabled: Boolean = true,
    onNewFolder: () -> Unit,
    onUpload: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        FloatingActionButton(
            onClick = { if (enabled) expanded = true },
            modifier = Modifier.alpha(if (enabled) 1f else 0.38f),
        ) {
            MaterialSymbol(AppIcons.add, size = 24, contentDescription = "New")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("New folder") },
                leadingIcon = { MaterialSymbol(AppIcons.createNewFolder, size = 24) },
                onClick = { expanded = false; onNewFolder() },
            )
            DropdownMenuItem(
                text = { Text("Upload file") },
                leadingIcon = { MaterialSymbol(AppIcons.upload, size = 24) },
                onClick = { expanded = false; onUpload() },
            )
        }
    }
}
