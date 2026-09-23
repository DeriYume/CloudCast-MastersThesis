package com.cloudcast.app.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object KeystoreVault {

    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "cloudcast.session.v1"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
    private const val IV_BYTES = 12

    class Wrapped(val ivB64: String, val cipherB64: String)

    class SessionBlob(
        val userSk: ByteArray,
        val publicKey: ByteArray,
        val mk: ByteArray,
        val kdfSalt: ByteArray,
        val encryptedPrivateKey: ByteArray,
    )

    private fun keystore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun existingKey(): SecretKey? =
        (keystore().getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.secretKey

    private fun createKey(requireBiometric: Boolean): SecretKey {
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)

            .setRandomizedEncryptionRequired(true)
            .apply {
                if (requireBiometric) {
                    setUserAuthenticationRequired(true)
                    setInvalidatedByBiometricEnrollment(true)
                }
            }
            .build()
        gen.init(spec)
        return gen.generateKey()
    }

    fun clear() {
        runCatching { keystore().deleteEntry(KEY_ALIAS) }
    }

    fun encryptCipher(requireBiometric: Boolean): Cipher {
        clear()
        return Cipher.getInstance(TRANSFORM).apply {
            init(Cipher.ENCRYPT_MODE, createKey(requireBiometric))
        }
    }

    fun decryptCipher(ivB64: String): Cipher? {
        val key = existingKey() ?: return null
        return try {
            val iv = Base64.decode(ivB64, Base64.NO_WRAP)
            require(iv.size == IV_BYTES) { "bad IV length" }
            Cipher.getInstance(TRANSFORM).apply {
                init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
            }
        } catch (_: Exception) {

            null
        }
    }

    fun requiresAuth(): Boolean = try {
        val key = existingKey() ?: return false
        val factory = javax.crypto.SecretKeyFactory.getInstance(key.algorithm, KEYSTORE)
        val info = factory.getKeySpec(key, android.security.keystore.KeyInfo::class.java)
        (info as android.security.keystore.KeyInfo).isUserAuthenticationRequired
    } catch (_: Exception) {
        false
    }

    fun wrapWith(cipher: Cipher, blob: SessionBlob): Wrapped {
        val packed = pack(blob)
        try {
            val out = cipher.doFinal(packed)
            return Wrapped(
                ivB64 = Base64.encodeToString(cipher.iv, Base64.NO_WRAP),
                cipherB64 = Base64.encodeToString(out, Base64.NO_WRAP),
            )
        } finally {
            packed.fill(0)
        }
    }

    fun unwrapWith(cipher: Cipher, cipherB64: String): SessionBlob? = try {
        unpack(cipher.doFinal(Base64.decode(cipherB64, Base64.NO_WRAP)))
    } catch (_: Exception) {
        null
    }

    fun wrap(blob: SessionBlob): Wrapped = wrapWith(encryptCipher(requireBiometric = false), blob)

    fun unwrap(ivB64: String, cipherB64: String): SessionBlob? =
        decryptCipher(ivB64)?.let { unwrapWith(it, cipherB64) }

    private fun pack(b: SessionBlob): ByteArray {
        val parts = listOf(b.userSk, b.publicKey, b.mk, b.kdfSalt, b.encryptedPrivateKey)
        val size = parts.sumOf { 4 + it.size }
        val out = ByteArray(size)
        var o = 0
        for (p in parts) {
            out[o] = (p.size ushr 24).toByte()
            out[o + 1] = (p.size ushr 16).toByte()
            out[o + 2] = (p.size ushr 8).toByte()
            out[o + 3] = p.size.toByte()
            o += 4
            p.copyInto(out, o)
            o += p.size
        }
        return out
    }

    private fun unpack(raw: ByteArray): SessionBlob {
        var o = 0
        fun next(): ByteArray {
            require(o + 4 <= raw.size) { "truncated session blob" }
            val n = ((raw[o].toInt() and 0xFF) shl 24) or
                ((raw[o + 1].toInt() and 0xFF) shl 16) or
                ((raw[o + 2].toInt() and 0xFF) shl 8) or
                (raw[o + 3].toInt() and 0xFF)
            o += 4
            require(n >= 0 && o + n <= raw.size) { "truncated session blob" }
            return raw.copyOfRange(o, o + n).also { o += n }
        }

        return SessionBlob(
            userSk = next(),
            publicKey = next(),
            mk = next(),
            kdfSalt = next(),
            encryptedPrivateKey = next(),
        ).also { raw.fill(0) }
    }
}
