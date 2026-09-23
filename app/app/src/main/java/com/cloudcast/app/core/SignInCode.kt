package com.cloudcast.app.core

object SignInCode {

    private const val ALPHABET = Formats.CODE_ALPHABET

    const val LENGTH = Formats.CODE_LENGTH

    private const val GROUP = Formats.CODE_GROUP

    fun normalize(raw: String): String? = raw
        .uppercase()
        .filter { it.isLetterOrDigit() }
        .takeIf { it.isNotEmpty() }

    fun isComplete(canonical: String): Boolean =
        canonical.length == LENGTH && canonical.all { it in ALPHABET }

    fun format(canonical: String): String =
        canonical.chunked(GROUP).joinToString("-")

    fun formatAsTyped(raw: String): String =
        format(normalize(raw).orEmpty().filter { it in ALPHABET }.take(LENGTH))
}
