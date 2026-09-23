package com.cloudcast.app.ui.common

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun OverflowMenu(
    contentDescription: String,
    items: @Composable ColumnScope.(closeMenu: () -> Unit) -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }

    Box {
        IconButton(onClick = { menuOpen = true }) {
            MaterialSymbol(AppIcons.moreVert, size = 24, contentDescription = contentDescription)
        }
        DropdownMenu(
            expanded = menuOpen,
            onDismissRequest = { menuOpen = false },

            offset = DpOffset(x = (-8).dp, y = 0.dp),
        ) {
            items { menuOpen = false }
        }
    }
}
