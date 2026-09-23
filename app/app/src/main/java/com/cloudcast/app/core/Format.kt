package com.cloudcast.app.core

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.ln
import kotlin.math.pow

private val zone: ZoneId = ZoneId.systemDefault()
private val dateFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, yyyy").withZone(zone)
private val dateTimeFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a").withZone(zone)
private val dateShortFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d").withZone(zone)

fun formatBytes(bytes: Long): String {
    if (bytes <= 0) return "0 B"
    val i = (ln(bytes.toDouble()) / ln(1024.0)).toInt().coerceIn(0, BYTE_UNITS.size - 1)
    if (i == 0) return "$bytes B"
    val value = bytes / 1024.0.pow(i)
    return String.format("%.1f %s", value, BYTE_UNITS[i])
}

private val BYTE_UNITS = listOf("B", "KB", "MB", "GB", "TB")

fun formatDate(iso: String): String = try {
    dateFormatter.format(Instant.parse(iso))
} catch (e: Exception) {
    iso.take(10)
}

fun formatDateTime(iso: String): String = try {
    dateTimeFormatter.format(Instant.parse(iso))
} catch (e: Exception) {
    iso.take(16)
}

fun truncateName(name: String, max: Int = 18): String =
    if (name.length > max) name.take(max) + "…" else name

fun toIsoFromLocal(epochDay: Long, hour: Int, minute: Int): String? = try {
    val localDate = java.time.LocalDate.ofEpochDay(epochDay)
    val localTime = java.time.LocalTime.of(hour, minute)
    val zoned = java.time.LocalDateTime.of(localDate, localTime)
        .atZone(java.time.ZoneId.systemDefault())
    java.time.format.DateTimeFormatter.ISO_INSTANT.format(zoned.toInstant())
} catch (e: Exception) {
    null
}

fun formatDateShort(iso: String): String = try {
    dateShortFormatter.format(Instant.parse(iso))
} catch (e: Exception) {
    iso.take(10)
}

fun timeLeft(iso: String): String = try {
    val ms = Instant.parse(iso).toEpochMilli() - System.currentTimeMillis()
    when {
        ms <= 0L -> "due now"
        else -> {
            val mins = Math.ceil(ms / 60_000.0).toInt()
            val hours = Math.ceil(ms / 3_600_000.0).toInt()
            when {
                mins < 60 -> if (mins == 1) "1 minute left" else "$mins minutes left"
                hours < 48 -> if (hours == 1) "1 hour left" else "$hours hours left"
                else -> "${Math.ceil(ms / 86_400_000.0).toInt()} days left"
            }
        }
    }
} catch (e: Exception) {
    ""
}

fun formatDurationMs(ms: Long): String {
    val totalSeconds = (ms.coerceAtLeast(0) / 1000)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        String.format("%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%d:%02d", minutes, seconds)
    }
}
