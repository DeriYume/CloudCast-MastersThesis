package com.cloudcast.app.crypto

import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object FileCrypto {

    private const val ALGO = "AES/GCM/NoPadding"
    private val MAGIC = "CCE3".toByteArray(Charsets.US_ASCII)
    private const val NONCE_PREFIX_LEN = 7
    private const val IV_LEN = 12
    private const val TAG_LEN = 16
    const val DEFAULT_CHUNK = 256 * 1024
    const val HEADER_LEN = 4 + NONCE_PREFIX_LEN + 4 + 8

    private fun chunkNonce(prefix: ByteArray, index: Int, isFinal: Boolean): ByteArray {
        val nonce = ByteArray(IV_LEN)
        prefix.copyInto(nonce, 0, 0, NONCE_PREFIX_LEN)
        ByteBuffer.wrap(nonce, NONCE_PREFIX_LEN, 4).order(ByteOrder.BIG_ENDIAN).putInt(index)
        nonce[IV_LEN - 1] = if (isFinal) 1 else 0
        return nonce
    }

    private fun totalChunksFor(plaintextLen: Long, chunkSize: Int): Int =
        if (plaintextLen == 0L) 1 else ((plaintextLen + chunkSize - 1) / chunkSize).toInt()

    private fun buildHeader(noncePrefix: ByteArray, chunkSize: Int, plaintextLen: Long): ByteArray {
        val h = ByteBuffer.allocate(HEADER_LEN).order(ByteOrder.BIG_ENDIAN)
        h.put(MAGIC)
        h.put(noncePrefix)
        h.putInt(chunkSize)
        h.putLong(plaintextLen)
        return h.array()
    }

    private class Parsed(
        val header: ByteArray,
        val noncePrefix: ByteArray,
        val chunkSize: Int,
        val plaintextLen: Long,
        val total: Int,
    )

    private fun parseHeader(buf: ByteArray): Parsed {
        if (buf.size < HEADER_LEN || !buf.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)) {
            throw IllegalArgumentException("Unrecognized or corrupt CCE3 file.")
        }
        val header = buf.copyOfRange(0, HEADER_LEN)
        val bb = ByteBuffer.wrap(header).order(ByteOrder.BIG_ENDIAN)
        val noncePrefix = header.copyOfRange(4, 11)
        val chunkSize = bb.getInt(11)
        val plaintextLen = bb.getLong(15)
        require(chunkSize > 0) { "CCE3 header declares a non-positive chunk size" }
        require(plaintextLen >= 0) { "CCE3 header declares a negative length" }
        return Parsed(header, noncePrefix, chunkSize, plaintextLen, totalChunksFor(plaintextLen, chunkSize))
    }

    private fun cipher(mode: Int, dek: ByteArray, nonce: ByteArray, aad: ByteArray): Cipher =
        Cipher.getInstance(ALGO).apply {
            init(mode, SecretKeySpec(dek, "AES"), GCMParameterSpec(TAG_LEN * 8, nonce))
            updateAAD(aad)
        }

    fun encryptFile(plaintext: ByteArray, dek: ByteArray, chunkSize: Int = DEFAULT_CHUNK): ByteArray =
        encryptWithPrefix(plaintext, dek, Sodium.randomBytes(NONCE_PREFIX_LEN), chunkSize)

    fun encryptWithPrefix(
        plaintext: ByteArray,
        dek: ByteArray,
        noncePrefix: ByteArray,
        chunkSize: Int = DEFAULT_CHUNK,
    ): ByteArray {
        require(dek.size == 32) { "CCE3 requires a 256-bit DEK" }
        require(noncePrefix.size == NONCE_PREFIX_LEN) { "nonce prefix must be $NONCE_PREFIX_LEN bytes" }
        val total = totalChunksFor(plaintext.size.toLong(), chunkSize)
        val header = buildHeader(noncePrefix, chunkSize, plaintext.size.toLong())

        val out = ByteBuffer.allocate(header.size + plaintext.size + total * TAG_LEN)
        out.put(header)
        for (i in 0 until total) {
            val isFinal = i == total - 1
            val from = i * chunkSize
            val to = minOf(from + chunkSize, plaintext.size)
            val c = cipher(Cipher.ENCRYPT_MODE, dek, chunkNonce(noncePrefix, i, isFinal), header)

            out.put(c.doFinal(plaintext, from, maxOf(0, to - from)))
        }
        return out.array()
    }

    private fun decryptChunk(buf: ByteArray, p: Parsed, dek: ByteArray, index: Int): ByteArray {
        val isFinal = index == p.total - 1
        val plainLen = if (isFinal) (p.plaintextLen - index.toLong() * p.chunkSize).toInt() else p.chunkSize
        val offset = HEADER_LEN + index.toLong() * (p.chunkSize + TAG_LEN)
        val end = offset + plainLen + TAG_LEN
        if (plainLen < 0 || end > buf.size) throw IllegalArgumentException("CCE3 file is truncated")
        val c = cipher(Cipher.DECRYPT_MODE, dek, chunkNonce(p.noncePrefix, index, isFinal), p.header)

        return c.doFinal(buf, offset.toInt(), plainLen + TAG_LEN)
    }

    fun decryptFile(cipherBytes: ByteArray, dek: ByteArray): ByteArray {
        val p = parseHeader(cipherBytes)
        val out = ByteBuffer.allocate(p.plaintextLen.toInt())
        for (i in 0 until p.total) out.put(decryptChunk(cipherBytes, p, dek, i))
        return out.array()
    }

    fun decryptRange(cipherBytes: ByteArray, dek: ByteArray, start: Long, end: Long): ByteArray {
        val p = parseHeader(cipherBytes)
        if (p.plaintextLen == 0L) return ByteArray(0)
        val s = maxOf(0L, start)
        val e = minOf(end, p.plaintextLen - 1)
        if (s > e) return ByteArray(0)
        val first = (s / p.chunkSize).toInt()
        val last = (e / p.chunkSize).toInt()
        val buf = ByteBuffer.allocate((last - first + 1) * p.chunkSize)
        for (i in first..last) buf.put(decryptChunk(cipherBytes, p, dek, i))
        val offset = (s - first.toLong() * p.chunkSize).toInt()
        return buf.array().copyOfRange(offset, offset + (e - s + 1).toInt())
    }

    fun plaintextLength(cipherBytes: ByteArray): Long = parseHeader(cipherBytes).plaintextLen
}
