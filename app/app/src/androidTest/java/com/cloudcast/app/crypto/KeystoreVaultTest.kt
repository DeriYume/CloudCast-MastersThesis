package com.cloudcast.app.crypto

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.random.Random

@RunWith(AndroidJUnit4::class)
class KeystoreVaultTest {

    private fun blob(seed: Int) = KeystoreVault.SessionBlob(
        userSk = Random(seed).nextBytes(32),
        publicKey = Random(seed + 1).nextBytes(32),
        mk = Random(seed + 2).nextBytes(32),
        kdfSalt = Random(seed + 3).nextBytes(16),

        encryptedPrivateKey = Random(seed + 4).nextBytes(72),
    )

    @Before fun setUp() = KeystoreVault.clear()

    @After fun tearDown() = KeystoreVault.clear()

    @Test
    fun roundTripsEveryField() {
        val original = blob(1)

        val expected = listOf(
            original.userSk.copyOf(), original.publicKey.copyOf(), original.mk.copyOf(),
            original.kdfSalt.copyOf(), original.encryptedPrivateKey.copyOf(),
        )

        val wrapped = KeystoreVault.wrap(original)
        val restored = KeystoreVault.unwrap(wrapped.ivB64, wrapped.cipherB64)!!

        assertArrayEquals(expected[0], restored.userSk)
        assertArrayEquals(expected[1], restored.publicKey)
        assertArrayEquals(expected[2], restored.mk)
        assertArrayEquals(expected[3], restored.kdfSalt)
        assertArrayEquals(expected[4], restored.encryptedPrivateKey)
    }

    @Test
    fun wrappingAgainRotatesTheKey() {

        val first = KeystoreVault.wrap(blob(2))
        KeystoreVault.wrap(blob(3))
        assertNull(KeystoreVault.unwrap(first.ivB64, first.cipherB64))
    }

    @Test
    fun clearMakesTheBlobUnreadable() {
        val wrapped = KeystoreVault.wrap(blob(4))
        KeystoreVault.clear()
        assertNull(KeystoreVault.unwrap(wrapped.ivB64, wrapped.cipherB64))
    }

    @Test
    fun tamperedCiphertextIsRejected() {

        val wrapped = KeystoreVault.wrap(blob(5))
        val bytes = android.util.Base64.decode(wrapped.cipherB64, android.util.Base64.NO_WRAP)
        bytes[bytes.size / 2] = (bytes[bytes.size / 2].toInt() xor 0x01).toByte()
        val tampered = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
        assertNull(KeystoreVault.unwrap(wrapped.ivB64, tampered))
    }

    @Test
    fun ivsDifferPerWrap() {

        val a = KeystoreVault.wrap(blob(6))
        val b = KeystoreVault.wrap(blob(6))
        assertNotEquals(a.ivB64, b.ivB64)
    }

    @Test
    fun ungatedKeyDoesNotRequireAuth() {
        KeystoreVault.wrap(blob(7))
        assertTrue(!KeystoreVault.requiresAuth())
    }
}
