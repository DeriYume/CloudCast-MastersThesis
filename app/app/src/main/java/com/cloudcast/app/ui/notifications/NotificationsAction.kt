package com.cloudcast.app.ui.notifications

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.ui.common.NotificationsButton

@Composable
fun NotificationsAction(
    viewModel: NotificationsViewModel,
    onOpenFile: ((String) -> Unit)? = null,
    onOpenShared: (() -> Unit)? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    NotificationsButton(unread = state.unread, onClick = { viewModel.open() })
    if (state.open) {
        NotificationsDialog(
            items = state.items,
            loading = state.loading,
            error = state.error,
            onDismissItem = { id -> viewModel.remove(id) },
            onOpenItem = { n ->
                viewModel.remove(n.id)
                viewModel.dismiss()
                val fileId = n.file_id
                if (fileId != null) onOpenFile?.invoke(fileId) else onOpenShared?.invoke()
            },
            onClearAll = { viewModel.clearAll() },
            onDismiss = { viewModel.dismiss() },
        )
    }
}
