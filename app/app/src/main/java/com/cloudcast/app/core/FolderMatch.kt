package com.cloudcast.app.core

private val WORD_GROUPS: Map<String, List<Int>> = buildMap {
    Formats.FOLDER_CONCEPTS.forEachIndexed { index, group ->
        group.forEach { word -> put(word, (get(word) ?: emptyList()) + index) }
    }
}

private fun singular(word: String): String =
    if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) word.dropLast(1) else word

internal fun wordsOf(name: String): List<String> =
    name.replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
        .lowercase()
        .split(Regex("[^a-z0-9]+"))
        .filter { it.isNotEmpty() }
        .map(::singular)

private fun conceptsOf(word: String): List<String> =
    listOf("w:$word") + (WORD_GROUPS[word]?.map { "g:$it" } ?: emptyList())

private fun conceptSet(words: List<String>): Set<String> =
    words.flatMap(::conceptsOf).toSet()

interface MatchableFolder {
    val id: String
    val parentId: String?
    val displayName: String
}

private fun depthOf(byId: Map<String, MatchableFolder>, folder: MatchableFolder): Int {
    var depth = 0
    var current: MatchableFolder? = folder
    val seen = mutableSetOf<String>()
    while (current?.parentId != null && seen.add(current.id)) {
        current = byId[current.parentId]
        depth++
    }
    return depth
}

fun <T : MatchableFolder> findMatchingFolder(folders: List<T>, category: String): T? {
    val queryWords = wordsOf(category)
    if (queryWords.isEmpty()) return null
    val queryConcepts = conceptSet(queryWords)
    val queryKey = queryWords.sorted().joinToString(" ")

    val byId: Map<String, MatchableFolder> = folders.associateBy { it.id }
    var best: T? = null
    var bestScore = 0
    var bestDepth = Int.MAX_VALUE

    for (folder in folders) {
        val folderWords = wordsOf(folder.displayName)
        if (folderWords.isEmpty()) continue

        val folderConcepts = conceptSet(folderWords)
        val shared = queryConcepts.count { it in folderConcepts }
        if (shared == 0) continue

        val wordExact = folderWords.count { it in queryWords }
        val unmatched = folderWords.count { word -> conceptsOf(word).none { it in queryConcepts } }
        val exactFull = folderWords.size == queryWords.size && folderWords.sorted().joinToString(" ") == queryKey

        val score = shared * 10 + wordExact * 5 + (if (exactFull) 50 else 0) - unmatched * 3
        if (score <= 0) continue

        val depth = depthOf(byId, folder)
        val better = score > bestScore ||
            (score == bestScore && (depth < bestDepth ||
                (depth == bestDepth && best != null &&
                    folder.displayName.lowercase() < best!!.displayName.lowercase())))
        if (better) {
            best = folder
            bestScore = score
            bestDepth = depth
        }
    }
    return best
}
