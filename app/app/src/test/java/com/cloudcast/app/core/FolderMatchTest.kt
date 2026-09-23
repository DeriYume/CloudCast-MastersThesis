package com.cloudcast.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private data class Folder(
    override val id: String,
    override val parentId: String?,
    override val displayName: String,
) : MatchableFolder

class FolderMatchTest {

    private fun folders(vararg spec: Pair<String, String?>): List<Folder> =
        spec.mapIndexed { i, (name, parent) -> Folder("f$i", parent, name) }

    @Test
    fun anExactNameWins() {
        val fs = folders("Images" to null, "Videos" to null)
        assertEquals("Images", findMatchingFolder(fs, "Images")?.displayName)
    }

    @Test
    fun matchingIsCaseAndSeparatorInsensitive() {
        val fs = folders("my images" to null)
        assertEquals("my images", findMatchingFolder(fs, "My-Images")?.displayName)
    }

    @Test
    fun aSynonymMatchesAnExistingFolder() {
        val fs = folders("Pictures" to null, "Videos" to null)
        assertEquals("Pictures", findMatchingFolder(fs, "Screenshots")?.displayName)
    }

    @Test
    fun pluralsAreFolded() {
        val fs = folders("Photo" to null)
        assertEquals("Photo", findMatchingFolder(fs, "Photos")?.displayName)
    }

    @Test
    fun camelCaseIsSplit() {
        val fs = folders("Screen Captures" to null)
        assertEquals("Screen Captures", findMatchingFolder(fs, "ScreenCapture")?.displayName)
    }

    @Test
    fun anUnrelatedNameMatchesNothing() {
        val fs = folders("Images" to null, "Videos" to null)
        assertNull(findMatchingFolder(fs, "Taxes"))
    }

    @Test
    fun blankMatchesNothing() {
        assertNull(findMatchingFolder(folders("Images" to null), "   "))
    }

    @Test
    fun theShallowerFolderWinsOnATie() {
        val fs = listOf(
            Folder("root", null, "Pictures"),
            Folder("deep", "root", "Pictures"),
        )
        assertEquals("root", findMatchingFolder(fs, "Pictures")?.id)
    }

    @Test
    fun extraUnrelatedWordsArePenalised() {
        val fs = folders("Images" to null, "Images And Taxes And Receipts" to null)
        assertEquals("Images", findMatchingFolder(fs, "Images")?.displayName)
    }

    @Test
    fun noFoldersMatchesNothing() {
        assertNull(findMatchingFolder(emptyList<Folder>(), "Images"))
    }
}
