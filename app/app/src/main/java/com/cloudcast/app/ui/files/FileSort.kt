package com.cloudcast.app.ui.files

import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto

enum class SortKey(val label: String) {
    NAME("Name"),
    DATE("Date added"),
    SIZE("Size"),
    TYPE("Type"),
}

private fun extensionOf(name: String): String {
    val i = name.lastIndexOf('.')
    return if (i >= 0) name.substring(i + 1).lowercase() else ""
}

fun sortFiles(files: List<FileDto>, key: SortKey, ascending: Boolean): List<FileDto> {
    val byName = compareBy<FileDto> { it.original_name.lowercase() }
    val comparator = when (key) {
        SortKey.NAME -> byName
        SortKey.DATE -> compareBy<FileDto> { it.created_at }.then(byName)
        SortKey.SIZE -> compareBy<FileDto> { it.size_bytes }.then(byName)
        SortKey.TYPE -> compareBy<FileDto> { extensionOf(it.original_name) }.then(byName)
    }
    val sorted = files.sortedWith(comparator)
    return if (ascending) sorted else sorted.reversed()
}

fun sortFolders(folders: List<FolderDto>, key: SortKey, ascending: Boolean): List<FolderDto> {
    val byName = compareBy<FolderDto> { it.name.lowercase() }
    return when (key) {
        SortKey.NAME -> folders.sortedWith(byName).let { if (ascending) it else it.reversed() }
        SortKey.DATE -> folders.sortedWith(compareBy<FolderDto> { it.created_at }.then(byName))
            .let { if (ascending) it else it.reversed() }
        SortKey.SIZE, SortKey.TYPE -> folders.sortedWith(byName)
    }
}

fun defaultAscending(key: SortKey): Boolean = key == SortKey.NAME || key == SortKey.TYPE
