package com.cloudcast.app.core

typealias NameIndex = Map<String, String>

fun indexFromNames(items: List<Pair<String, String>>): NameIndex =
    items.associate { (id, name) -> name.lowercase() to id }

fun <T> indexFrom(items: List<T>, id: (T) -> String, name: (T) -> String): NameIndex =
    items.associate { name(it).lowercase() to id(it) }

fun NameIndex.hasName(name: String): Boolean = containsKey(name.lowercase())

fun NameIndex.idOfName(name: String): String? = this[name.lowercase()]

fun NameIndex.dedupeName(name: String): String {
    if (!hasName(name)) return name
    val dot = name.lastIndexOf('.')
    val base = if (dot > 0) name.substring(0, dot) else name
    val ext = if (dot > 0) name.substring(dot) else ""
    for (n in 1 until 10_000) {
        val candidate = "$base ($n)$ext"
        if (!hasName(candidate)) return candidate
    }

    return "$base (${System.currentTimeMillis()})$ext"
}

class NameConflictException(
    val conflictName: String,
    val existingId: String,
    val isFolder: Boolean,
) : Exception("\"$conflictName\" already exists here")

object OnConflict {
    const val REPLACE = "replace"
    const val RENAME = "rename"
}

suspend fun resolveName(
    index: NameIndex,
    desired: String,
    onConflict: String?,
    isFolder: Boolean,
    excludeId: String? = null,
    deleteExisting: suspend (String) -> Unit = {},
): String {
    val existingId = index.idOfName(desired)
    if (existingId == null || existingId == excludeId) return desired
    return when (onConflict) {
        OnConflict.REPLACE -> {
            deleteExisting(existingId)
            desired
        }
        OnConflict.RENAME -> index.dedupeName(desired)
        else -> throw NameConflictException(desired, existingId, isFolder)
    }
}
