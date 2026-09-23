package com.cloudcast.app.crypto

import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.Box
import com.goterl.lazysodium.interfaces.GenericHash
import com.goterl.lazysodium.interfaces.PwHash
import com.goterl.lazysodium.interfaces.DiffieHellman
import com.goterl.lazysodium.interfaces.SecretBox
import com.sun.jna.NativeLong

object Sodium {

    object Argon2id {
        const val OPS = 3L
        const val MEM = 67108864L
        const val SALT_BYTES = 16
        const val KEY_BYTES = 32
    }

    const val SEALED_BOX_OVERHEAD = 48
    const val SECRETBOX_NONCE_BYTES = 24
    const val SECRETBOX_MAC_BYTES = 16
    const val PUBLIC_KEY_BYTES = 32
    const val SECRET_KEY_BYTES = 32

    private val ls: LazySodiumAndroid by lazy { LazySodiumAndroid(SodiumAndroid()) }

    fun ready() {

        check(ls.randomBytesBuf(1).size == 1) { "libsodium failed to initialise" }
    }

    fun randomBytes(n: Int): ByteArray = ls.randomBytesBuf(n)
    fun generateDek(): ByteArray = randomBytes(32)
    fun generateSalt(): ByteArray = randomBytes(Argon2id.SALT_BYTES)

    data class Keypair(val publicKey: ByteArray, val privateKey: ByteArray) {

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Keypair) return false
            return publicKey.contentEquals(other.publicKey) &&
                privateKey.contentEquals(other.privateKey)
        }

        override fun hashCode(): Int = 31 * publicKey.contentHashCode() + privateKey.contentHashCode()
    }

    fun generateKeypair(): Keypair {
        val pk = ByteArray(PUBLIC_KEY_BYTES)
        val sk = ByteArray(SECRET_KEY_BYTES)
        check((ls as Box.Native).cryptoBoxKeypair(pk, sk)) { "crypto_box_keypair failed" }
        return Keypair(pk, sk)
    }

    fun keypairFromSeed(seed: ByteArray): Keypair {
        require(seed.size == 32) { "seed must be 32 bytes, was ${seed.size}" }
        val pk = ByteArray(PUBLIC_KEY_BYTES)
        val sk = ByteArray(SECRET_KEY_BYTES)
        check((ls as Box.Native).cryptoBoxSeedKeypair(pk, sk, seed)) { "crypto_box_seed_keypair failed" }
        return Keypair(pk, sk)
    }

    fun publicKeyFromSecret(secretKey: ByteArray): ByteArray {
        require(secretKey.size == SECRET_KEY_BYTES) { "secret key must be $SECRET_KEY_BYTES bytes" }
        val pk = ByteArray(PUBLIC_KEY_BYTES)
        check((ls as DiffieHellman.Native).cryptoScalarMultBase(pk, secretKey)) {
            "crypto_scalarmult_base failed"
        }
        return pk
    }

    fun deriveVaultKey(password: String, salt: ByteArray): ByteArray {
        require(salt.size == Argon2id.SALT_BYTES) { "salt must be ${Argon2id.SALT_BYTES} bytes" }
        val out = ByteArray(Argon2id.KEY_BYTES)
        val pw = password.toByteArray(Charsets.UTF_8)
        val ok = (ls as PwHash.Native).cryptoPwHash(
            out, out.size, pw, pw.size, salt,
            Argon2id.OPS, NativeLong(Argon2id.MEM), PwHash.Alg.PWHASH_ALG_ARGON2ID13,
        )
        pw.fill(0)
        check(ok) { "crypto_pwhash failed (out of memory?)" }
        return out
    }

    const val SRP_STRETCH_CONTEXT = "cloudcast-srp-v1:"

    /**
     * The SRP verifier is derived from the password, and a leaked database contains it.
     * Stretching the password with Argon2id first makes guessing against the verifier cost
     * the same as guessing against the vault, instead of a single SHA-256.
     */
    fun srpPassword(password: String, srpSaltHex: String): String {
        val context = (SRP_STRETCH_CONTEXT + srpSaltHex).toByteArray(Charsets.UTF_8)
        val salt = ByteArray(Argon2id.SALT_BYTES)
        check(
            (ls as GenericHash.Native).cryptoGenericHash(salt, salt.size, context, context.size.toLong(), null, 0),
        ) { "crypto_generichash failed" }
        val stretched = deriveVaultKey(password, salt)
        val hex = stretched.joinToString("") { "%02x".format(it) }
        stretched.wipe()
        return hex
    }

    fun recoveryVaultKey(recoveryKey: ByteArray): ByteArray {
        val out = ByteArray(32)
        check(
            (ls as GenericHash.Native).cryptoGenericHash(out, out.size, recoveryKey, recoveryKey.size.toLong(), null, 0),
        ) { "crypto_generichash failed" }
        return out
    }

    fun secretboxSeal(message: ByteArray, key: ByteArray): ByteArray =
        secretboxSealWithNonce(message, key, randomBytes(SECRETBOX_NONCE_BYTES))

    fun secretboxSealWithNonce(message: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray {
        require(nonce.size == SECRETBOX_NONCE_BYTES) { "nonce must be $SECRETBOX_NONCE_BYTES bytes" }
        val ct = ByteArray(message.size + SECRETBOX_MAC_BYTES)
        check((ls as SecretBox.Native).cryptoSecretBoxEasy(ct, message, message.size.toLong(), nonce, key)) {
            "crypto_secretbox_easy failed"
        }
        return nonce + ct
    }

    fun secretboxOpen(blob: ByteArray, key: ByteArray): ByteArray {
        require(blob.size > SECRETBOX_NONCE_BYTES + SECRETBOX_MAC_BYTES) { "secretbox blob is truncated" }
        val nonce = blob.copyOfRange(0, SECRETBOX_NONCE_BYTES)
        val ct = blob.copyOfRange(SECRETBOX_NONCE_BYTES, blob.size)
        val out = ByteArray(ct.size - SECRETBOX_MAC_BYTES)
        check((ls as SecretBox.Native).cryptoSecretBoxOpenEasy(out, ct, ct.size.toLong(), nonce, key)) {
            "secretbox open failed - wrong key or corrupt data"
        }
        return out
    }

    fun sealTo(message: ByteArray, recipientPk: ByteArray): ByteArray {
        val out = ByteArray(message.size + SEALED_BOX_OVERHEAD)
        check((ls as Box.Native).cryptoBoxSeal(out, message, message.size.toLong(), recipientPk)) {
            "crypto_box_seal failed"
        }
        return out
    }

    fun sealOpen(blob: ByteArray, pk: ByteArray, sk: ByteArray): ByteArray {
        require(blob.size > SEALED_BOX_OVERHEAD) { "sealed box is truncated" }
        val out = ByteArray(blob.size - SEALED_BOX_OVERHEAD)
        check((ls as Box.Native).cryptoBoxSealOpen(out, blob, blob.size.toLong(), pk, sk)) {
            "sealed box open failed - not sealed to this key, or corrupt"
        }
        return out
    }
}

fun ByteArray.wipe() = fill(0)
