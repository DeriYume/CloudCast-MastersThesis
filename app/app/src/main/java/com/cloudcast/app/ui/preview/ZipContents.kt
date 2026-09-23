package com.cloudcast.app.ui.preview

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cloudcast.app.core.ZipTools
import com.cloudcast.app.core.formatBytes
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

private data class ZipChildren(val folders: List<String>, val files: List<Pair<String, Long>>)

private fun childrenOf(entries: List<ZipTools.Entry>, prefix: String): ZipChildren {
    val folders = sortedSetOf<String>()
    val files = mutableListOf<Pair<String, Long>>()
    for (e in entries) {
        if (!e.path.startsWith(prefix)) continue
        val rest = e.path.substring(prefix.length)
        if (rest.isEmpty()) continue
        val slash = rest.indexOf('/')
        if (slash == -1) files.add(rest to e.size) else folders.add(rest.substring(0, slash))
    }
    files.sortBy { it.first.lowercase() }
    return ZipChildren(folders.toList(), files)
}

private fun parentOf(path: String): String {
    val trimmed = path.trimEnd('/')
    val idx = trimmed.lastIndexOf('/')
    return if (idx == -1) "" else trimmed.substring(0, idx + 1)
}

@Composable
fun ZipContents(
    entries: List<ZipTools.Entry>?,
    truncated: Boolean,
    modifier: Modifier = Modifier,
) {
    if (entries == null) {
        CircularProgressIndicator(modifier.padding(16.dp))
        return
    }

    var path by remember(entries) { mutableStateOf("") }
    val children = remember(entries, path) { childrenOf(entries, path) }
    val segments = if (path.isEmpty()) emptyList() else path.trimEnd('/').split("/")

    BackHandler(enabled = path.isNotEmpty()) { path = parentOf(path) }

    Column(
        modifier = modifier
            .fillMaxWidth()

            .heightIn(min = 200.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
    ) {

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MaterialSymbol(
                name = AppIcons.home,
                size = 18,
                contentDescription = "Archive root",
                modifier = Modifier.clickable { path = "" },
                tint = if (segments.isEmpty()) MaterialTheme.colorScheme.onSurface
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            segments.forEachIndexed { i, seg ->
                MaterialSymbol(
                    AppIcons.chevronRight,
                    size = 16,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                val target = segments.subList(0, i + 1).joinToString("/") + "/"
                val isLast = i == segments.lastIndex
                Text(
                    text = seg,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    color = if (isLast) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = if (isLast) Modifier else Modifier.clickable { path = target },
                )
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxWidth().weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            if (children.folders.isEmpty() && children.files.isEmpty()) {
                item {
                    Text(
                        "Empty folder",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            items(children.folders) { name ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { path = "$path$name/" }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MaterialSymbol(
                        AppIcons.folder,
                        size = 20,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        text = name,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f).padding(start = 12.dp),
                    )
                    MaterialSymbol(
                        AppIcons.chevronRight,
                        size = 18,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            items(children.files) { (name, size) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MaterialSymbol(
                        AppIcons.file,
                        size = 20,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = name,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f).padding(start = 12.dp),
                    )
                    Text(
                        text = formatBytes(size),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }

        if (truncated) {
            Text(
                "This archive has more than ${entries.size} entries; the listing was capped.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(12.dp),
            )
        }
    }
}
