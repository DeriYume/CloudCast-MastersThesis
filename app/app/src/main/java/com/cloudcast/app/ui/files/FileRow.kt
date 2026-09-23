package com.cloudcast.app.ui.files

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cloudcast.app.core.formatBytes
import com.cloudcast.app.core.formatDateShort
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.ui.common.AuthorChip
import com.cloudcast.app.ui.common.CardCell
import com.cloudcast.app.ui.common.ExpiryChip
import com.cloudcast.app.ui.common.FavoriteToggle
import com.cloudcast.app.ui.common.LocationChip
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.MetaText
import com.cloudcast.app.ui.common.ShareChip
import com.cloudcast.app.ui.common.TypeTile
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.SelectionTint
import com.cloudcast.app.ui.common.OverflowMenu
import com.cloudcast.app.ui.common.OverflowMenuItem

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FileRow(
    file: FileDto,
    onOpen: () -> Unit,
    onDownload: () -> Unit,

    onToggleFavorite: (() -> Unit)? = null,
    onMove: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null,
    onRename: (() -> Unit)? = null,
    onSetExpiry: (() -> Unit)? = null,

    onStopSharing: (() -> Unit)? = null,
    onRemoveFromMyList: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null,

    showDownload: Boolean = true,
    onSave: (() -> Unit)? = null,

    showLocation: Boolean = false,

    selectionMode: Boolean = false,
    selected: Boolean = false,
    onLongPress: (() -> Unit)? = null,
    onToggleSelect: (() -> Unit)? = null,

    modifier: Modifier = Modifier,
) {

    val meta = "${formatBytes(file.size_bytes)} · ${formatDateShort(file.created_at)}"
    val location = if (showLocation) file.folder_name ?: "All files" else null
    val recipients = file.recipient_count?.takeIf { it > 0 }
    val hasChips = location != null || file.expires_at != null || file.shared_by != null || recipients != null

    val clickModifier = when {
        selectionMode && onToggleSelect != null -> Modifier.clickable { onToggleSelect() }
        onLongPress != null -> Modifier.combinedClickable(onClick = onOpen, onLongClick = onLongPress)
        else -> Modifier.clickable(onClick = onOpen)
    }
    val selectionVisual = if (selected) Modifier.background(SelectionTint) else Modifier

    CardCell(modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .then(selectionVisual)
                .then(clickModifier)
                .fillMaxWidth()
                .padding(start = 13.dp, end = 4.dp, top = 11.dp, bottom = 11.dp),
        ) {
            TypeTile(icon = fileIcon(file.mime_type), size = 38)

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    file.original_name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                MetaText(meta, modifier = Modifier.padding(top = 2.dp))
                if (hasChips) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        horizontalAlignment = Alignment.Start,
                        modifier = Modifier.padding(top = 5.dp),
                    ) {
                        location?.let { LocationChip(it) }
                        file.expires_at?.let { ExpiryChip(formatDateTime(it)) }
                        file.shared_by?.let { AuthorChip(it) }
                        recipients?.let { ShareChip(it.toString()) }
                    }
                }
            }

            if (selectionMode) {
                IconButton(onClick = { onToggleSelect?.invoke() }) {
                    MaterialSymbol(
                        name = if (selected) AppIcons.checkCircle else AppIcons.radioUnchecked,
                        size = 24,
                        contentDescription = if (selected) "Selected" else "Not selected",
                        tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy((-8).dp),
                ) {
                    if (onToggleFavorite != null) {
                        FavoriteToggle(
                            isFavorite = file.is_favorite,
                            onToggle = onToggleFavorite,
                        )
                    }
                    OverflowMenu(contentDescription = "File options") { close ->
                        if (showDownload) {
                            OverflowMenuItem("Download", AppIcons.download, onClick = { close(); onDownload() })
                        }
                        if (onSave != null) {
                            OverflowMenuItem("Save to my cloud", AppIcons.save, onClick = { close(); onSave() })
                        }
                        if (onRename != null) {
                            OverflowMenuItem("Rename", AppIcons.rename, onClick = { close(); onRename() })
                        }
                        if (onMove != null) {
                            OverflowMenuItem("Move", AppIcons.driveFileMove, onClick = { close(); onMove() })
                        }
                        if (onShare != null) {
                            OverflowMenuItem("Share", AppIcons.share, onClick = { close(); onShare() })
                        }
                        if (onSetExpiry != null) {

                            val expiryLabel = if (file.expires_at != null) "Manage expiry" else "Set expiry"
                            OverflowMenuItem(expiryLabel, AppIcons.schedule, onClick = { close(); onSetExpiry() })
                        }
                        if (onStopSharing != null) {
                            OverflowMenuItem("Stop sharing", AppIcons.close, onClick = { close(); onStopSharing() })
                        }
                        if (onRemoveFromMyList != null) {
                            OverflowMenuItem("Remove from my list", AppIcons.close, onClick = { close(); onRemoveFromMyList() })
                        }
                        if (onDelete != null) {
                            OverflowMenuItem("Delete", AppIcons.delete, onClick = { close(); onDelete() })
                        }
                    }
                }
            }
        }
    }
}
