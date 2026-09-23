package com.cloudcast.app.ui.common

import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.material3.ExperimentalMaterial3Api
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun ProfileButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        MaterialSymbol(AppIcons.accountCircle, size = 24, contentDescription = "Profile")
    }
}

@Composable
fun SearchButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        MaterialSymbol(AppIcons.search, size = 24, contentDescription = "Search")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsButton(unread: Int, onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        BadgedBox(
            badge = {
                if (unread > 0) {
                    Badge { Text(if (unread > 99) "99+" else unread.toString()) }
                }
            },
        ) {
            MaterialSymbol(AppIcons.notifications, size = 24, contentDescription = "Notifications")
        }
    }
}
