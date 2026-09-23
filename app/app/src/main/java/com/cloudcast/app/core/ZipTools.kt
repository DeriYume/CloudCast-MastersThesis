package com.cloudcast.app.core

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

object ZipTools {

    data class Entry(
        val path: String,
        val size: Long,
        val compressedSize: Long,
        val isDir: Boolean,
    )

    data class Listing(val entries: List<Entry>, val truncated: Boolean)

    const val MAX_ENTRIES = 5_000

    fun listEntries(bytes: ByteArray, max: Int = MAX_ENTRIES): Listing {

        require(looksLikeZip(bytes)) { "Could not read archive (not a valid zip)" }

        val entries = ArrayList<Entry>()
        var truncated = false
        try {
            ZipInputStream(bytes.inputStream()).use { zis ->
                while (true) {
                    val e = zis.nextEntry ?: break
                    if (entries.size >= max) {
                        truncated = true
                        break
                    }
                    entries += Entry(
                        path = e.name,
                        size = e.size.coerceAtLeast(0),
                        compressedSize = e.compressedSize.coerceAtLeast(0),
                        isDir = e.isDirectory,
                    )
                    zis.closeEntry()
                }
            }
        } catch (e: Exception) {
            throw IllegalArgumentException("Could not read archive (not a valid zip)", e)
        }

        return Listing(entries, truncated)
    }

    private fun looksLikeZip(bytes: ByteArray): Boolean {
        if (bytes.size < 22) return false
        val localHeader = bytes[0] == 0x50.toByte() && bytes[1] == 0x4b.toByte() &&
            bytes[2] == 0x03.toByte() && bytes[3] == 0x04.toByte()
        val emptyArchive = bytes[0] == 0x50.toByte() && bytes[1] == 0x4b.toByte() &&
            bytes[2] == 0x05.toByte() && bytes[3] == 0x06.toByte()
        if (!localHeader && !emptyArchive) return false

        val from = maxOf(0, bytes.size - (64 * 1024 + 22))
        for (i in bytes.size - 22 downTo from) {
            if (bytes[i] == 0x50.toByte() && bytes[i + 1] == 0x4b.toByte() &&
                bytes[i + 2] == 0x05.toByte() && bytes[i + 3] == 0x06.toByte()
            ) {
                return true
            }
        }
        return false
    }

    fun extract(bytes: ByteArray, path: String, maxBytes: Int = 25 * 1024 * 1024): ByteArray? {
        require(looksLikeZip(bytes)) { "Could not read archive (not a valid zip)" }
        ZipInputStream(bytes.inputStream()).use { zis ->
            while (true) {
                val e = zis.nextEntry ?: return null
                if (e.name == path && !e.isDirectory) {
                    return zis.readCapped(maxBytes)
                }
                zis.closeEntry()
            }
        }
    }

    fun safeName(name: String): String =
        (name.ifBlank { "unnamed" })
            .replace(Regex("[/\\\\]"), "_")
            .replace(Regex("^\\.+"), "_")

    suspend fun write(out: OutputStream, build: suspend (ZipWriter) -> Unit) {
        ZipOutputStream(out).use { zos -> build(ZipWriter(zos)) }
    }

    class ZipWriter(private val zos: ZipOutputStream) {
        private val used = HashSet<String>()

        fun add(path: String, bytes: ByteArray) {
            zos.putNextEntry(ZipEntry(unique(path)))
            zos.write(bytes)
            zos.closeEntry()
        }

        fun add(path: String, source: InputStream) {
            zos.putNextEntry(ZipEntry(unique(path)))
            source.copyTo(zos)
            zos.closeEntry()
        }

        private fun unique(path: String): String {
            if (used.add(path)) return path
            val dot = path.lastIndexOf('.')
            val base = if (dot > 0) path.substring(0, dot) else path
            val ext = if (dot > 0) path.substring(dot) else ""
            var n = 1
            while (!used.add("$base ($n)$ext")) n++
            return "$base ($n)$ext"
        }
    }

    private fun InputStream.readCapped(max: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        var total = 0
        while (true) {
            val n = read(buf)
            if (n <= 0) break
            total += n
            if (total > max) throw IllegalStateException("Entry is too large to open")
            out.write(buf, 0, n)
        }
        return out.toByteArray()
    }
}
