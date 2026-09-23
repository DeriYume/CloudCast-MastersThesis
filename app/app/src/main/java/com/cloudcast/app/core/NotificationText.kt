package com.cloudcast.app.core

import com.cloudcast.app.data.network.NotificationDto

fun notificationMessage(n: NotificationDto): String = when (n.type) {
    "share" ->
        if (n.folder_id != null) "A folder was shared with you." else "A file was shared with you."

    "unshare" ->
        if (n.folder_id != null) "A folder is no longer shared with you."
        else "A file is no longer shared with you."

    "owner_leaving" ->
        if (n.folder_id != null) "An owner is deleting their account - save the shared folder to keep it."
        else "An owner is deleting their account - save the shared file to keep it."

    "expiring" -> "An item is expiring soon."
    "expired" -> "A shared item has expired."

    else -> "You have a new notification."
}
