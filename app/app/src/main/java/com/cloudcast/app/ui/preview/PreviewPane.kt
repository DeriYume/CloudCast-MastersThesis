package com.cloudcast.app.ui.preview

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.cloudcast.app.ui.common.MaterialSymbol

@Composable
fun PreviewPane(
    icon: String,
    modifier: Modifier = Modifier,
) {
    MaterialSymbol(
        name = icon,
        size = 88,
        tint = MaterialTheme.colorScheme.primary,
        modifier = modifier,
    )
}
