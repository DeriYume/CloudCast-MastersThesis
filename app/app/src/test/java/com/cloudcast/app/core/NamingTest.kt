package com.cloudcast.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import kotlinx.coroutines.runBlocking
import org.junit.Test

class NamingTest {

    private fun index(vararg names: String): NameIndex =
        indexFromNames(names.mapIndexed { i, n -> "id$i" to n })

    @Test
    fun findsAnExactName() {
        val idx = index("report.pdf", "notes.txt")
        assertTrue(idx.hasName("report.pdf"))
        assertEquals("id0", idx.idOfName("report.pdf"))
        assertEquals("id1", idx.idOfName("notes.txt"))
    }

    @Test
    fun lookupIsCaseInsensitive() {

        val idx = index("report.pdf")
        assertTrue(idx.hasName("REPORT.PDF"))
        assertTrue(idx.hasName("Report.Pdf"))
        assertEquals("id0", idx.idOfName("RePoRt.pDf"))
    }

    @Test
    fun missingNameReportsNothing() {
        val idx = index("report.pdf")
        assertFalse(idx.hasName("other.pdf"))
        assertNull(idx.idOfName("other.pdf"))
    }

    @Test
    fun anEmptyIndexNeverMatches() {
        assertFalse(emptyMap<String, String>().hasName("anything"))
    }

    @Test
    fun aFreeNameIsReturnedUnchanged() {
        assertEquals("report.pdf", index("other.pdf").dedupeName("report.pdf"))
    }

    @Test
    fun theCounterGoesBeforeTheExtension() {
        assertEquals("report (1).pdf", index("report.pdf").dedupeName("report.pdf"))
    }

    @Test
    fun theCounterSkipsNamesAlreadyTaken() {
        val idx = index("report.pdf", "report (1).pdf", "report (2).pdf")
        assertEquals("report (3).pdf", idx.dedupeName("report.pdf"))
    }

    @Test
    fun dedupeIsCaseInsensitiveToo() {

        val idx = index("report.pdf", "Report (1).pdf")
        assertEquals("report (2).pdf", idx.dedupeName("report.pdf"))
    }

    @Test
    fun aNameWithNoExtensionGetsTheSuffixAtTheEnd() {
        assertEquals("README (1)", index("README").dedupeName("README"))
    }

    @Test
    fun aLeadingDotNameIsTreatedAsHavingNoExtension() {

        assertEquals(".env (1)", index(".env").dedupeName(".env"))
        assertEquals(".gitignore (1)", index(".gitignore").dedupeName(".gitignore"))
    }

    @Test
    fun onlyTheLastDotCountsAsTheExtension() {
        assertEquals(
            "archive.tar (1).gz",
            index("archive.tar.gz").dedupeName("archive.tar.gz"),
        )
    }

    @Test
    fun aTrailingDotKeepsItsPosition() {
        assertEquals("weird (1).", index("weird.").dedupeName("weird."))
    }

    @Test
    fun dedupedNamesAreThemselvesFree() {

        var idx = index("a.txt")
        repeat(50) {
            val next = idx.dedupeName("a.txt")
            assertFalse("dedupe returned a taken name: $next", idx.hasName(next))
            idx = idx + (next.lowercase() to "id-$it")
        }
    }

    @Test
    fun unicodeAndSpacesSurvive() {
        val idx = index("Tax Return 2026 - final.pdf")
        assertEquals(
            "Tax Return 2026 - final (1).pdf",
            idx.dedupeName("Tax Return 2026 - final.pdf"),
        )
    }

    private fun idx(vararg names: String): NameIndex =
        indexFromNames(names.mapIndexed { i, n -> "id$i" to n })

    @Test
    fun `a free name passes through untouched`() = runBlocking {
        assertEquals("report.pdf", resolveName(idx("other.pdf"), "report.pdf", null, false))
    }

    @Test
    fun `a taken name with no directive throws so the UI can ask`() = runBlocking {
        val e = runCatching { resolveName(idx("report.pdf"), "report.pdf", null, false) }
            .exceptionOrNull()
        assertTrue("expected NameConflictException, got $e", e is NameConflictException)
        assertEquals("id0", (e as NameConflictException).existingId)
        assertEquals("report.pdf", e.conflictName)
    }

    @Test
    fun `conflicts are case-insensitive`() = runBlocking {

        val e = runCatching { resolveName(idx("report.pdf"), "REPORT.PDF", null, false) }
            .exceptionOrNull()
        assertTrue(e is NameConflictException)
    }

    @Test
    fun `rename directive appends a counter`() = runBlocking {
        assertEquals(
            "report (1).pdf",
            resolveName(idx("report.pdf"), "report.pdf", OnConflict.RENAME, false),
        )
    }

    @Test
    fun `replace directive deletes the existing item and keeps the name`() = runBlocking {
        var deleted: String? = null
        val result = resolveName(
            idx("report.pdf"), "report.pdf", OnConflict.REPLACE, false,
            deleteExisting = { deleted = it },
        )
        assertEquals("report.pdf", result)
        assertEquals("id0", deleted)
    }

    @Test
    fun `an item never conflicts with itself`() = runBlocking {

        assertEquals(
            "report.pdf",
            resolveName(idx("report.pdf"), "report.pdf", null, false, excludeId = "id0"),
        )
        assertEquals(
            "Report.pdf",
            resolveName(idx("report.pdf"), "Report.pdf", null, false, excludeId = "id0"),
        )
    }

    @Test
    fun `excluding one item still catches a different one`() = runBlocking {

        val e = runCatching {
            resolveName(idx("a.txt", "b.txt"), "b.txt", null, false, excludeId = "id0")
        }.exceptionOrNull()
        assertTrue("expected a conflict with the OTHER file, got $e", e is NameConflictException)
        assertEquals("id1", (e as NameConflictException).existingId)
    }
}
