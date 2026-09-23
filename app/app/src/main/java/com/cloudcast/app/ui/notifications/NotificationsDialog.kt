package com.cloudcast.app.ui.notifications

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.core.notificationMessage
import com.cloudcast.app.data.network.NotificationDto
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun NotificationsDialog(
    items: List<NotificationDto>,
    loading: Boolean,
    error: String?,
    onDismissItem: (id: String) -> Unit,
    onOpenItem: (com.cloudcast.app.data.network.NotificationDto) -> Unit,
    onClearAll: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Notifications") },
        text = {
            Box(Modifier.fillMaxWidth().heightIn(min = 80.dp, max = 360.dp)) {
                when {
                    loading && items.isEmpty() ->
                        CircularProgressIndicator(Modifier.align(Alignment.Center))
                    error != null && items.isEmpty() ->
                        ErrorText(error, modifier = Modifier.align(Alignment.Center))
                    items.isEmpty() -> Text(
                        "You're all caught up.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center).padding(8.dp),
                    )
                    else -> LazyColumn(Modifier.fillMaxWidth()) {
                        items(items, key = { it.id }) { n ->
                            ListItem(
                                modifier = Modifier.clickable { onOpenItem(n) },

                                colors = ListItemDefaults.colors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                ),
                                headlineContent = {
                                    Text(

                                        notificationMessage(n),
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                },
                                supportingContent = { Text(formatDateTime(n.created_at)) },
                                trailingContent = {
                                    IconButton(onClick = { onDismissItem(n.id) }) {
                                        MaterialSymbol(
                                            AppIcons.close,
                                            size = 18,
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                            contentDescription = "Dismiss notification",
                                        )
                                    }
                                },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = items.isNotEmpty(), onClick = onClearAll) { Text("Clear all") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        },
    )
}
