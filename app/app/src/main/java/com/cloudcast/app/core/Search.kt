package com.cloudcast.app.core

import com.cloudcast.app.data.network.FileDto
import kotlin.math.sqrt

enum class ContentKind { IMAGE, VIDEO, AUDIO, PDF, DOC, ARCHIVE, CODE, TEXT, OTHER }

private val IMAGE_EXTS = Formats.IMAGE_EXTS
private val VIDEO_EXTS = Formats.VIDEO_EXTS
private val AUDIO_EXTS = Formats.AUDIO_EXTS
private val ARCHIVE_EXTS = Formats.ARCHIVE_EXTS
private val DOC_EXTS = Formats.DOC_EXTS
private val CODE_EXTS = Formats.CODE_EXTS
private val TEXT_EXTS = Formats.TEXT_EXTS

fun contentKind(mime: String, name: String): ContentKind {
    val m = mime.lowercase()
    val ext = name.substringAfterLast('.', "").lowercase()
    return when {
        ext in CODE_EXTS -> ContentKind.CODE
        m.startsWith("image/") || ext in IMAGE_EXTS -> ContentKind.IMAGE
        m.startsWith("video/") || ext in VIDEO_EXTS -> ContentKind.VIDEO
        m.startsWith("audio/") || ext in AUDIO_EXTS -> ContentKind.AUDIO
        ext in ARCHIVE_EXTS || Regex("zip|compressed|tar|gzip|x-7z|x-rar").containsMatchIn(m) -> ContentKind.ARCHIVE
        m == "application/pdf" || ext == "pdf" -> ContentKind.PDF
        ext in DOC_EXTS -> ContentKind.DOC
        m.startsWith("text/") || ext in TEXT_EXTS -> ContentKind.TEXT
        else -> ContentKind.OTHER
    }
}

fun queryKinds(query: String): Set<ContentKind> {
    val out = mutableSetOf<ContentKind>()
    for (token in query.lowercase().split(Regex("[^a-z0-9]+"))) {
        if (token.isEmpty()) continue
        Formats.SEARCH_WORDS[token]?.forEach { kind ->
            ContentKind.entries.firstOrNull { it.name.equals(kind, ignoreCase = true) }?.let(out::add)
        }
    }
    return out
}

fun matchesType(file: FileDto, type: String?): Boolean {
    if (type == null) return true
    val kind = contentKind(file.mime_type, file.original_name)
    return when (type) {
        "text" -> kind == ContentKind.TEXT || kind == ContentKind.CODE || kind == ContentKind.DOC
        "image" -> kind == ContentKind.IMAGE
        "video" -> kind == ContentKind.VIDEO
        "audio" -> kind == ContentKind.AUDIO
        "pdf" -> kind == ContentKind.PDF
        else -> true
    }
}

fun cosineSim(a: FloatArray, b: FloatArray): Float {
    var dot = 0f
    var na = 0f
    var nb = 0f
    val n = minOf(a.size, b.size)
    for (i in 0 until n) {
        dot += a[i] * b[i]
        na += a[i] * a[i]
        nb += b[i] * b[i]
    }
    return if (na > 0f && nb > 0f) dot / (sqrt(na) * sqrt(nb)) else 0f
}

fun bestFolderMatch(
    embedding: FloatArray,
    centroids: Map<String, FloatArray>,
    threshold: Float = 0.6f,
): String? {
    var bestId: String? = null
    var bestScore = -1f
    for ((folderId, centroid) in centroids) {
        val score = cosineSim(embedding, centroid)
        if (score > bestScore) {
            bestScore = score
            bestId = folderId
        }
    }
    return if (bestScore >= threshold) bestId else null
}

private const val SEMANTIC_FLOOR = 0.6f
private const val SEMANTIC_GAP = 0.05f

private fun semanticCutoff(values: Collection<Float>): Float {
    val best = values.maxOrNull() ?: return SEMANTIC_FLOOR
    return maxOf(SEMANTIC_FLOOR, best - SEMANTIC_GAP)
}

fun rankSemantic(
    files: List<FileDto>,
    query: String,
    queryVector: FloatArray?,
    vectorsByFileId: Map<String, FloatArray>,
    limit: Int = 40,
    keywordsByFileId: Map<String, List<String>> = emptyMap(),
): List<FileDto> {
    val needle = query.trim().lowercase()
    if (needle.isEmpty()) return emptyList()
    val wantedKinds = queryKinds(needle)

    val terms = needle.split(Regex("[^\\p{L}\\p{N}._-]+")).filter { it.length >= 3 }

    val sims = HashMap<String, Float>()
    if (queryVector != null) {
        for (file in files) {
            vectorsByFileId[file.id]?.let { sims[file.id] = cosineSim(queryVector, it) }
        }
    }
    val semanticFloor = semanticCutoff(sims.values)

    return files
        .map { file ->
            var score = 0f
            if (file.original_name.lowercase().contains(needle)) score += 100f
            if (wantedKinds.isNotEmpty() &&
                contentKind(file.mime_type, file.original_name) in wantedKinds
            ) {
                score += 60f
            }
            if (file.folder_name?.lowercase()?.contains(needle) == true) score += 70f

            val words = keywordsByFileId[file.id]
            if (!words.isNullOrEmpty() && terms.isNotEmpty()) {
                var hits = 0f
                for (term in terms) {
                    when {
                        words.contains(term) -> hits += 1f
                        words.any { it.startsWith(term) } -> hits += 0.5f
                    }
                }

                if (hits > 0f) score += (hits / terms.size) * 80f
            }
            sims[file.id]?.let { c ->
                if (c >= semanticFloor) score += c * 40f
            }
            file to score
        }
        .filter { it.second > 0f }
        .sortedByDescending { it.second }
        .take(limit)
        .map { it.first }
}
