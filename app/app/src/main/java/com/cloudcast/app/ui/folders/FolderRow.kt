package com.cloudcast.app.ui.folders

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.ui.common.CardCell
import com.cloudcast.app.ui.common.ExpiryChip
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.MetaText
import com.cloudcast.app.ui.common.ShareChip
import com.cloudcast.app.ui.common.TypeTile
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.SelectionBorder
import com.cloudcast.app.ui.theme.SelectionTint
import com.cloudcast.app.ui.common.OverflowMenu
import com.cloudcast.app.ui.common.OverflowMenuItem

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FolderRow(
    folder: FolderDto,
    onOpen: () -> Unit,

    onCreateSubfolder: (() -> Unit)? = null,
    onRename: (() -> Unit)? = null,
    onMove: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null,

    onStopSharing: (() -> Unit)? = null,
    onRemoveFromMyList: (() -> Unit)? = null,
    onSetExpiry: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null,

    selectionMode: Boolean = false,
    selected: Boolean = false,
    onLongPress: (() -> Unit)? = null,
    onToggleSelect: (() -> Unit)? = null,

    isDropTarget: Boolean = false,

    modifier: Modifier = Modifier,
) {
    val sharedBy = folder.shared_by
    val expires = folder.expires_at

    val clickModifier = when {
        selectionMode && onToggleSelect != null -> Modifier.clickable { onToggleSelect() }
        onLongPress != null -> Modifier.combinedClickable(onClick = onOpen, onLongClick = onLongPress)
        else -> Modifier.clickable(onClick = onOpen)
    }
    val highlight = when {
        isDropTarget -> Modifier.background(SelectionTint).border(2.dp, SelectionBorder, RoundedCornerShape(8.dp))
        selected -> Modifier.background(SelectionTint)
        else -> Modifier
    }

    CardCell(modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .then(highlight)
                .then(clickModifier)
                .fillMaxWidth()
                .padding(start = 13.dp, end = 4.dp, top = 11.dp, bottom = 11.dp),
        ) {
            TypeTile(icon = AppIcons.folder, size = 38)

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    folder.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                if (sharedBy != null || expires != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(top = 3.dp),
                    ) {
                        if (sharedBy != null) ShareChip("Shared")
                        if (expires != null) ExpiryChip(formatDateTime(expires))
                        if (sharedBy != null && expires == null) {
                            MetaText("from $sharedBy")
                        }
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
                OverflowMenu(contentDescription = "Folder options") { close ->
                    if (onCreateSubfolder != null) {
                        OverflowMenuItem("New subfolder", AppIcons.createNewFolder, onClick = { close(); onCreateSubfolder() })
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
                        val expiryLabel = if (folder.expires_at != null) "Manage expiry" else "Set expiry"
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
