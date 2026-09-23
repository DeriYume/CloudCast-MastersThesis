package com.cloudcast.app.core

object SharePermissions {

    val VIEW = SharePermission.View.wire
    val SAVE = SharePermission.Save.wire

    const val OWNER = "owner"

    val selectable = SharePermission.entries.map { it.wire }

    fun label(permission: String?): String = when (permission) {
        SAVE -> "View & save"
        OWNER -> "Owner"
        else -> "View only"
    }

    fun canSave(permission: String?): Boolean = permission == SAVE || permission == OWNER

    fun canDownload(permission: String?): Boolean = canSave(permission)
}
