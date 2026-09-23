package com.cloudcast.app.ui.virtualfolders

import androidx.compose.foundation.clickable
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun VirtualFolderRow(
    label: String,
    icon: String,
    onOpen: () -> Unit,
) {
    ListItem(
        modifier = Modifier.clickable(onClick = onOpen),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = {
            MaterialSymbol(icon, size = 24, tint = MaterialTheme.colorScheme.primary)
        },
        headlineContent = { Text(label) },
        trailingContent = {

            IconButton(onClick = onOpen) {
                MaterialSymbol(
                    AppIcons.chevronRight,
                    size = 24,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
    )
}
