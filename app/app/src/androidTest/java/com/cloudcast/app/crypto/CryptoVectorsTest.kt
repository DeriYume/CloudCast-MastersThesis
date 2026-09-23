package com.cloudcast.app.crypto

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CryptoVectorsTest {

    companion object {
        private lateinit var v: JSONObject

        @BeforeClass
        @JvmStatic
        fun load() {
            Sodium.ready()
            val ctx = InstrumentationRegistry.getInstrumentation().context
            v = JSONObject(ctx.assets.open("test-vectors.json").bufferedReader().use { it.readText() })
        }

        private fun inputs() = v.getJSONObject("inputs")
        private fun expected() = v.getJSONObject("expected")
    }

    private fun hex(s: String): ByteArray =
        ByteArray(s.length / 2) { ((s[it * 2].digitToInt(16) shl 4) or s[it * 2 + 1].digitToInt(16)).toByte() }

    private fun ByteArray.hex(): String = joinToString("") { "%02x".format(it) }

    @Test
    fun argon2idParamsMatchTheContract() {
        val p = v.getJSONObject("params").getJSONObject("argon2id")
        assertEquals(p.getLong("OPS"), Sodium.Argon2id.OPS)
        assertEquals(p.getLong("MEM"), Sodium.Argon2id.MEM)
        assertEquals(p.getInt("SALTBYTES"), Sodium.Argon2id.SALT_BYTES)
        assertEquals(p.getInt("KEYBYTES"), Sodium.Argon2id.KEY_BYTES)
    }

    @Test
    fun sealedBoxOverheadMatches() {

        assertEquals(v.getJSONObject("params").getInt("sealedBoxBytes"), 32 + Sodium.SEALED_BOX_OVERHEAD)
        assertEquals(v.getJSONObject("params").getInt("secretboxNonceBytes"), Sodium.SECRETBOX_NONCE_BYTES)
    }

    @Test
    fun argon2idVaultKeyVector() {
        val key = Sodium.deriveVaultKey(inputs().getString("password"), hex(inputs().getString("salt_hex")))
        assertEquals(expected().getString("argon2id_vaultKey"), key.hex())
    }

    @Test
    fun seedKeypairVector() {
        val kp = Sodium.keypairFromSeed(hex(inputs().getString("keypair_seed_hex")))
        assertEquals(expected().getString("userPK"), kp.publicKey.hex())
        assertEquals(expected().getString("userSK"), kp.privateKey.hex())
    }

    @Test
    fun recoveryKdfVector() {
        val k = Sodium.recoveryVaultKey(hex(inputs().getString("recovery_key_hex")))
        assertEquals(expected().getString("recoveryKdfKey"), k.hex())
    }

    @Test
    fun secretboxDeterministicVector() {
        val vaultKey = hex(expected().getString("argon2id_vaultKey"))
        val message = hex(expected().getString("userSK"))
        val nonce = hex(inputs().getString("secretbox_nonce_hex"))
        val ct = Sodium.secretboxSealWithNonce(message, vaultKey, nonce)
        assertEquals(expected().getString("secretbox_ct"), ct.hex())

        assertArrayEquals(message, Sodium.secretboxOpen(ct, vaultKey))
    }

    @Test
    fun cce3CiphertextVector() {
        val dek = hex(inputs().getString("dek_hex"))
        val prefix = hex(inputs().getString("cce3_nonce_prefix_hex"))
        val chunk = inputs().getInt("cce3_chunk_size")
        val plain = inputs().getString("cce3_plaintext_utf8").toByteArray(Charsets.UTF_8)

        val ct = FileCrypto.encryptWithPrefix(plain, dek, prefix, chunk)
        assertEquals(
            "CCE3 bytes differ from crypto-core - files will not cross-decrypt",
            expected().getString("cce3_ciphertext"), ct.hex(),
        )

        val reference = hex(expected().getString("cce3_ciphertext"))
        assertArrayEquals(plain, FileCrypto.decryptFile(reference, dek))
        assertEquals(plain.size.toLong(), FileCrypto.plaintextLength(reference))
    }

    @Test
    fun cce3RangeReadMatchesSlice() {
        val dek = hex(inputs().getString("dek_hex"))
        val plain = inputs().getString("cce3_plaintext_utf8").toByteArray(Charsets.UTF_8)
        val reference = hex(expected().getString("cce3_ciphertext"))

        assertArrayEquals(plain.copyOfRange(10, 30), FileCrypto.decryptRange(reference, dek, 10, 29))
        assertArrayEquals(plain, FileCrypto.decryptRange(reference, dek, 0, plain.size - 1L))
    }

    @Test
    fun cce3RejectsTampering() {
        val dek = hex(inputs().getString("dek_hex"))
        val tampered = hex(expected().getString("cce3_ciphertext")).also { it[30] = (it[30].toInt() xor 1).toByte() }
        assertThrows(Exception::class.java) { FileCrypto.decryptFile(tampered, dek) }
    }

    @Test
    fun passwordAndRecoveryUnlockTheSameKey() {
        val u = UserKeys.createUserKeys("s3cret-pass")
        val fromPw = UserKeys.privateKeyFromPassword("s3cret-pass", u.salt, u.encryptedPrivateKey)
        val fromRec = UserKeys.privateKeyFromRecovery(u.recoveryCode, u.recoveryEncryptedPrivateKey)
        assertArrayEquals(fromPw, fromRec)
    }

    @Test
    fun wrongPasswordIsRejected() {
        val u = UserKeys.createUserKeys("s3cret-pass")
        assertThrows(Exception::class.java) {
            UserKeys.privateKeyFromPassword("nope", u.salt, u.encryptedPrivateKey)
        }
    }

    @Test
    fun changePasswordRewrapsTheSameKey() {
        val u = UserKeys.createUserKeys("old-pass")
        val sk = UserKeys.privateKeyFromPassword("old-pass", u.salt, u.encryptedPrivateKey)
        val rewrapped = UserKeys.rewrapForNewPassword(sk, "brand-new-pass", u.salt)
        assertArrayEquals(sk, UserKeys.privateKeyFromPassword("brand-new-pass", u.salt, rewrapped))
    }

    @Test
    fun recoveryCodeSurvivesBase64UrlRoundTrip() {

        repeat(20) {
            val raw = Sodium.randomBytes(32)
            val code = UserKeys.encodeRecoveryCode(raw)
            assertTrue("unexpected char in recovery code: $code", code.all { c -> c.isLetterOrDigit() || c == '-' || c == '_' })
            assertArrayEquals(raw, UserKeys.decodeRecoveryCode(code))
        }
    }

    @Test
    fun dekSharingOwnerRecipientStranger() {
        val owner = UserKeys.createUserKeys("owner-pass")
        val ownerSk = UserKeys.privateKeyFromPassword("owner-pass", owner.salt, owner.encryptedPrivateKey)
        val recip = UserKeys.createUserKeys("recip-pass")
        val recipSk = UserKeys.privateKeyFromPassword("recip-pass", recip.salt, recip.encryptedPrivateKey)
        val dek = Sodium.generateDek()

        assertArrayEquals(
            dek,
            UserKeys.unwrapDek(UserKeys.wrapDekFor(dek, owner.publicKey), owner.publicKey, ownerSk),
        )
        val forRecip = UserKeys.wrapDekFor(dek, recip.publicKey)
        assertArrayEquals(dek, UserKeys.unwrapDek(forRecip, recip.publicKey, recipSk))
        assertThrows(Exception::class.java) {
            UserKeys.unwrapDek(forRecip, owner.publicKey, ownerSk)
        }
    }

    @Test
    fun sealedBoxIsNonDeterministic() {

        val kp = Sodium.generateKeypair()
        val dek = Sodium.generateDek()
        assertNotEquals(Sodium.sealTo(dek, kp.publicKey).hex(), Sodium.sealTo(dek, kp.publicKey).hex())
    }

    @Test
    fun cce3HandlesEmptyAndBoundaryLengths() {
        val dek = Sodium.generateDek()

        for (n in listOf(0, 1, 19, 20, 21, 40, 41)) {
            val plain = Sodium.randomBytes(n)
            val ct = FileCrypto.encryptFile(plain, dek, chunkSize = 20)
            assertArrayEquals("length $n failed", plain, FileCrypto.decryptFile(ct, dek))
            assertEquals(n.toLong(), FileCrypto.plaintextLength(ct))
        }
    }

    @Test
    fun srpPasswordMatchesTheSharedVector() {
        val ctx = InstrumentationRegistry.getInstrumentation().context
        val srp = JSONObject(ctx.assets.open("srp-vectors.json").bufferedReader().use { it.readText() })
        val inputs = srp.getJSONObject("inputs")
        assertEquals(
            srp.getJSONObject("expected").getString("stretchedPassword_hex"),
            Sodium.srpPassword(inputs.getString("password"), inputs.getString("salt_hex")),
        )
    }

    @Test
    fun srpPasswordIsBoundToTheSalt() {
        assertNotEquals(
            Sodium.srpPassword("hunter2", "00".repeat(32)),
            Sodium.srpPassword("hunter2", "11".repeat(32)),
        )
    }

    @Test
    fun cce3RejectsAWrongDek() {
        val plain = Sodium.randomBytes(100)
        val ct = FileCrypto.encryptFile(plain, Sodium.generateDek())
        assertThrows(Exception::class.java) { FileCrypto.decryptFile(ct, Sodium.generateDek()) }
    }
}
