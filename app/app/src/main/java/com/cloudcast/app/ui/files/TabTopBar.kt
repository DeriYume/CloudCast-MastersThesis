package com.cloudcast.app.ui.files

import androidx.compose.runtime.Composable
import com.cloudcast.app.ui.common.AppTopBar
import com.cloudcast.app.ui.common.ProfileButton
import com.cloudcast.app.ui.common.SearchButton
import com.cloudcast.app.ui.notifications.NotificationsAction
import com.cloudcast.app.ui.notifications.NotificationsViewModel

@Composable
fun TabTopBar(
    title: String,
    sortKey: SortKey,
    sortAscending: Boolean,
    onSortSelect: (SortKey) -> Unit,
    onBack: (() -> Unit)? = null,
    onOpenSearch: (() -> Unit)? = null,
    onOpenProfile: (() -> Unit)? = null,
    notificationsViewModel: NotificationsViewModel? = null,
    onOpenFile: ((String) -> Unit)? = null,
    onOpenShared: (() -> Unit)? = null,
) {
    AppTopBar(
        title = title,
        onBack = onBack,
        actions = {
            SortMenuButton(
                sortKey = sortKey,
                ascending = sortAscending,
                onSelect = onSortSelect,
            )
            notificationsViewModel?.let { NotificationsAction(it, onOpenFile, onOpenShared) }
            onOpenSearch?.let { SearchButton(onClick = it) }
            onOpenProfile?.let { ProfileButton(onClick = it) }
        },
    )
}
