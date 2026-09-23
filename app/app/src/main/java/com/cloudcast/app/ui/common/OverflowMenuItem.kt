package com.cloudcast.app.ui.common

import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun OverflowMenuItem(
    label: String,
    icon: String,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = { Text(label) },
        leadingIcon = { MaterialSymbol(icon, size = 24) },
        onClick = onClick,
    )
}
