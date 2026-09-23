package com.cloudcast.app.ui.files

import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun SortMenuButton(
    sortKey: SortKey,
    ascending: Boolean,
    onSelect: (SortKey) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    IconButton(onClick = { open = true }) {
        MaterialSymbol(AppIcons.sort, size = 24, contentDescription = "Sort")
    }
    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
        SortKey.entries.forEach { key ->
            DropdownMenuItem(
                text = { Text(key.label) },
                trailingIcon = {
                    if (key == sortKey) {
                        MaterialSymbol(
                            name = if (ascending) AppIcons.arrowUpward else AppIcons.arrowDownward,
                            size = 16,
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                },
                onClick = { onSelect(key); open = false },
            )
        }
    }
}
