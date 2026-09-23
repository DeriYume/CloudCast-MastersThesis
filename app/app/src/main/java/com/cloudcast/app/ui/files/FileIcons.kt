package com.cloudcast.app.ui.files

import com.cloudcast.app.ui.theme.AppIcons

fun fileIcon(mime: String): String {
    val m = mime.lowercase()
    return when {
        m.startsWith("image/") -> AppIcons.image
        m.startsWith("video/") -> AppIcons.movie
        m.startsWith("audio/") -> AppIcons.musicNote
        m == "application/pdf" -> AppIcons.pictureAsPdf
        Regex("zip|compressed|tar|gzip|x-7z|x-rar").containsMatchIn(m) -> AppIcons.folderZip
        m.startsWith("text/") -> AppIcons.description
        else -> AppIcons.file
    }
}
