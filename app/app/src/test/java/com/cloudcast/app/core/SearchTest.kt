package com.cloudcast.app.core

import com.cloudcast.app.data.network.FileDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchTest {

    private fun file(name: String, mime: String = "application/octet-stream", id: String = name) =
        FileDto(id = id).apply { original_name = name; mime_type = mime }

    @Test
    fun `classifies by mime when it is trustworthy`() {
        assertEquals(ContentKind.IMAGE, contentKind("image/png", "a.png"))
        assertEquals(ContentKind.VIDEO, contentKind("video/mp4", "a.mp4"))
        assertEquals(ContentKind.AUDIO, contentKind("audio/mpeg", "a.mp3"))
        assertEquals(ContentKind.PDF, contentKind("application/pdf", "a.pdf"))
    }

    @Test
    fun `extension wins when the server's mime is wrong`() {

        assertEquals(ContentKind.CODE, contentKind("text/plain", "config.json"))
        assertEquals(ContentKind.CODE, contentKind("video/mp2t", "main.ts"))
    }

    @Test
    fun `code is classified before archive and text`() {

        assertEquals(ContentKind.CODE, contentKind("application/xml", "pom.xml"))
        assertEquals(ContentKind.ARCHIVE, contentKind("application/octet-stream", "backup.tar.gz"))
        assertEquals(ContentKind.TEXT, contentKind("text/plain", "notes.txt"))
    }

    @Test
    fun `unknown things are other, not text`() {
        assertEquals(ContentKind.OTHER, contentKind("application/octet-stream", "blob.bin"))
        assertEquals(ContentKind.OTHER, contentKind("", ""))
    }

    @Test
    fun `the text chip also covers code and documents`() {

        assertTrue(matchesType(file("a.txt", "text/plain"), "text"))
        assertTrue(matchesType(file("a.kt", "text/plain"), "text"))
        assertTrue(matchesType(file("a.docx"), "text"))
        assertFalse(matchesType(file("a.png", "image/png"), "text"))
    }

    @Test
    fun `a null type matches everything`() {
        assertTrue(matchesType(file("a.png", "image/png"), null))
        assertTrue(matchesType(file("a.bin"), null))
    }

    @Test
    fun `query words imply content kinds`() {
        assertTrue(ContentKind.IMAGE in queryKinds("holiday photos"))
        assertTrue(ContentKind.VIDEO in queryKinds("wedding video"))

        val docs = queryKinds("tax documents")
        assertTrue(ContentKind.PDF in docs && ContentKind.DOC in docs && ContentKind.TEXT in docs)
    }

    @Test
    fun `unrecognised queries imply no kind`() {

        assertTrue(queryKinds("zzz qqq").isEmpty())
        assertTrue(queryKinds("").isEmpty())
    }

    @Test
    fun `cosine similarity behaves at the extremes`() {
        val a = floatArrayOf(1f, 0f, 0f)
        assertEquals(1f, cosineSim(a, floatArrayOf(1f, 0f, 0f)), 1e-6f)
        assertEquals(0f, cosineSim(a, floatArrayOf(0f, 1f, 0f)), 1e-6f)
        assertEquals(-1f, cosineSim(a, floatArrayOf(-1f, 0f, 0f)), 1e-6f)

        assertEquals(1f, cosineSim(a, floatArrayOf(7f, 0f, 0f)), 1e-6f)
    }

    @Test
    fun `zero and empty vectors score zero rather than dividing by zero`() {
        assertEquals(0f, cosineSim(floatArrayOf(0f, 0f), floatArrayOf(1f, 1f)), 1e-6f)
        assertEquals(0f, cosineSim(floatArrayOf(), floatArrayOf(1f)), 1e-6f)
    }

    @Test
    fun `an exact name match outranks meaning`() {

        val named = file("budget.xlsx", id = "named")
        val similar = file("unrelated.txt", id = "similar")
        val q = floatArrayOf(1f, 0f)
        val ranked = rankSemantic(
            files = listOf(similar, named),
            query = "budget",
            queryVector = q,
            vectorsByFileId = mapOf("similar" to floatArrayOf(1f, 0f)),
        )
        assertEquals("named", ranked.first().id)
    }

    @Test
    fun `a type hint outranks meaning but not a name match`() {
        val typed = file("DSC_0001.png", "image/png", id = "typed")
        val similar = file("readme.txt", "text/plain", id = "similar")
        val ranked = rankSemantic(
            files = listOf(similar, typed),
            query = "photos",
            queryVector = floatArrayOf(1f, 0f),
            vectorsByFileId = mapOf("similar" to floatArrayOf(1f, 0f)),
        )
        assertEquals("typed", ranked.first().id)
    }

    @Test
    fun `weak similarity is discarded`() {

        val ranked = rankSemantic(
            files = listOf(file("unrelated.txt", id = "weak")),
            query = "quarterly figures",
            queryVector = floatArrayOf(1f, 0f),
            vectorsByFileId = mapOf("weak" to floatArrayOf(0.4f, 0.92f)),
        )
        assertTrue("weak similarity should not surface: $ranked", ranked.isEmpty())
    }

    @Test
    fun `ranking still works with no embeddings at all`() {

        val ranked = rankSemantic(
            files = listOf(file("budget.xlsx"), file("holiday.png", "image/png")),
            query = "budget",
            queryVector = null,
            vectorsByFileId = emptyMap(),
        )
        assertEquals(1, ranked.size)
        assertEquals("budget.xlsx", ranked.single().original_name)
    }

    @Test
    fun `a word found inside a file surfaces it even when the name does not match`() {

        val doc = file("scan_0042.pdf", "application/pdf", id = "doc")
        val ranked = rankSemantic(
            files = listOf(doc),
            query = "inv-4471",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf("doc" to listOf("inv-4471", "acme", "invoice")),
        )
        assertEquals(1, ranked.size)
    }

    @Test
    fun `a name match still outranks a content match`() {
        val named = file("invoice.pdf", "application/pdf", id = "named")
        val contained = file("scan_0042.pdf", "application/pdf", id = "contained")
        val ranked = rankSemantic(
            files = listOf(contained, named),
            query = "invoice",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf("contained" to listOf("invoice", "acme")),
        )
        assertEquals("named", ranked.first().id)
    }

    @Test
    fun `a content match outranks a type guess`() {

        val contained = file("scan.pdf", "application/pdf", id = "contained")
        val typed = file("holiday.png", "image/png", id = "typed")
        val ranked = rankSemantic(
            files = listOf(typed, contained),
            query = "photo",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf("contained" to listOf("photo", "album")),
        )
        assertEquals("contained", ranked.first().id)
    }

    @Test
    fun `an exact keyword beats a prefix one`() {
        val exact = file("a.txt", "text/plain", id = "exact")
        val prefix = file("b.txt", "text/plain", id = "prefix")
        val ranked = rankSemantic(
            files = listOf(prefix, exact),
            query = "invoice",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf(
                "exact" to listOf("invoice"),
                "prefix" to listOf("invoiced"),
            ),
        )
        assertEquals("exact", ranked.first().id)
    }

    @Test
    fun `multi-word queries are normalised by length`() {

        val all = file("a.txt", "text/plain", id = "all")
        val ranked = rankSemantic(
            files = listOf(all),
            query = "quarterly revenue report",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf("all" to listOf("quarterly", "revenue", "report")),
        )
        assertEquals(1, ranked.size)

        val half = rankSemantic(
            files = listOf(file("b.txt", "text/plain", id = "half")),
            query = "quarterly revenue report",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf("half" to listOf("quarterly")),
        )
        assertEquals(1, half.size)
    }

    @Test
    fun `files with no keywords are unaffected`() {

        val withNone = listOf(file("budget.xlsx", id = "a"), file("holiday.png", "image/png", id = "b"))
        val before = rankSemantic(withNone, "budget", null, emptyMap())
        val after = rankSemantic(withNone, "budget", null, emptyMap(), keywordsByFileId = emptyMap())
        assertEquals(before.map { it.id }, after.map { it.id })
    }

    @Test
    fun `short query terms are ignored for keyword matching`() {

        val ranked = rankSemantic(
            files = listOf(file("a.txt", "text/plain", id = "a")),
            query = "of",
            queryVector = null,
            vectorsByFileId = emptyMap(),
            keywordsByFileId = mapOf("a" to listOf("of", "invoice")),
        )
        assertTrue("2-letter terms shouldn't match: $ranked", ranked.isEmpty())
    }

    @Test
    fun `results are capped`() {
        val many = (1..100).map { file("report-$it.txt", "text/plain", id = "f$it") }
        val ranked = rankSemantic(many, "report", null, emptyMap(), limit = 40)
        assertEquals(40, ranked.size)
    }

    @Test
    fun `a blank query matches nothing`() {

        assertTrue(rankSemantic(listOf(file("a.txt")), "   ", null, emptyMap()).isEmpty())
    }

    @Test
    fun `name matching is case-insensitive`() {
        val ranked = rankSemantic(listOf(file("Budget Q3.xlsx")), "budget", null, emptyMap())
        assertEquals(1, ranked.size)
    }

    @Test
    fun `similarity well behind the best match is discarded`() {

        val strong = file("a.txt", "text/plain", id = "strong")
        val trailing = file("b.txt", "text/plain", id = "trailing")
        val ranked = rankSemantic(
            files = listOf(trailing, strong),
            query = "quarterly figures",
            queryVector = floatArrayOf(1f, 0f),
            vectorsByFileId = mapOf(
                "strong" to floatArrayOf(0.95f, 0.312250f),
                "trailing" to floatArrayOf(0.7f, 0.714143f),
            ),
        )
        assertEquals(listOf("strong"), ranked.map { it.id })
    }

    @Test
    fun `similarity close to the best match is kept`() {

        val best = file("a.txt", "text/plain", id = "best")
        val near = file("b.txt", "text/plain", id = "near")
        val ranked = rankSemantic(
            files = listOf(near, best),
            query = "quarterly figures",
            queryVector = floatArrayOf(1f, 0f),
            vectorsByFileId = mapOf(
                "best" to floatArrayOf(0.95f, 0.312250f),
                "near" to floatArrayOf(0.92f, 0.391918f),
            ),
        )
        assertEquals(setOf("best", "near"), ranked.map { it.id }.toSet())
    }

    @Test
    fun `a file inside a matching folder surfaces without any index`() {

        val filed = FileDto(id = "filed", folder_name = "Handwritten Notes")
            .apply { original_name = "DSC_1232.JPG"; mime_type = "image/jpeg" }
        val ranked = rankSemantic(
            files = listOf(filed),
            query = "notes",
            queryVector = null,
            vectorsByFileId = emptyMap(),
        )
        assertEquals(listOf("filed"), ranked.map { it.id })
    }
}
