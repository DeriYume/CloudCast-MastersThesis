package com.cloudcast.app.ui.folders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

internal fun flattenFolders(
    folders: List<FolderDto>,
    parentId: String? = null,
    depth: Int = 0,
): List<Pair<FolderDto, Int>> {
    val out = mutableListOf<Pair<FolderDto, Int>>()
    folders.filter { it.parent_id == parentId }
        .sortedBy { it.name.lowercase() }
        .forEach { f ->
            out.add(f to depth)
            out.addAll(flattenFolders(folders, f.id, depth + 1))
        }
    return out
}

@Composable
internal fun MoveDestinationList(
    folders: List<FolderDto>,
    currentId: String?,
    selectedId: String?,
    onSelect: (String?) -> Unit,
    loading: Boolean,
    error: String?,
    modifier: Modifier = Modifier,
) {
    val rows = remember(folders) { flattenFolders(folders) }
    Column(modifier) {
        Box(Modifier.fillMaxWidth().height(320.dp)) {
            if (loading) {
                CircularProgressIndicator(Modifier.align(Alignment.Center))
            } else {
                LazyColumn(Modifier.fillMaxWidth()) {
                    item("root") {
                        DestinationRow(
                            label = "All files (root)",
                            depth = 0,
                            isRoot = true,
                            selected = selectedId == null,
                            isCurrent = currentId == null,
                            onClick = { onSelect(null) },
                        )
                    }
                    items(rows, key = { it.first.id }) { (folder, depth) ->
                        DestinationRow(
                            label = folder.name,
                            depth = depth + 1,
                            isRoot = false,
                            selected = selectedId == folder.id,
                            isCurrent = currentId == folder.id,
                            onClick = { onSelect(folder.id) },
                        )
                    }
                }
            }
        }
        if (error != null) {
            ErrorText(error, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

@Composable
private fun DestinationRow(
    label: String,
    depth: Int,
    isRoot: Boolean,
    selected: Boolean,
    isCurrent: Boolean,
    onClick: () -> Unit,
) {
    val bg = if (selected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(start = (12 + depth * 16).dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MaterialSymbol(
            if (isRoot) AppIcons.cloud else AppIcons.folder,
            size = 24,
            tint = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, fontWeight = FontWeight.SemiBold, maxLines = 1)
            if (isCurrent) {
                Text(
                    "current location",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        RadioButton(selected = selected, onClick = null)
    }
}
