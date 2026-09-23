package com.cloudcast.app.core

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream

class ZipToolsTest {

    private fun zipOf(vararg entries: Pair<String, String>): ByteArray {
        val out = ByteArrayOutputStream()
        runBlocking {
            ZipTools.write(out) { zip ->
                for ((path, body) in entries) zip.add(path, body.toByteArray())
            }
        }
        return out.toByteArray()
    }

    @Test
    fun `round trips content through write, list and extract`() {
        val bytes = zipOf("a.txt" to "hello", "dir/b.txt" to "world")
        val listing = ZipTools.listEntries(bytes)

        assertEquals(setOf("a.txt", "dir/b.txt"), listing.entries.map { it.path }.toSet())
        assertFalse(listing.truncated)
        assertArrayEquals("hello".toByteArray(), ZipTools.extract(bytes, "a.txt"))
        assertArrayEquals("world".toByteArray(), ZipTools.extract(bytes, "dir/b.txt"))
    }

    @Test
    fun `extract returns null for a path that isn't there`() {

        assertNull(ZipTools.extract(zipOf("a.txt" to "x"), "nope.txt"))
    }

    @Test
    fun `sizes are never negative`() {

        for (e in ZipTools.listEntries(zipOf("a.txt" to "hello")).entries) {
            assertTrue("size was ${e.size}", e.size >= 0)
            assertTrue("compressedSize was ${e.compressedSize}", e.compressedSize >= 0)
        }
    }

    @Test
    fun `listing is capped and says so`() {
        val many = (1..50).map { "f$it.txt" to "x" }.toTypedArray()
        val listing = ZipTools.listEntries(zipOf(*many), max = 10)
        assertEquals(10, listing.entries.size)
        assertTrue("truncation must be reported, not silent", listing.truncated)
    }

    @Test
    fun `an empty archive lists as empty rather than failing`() {

        val emptyZip = byteArrayOf(
            0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        )
        val listing = ZipTools.listEntries(emptyZip)
        assertTrue(listing.entries.isEmpty())
        assertFalse(listing.truncated)
    }

    @Test
    fun `non-zip input is rejected loudly`() {

        val garbage = ByteArray(512) { it.toByte() }
        val e = runCatching { ZipTools.listEntries(garbage) }.exceptionOrNull()
        assertTrue("expected IllegalArgumentException, got $e", e is IllegalArgumentException)
    }

    @Test
    fun `safeName blocks separators and traversal`() {

        assertEquals("a_b", ZipTools.safeName("a/b"))
        assertEquals("a_b", ZipTools.safeName("a\\b"))
        assertEquals("_", ZipTools.safeName(".."))

        assertEquals("__.._etc_passwd", ZipTools.safeName("../../etc/passwd"))
        assertEquals("_hidden", ZipTools.safeName(".hidden"))
        assertEquals("unnamed", ZipTools.safeName(""))

        assertEquals("report.final.pdf", ZipTools.safeName("report.final.pdf"))
    }

    @Test
    fun `duplicate paths are suffixed rather than throwing`() {

        val out = ByteArrayOutputStream()
        runBlocking {
            ZipTools.write(out) { zip ->
                zip.add("a.txt", "first".toByteArray())
                zip.add("a.txt", "second".toByteArray())
                zip.add("a.txt", "third".toByteArray())
            }
        }
        val paths = ZipTools.listEntries(out.toByteArray()).entries.map { it.path }
        assertEquals(listOf("a.txt", "a (1).txt", "a (2).txt"), paths)

        assertArrayEquals("second".toByteArray(), ZipTools.extract(out.toByteArray(), "a (1).txt"))
    }

    @Test
    fun `extract refuses an entry larger than the cap`() {

        val bytes = zipOf("big.txt" to "x".repeat(10_000))
        val e = runCatching { ZipTools.extract(bytes, "big.txt", maxBytes = 100) }.exceptionOrNull()
        assertTrue("expected IllegalStateException, got $e", e is IllegalStateException)
    }

    @Test
    fun `nested folder structure survives a round trip`() {
        val bytes = zipOf(
            "top/a.txt" to "1",
            "top/sub/b.txt" to "2",
            "top/sub/deeper/c.txt" to "3",
        )
        val paths = ZipTools.listEntries(bytes).entries.map { it.path }.toSet()
        assertEquals(setOf("top/a.txt", "top/sub/b.txt", "top/sub/deeper/c.txt"), paths)
        assertArrayEquals("3".toByteArray(), ZipTools.extract(bytes, "top/sub/deeper/c.txt"))
    }
}
