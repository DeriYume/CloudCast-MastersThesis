package com.cloudcast.app.core

fun autoFileTarget(mime: String, name: String): String? =
    Formats.KIND_FOLDERS[contentKind(mime, name).name.lowercase()]

enum class AutoFileMode(val key: String) {
    OFF("off"),
    TYPE("type"),
    SMART("smart");

    companion object {

        fun fromKey(key: String?): AutoFileMode =
            entries.firstOrNull { it.key == key } ?: OFF
    }
}
