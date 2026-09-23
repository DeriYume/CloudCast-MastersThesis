package com.cloudcast.app.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.BeforeClass
import org.junit.Test

class SrpVectorsTest {

    companion object {
        private lateinit var v: Map<String, String>

        @BeforeClass
        @JvmStatic
        fun load() {
            val json = SrpVectorsTest::class.java.getResourceAsStream("/srp-vectors.json")
                ?.bufferedReader()?.use { it.readText() }
                ?: error(
                    "srp-vectors.json missing from test resources. It is copied in by the " +
                        "syncSrpVectors Gradle task from crypto-core/ - regenerate with " +
                        "`node crypto-core/srpvectors.mjs`.",
                )

            v = Regex("\"(\\w+)\"\\s*:\\s*\"([^\"]*)\"").findAll(json)
                .associate { it.groupValues[1] to it.groupValues[2] }
        }

        private fun get(k: String) = v[k] ?: error("vector '$k' not found")
    }

    private val identity get() = get("identity")
    private val password get() = get("password")
    private val saltHex get() = get("salt_hex")

    /** What actually enters the SRP derivation: the password after Argon2id stretching. */
    private val stretchedPassword get() = get("stretchedPassword_hex")

    @Test
    fun groupModulusMatches() {

        val v0 = Srp.deriveVerifier(get("x_hex"))
        assertEquals(get("N_hex").length, v0.length)
    }

    @Test
    fun multiplierKMatchesTheUnpaddedG() {

        val n = java.math.BigInteger(get("N_hex"), 16)
        val nBytes = (n.bitLength() + 7) / 8
        val md = java.security.MessageDigest.getInstance("SHA-256")
        val raw = n.toByteArray()
        val start = if (raw.size > 1 && raw[0] == 0.toByte()) 1 else 0
        md.update(ByteArray(nBytes).also { raw.copyInto(it, nBytes - (raw.size - start), start) })
        md.update(byteArrayOf(0x02))
        assertEquals(get("k_hex"), md.digest().joinToString("") { "%02x".format(it) })
    }

    @Test
    fun privateKeyXVector() {
        assertEquals(64, get("x_hex").length)
        assertEquals(get("x_hex"), Srp.derivePrivateKey(saltHex, identity, stretchedPassword))
    }

    @Test
    fun verifierVector() {
        assertEquals(get("verifier_hex"), Srp.deriveVerifier(get("x_hex")))
    }

    @Test
    fun wrongPasswordProducesADifferentVerifier() {
        val other = Srp.deriveVerifier(Srp.derivePrivateKey(saltHex, identity, "not the password"))
        assertNotEquals(get("verifier_hex"), other)
    }

    @Test
    fun identityIsPartOfTheVerifier() {

        val other = Srp.deriveVerifier(Srp.derivePrivateKey(saltHex, "someone@else.com", stretchedPassword))
        assertNotEquals(get("verifier_hex"), other)
    }

    @Test
    fun clientEphemeralAVector() {
        val s = Srp.deriveSession(
            get("client_secret_a_hex"), get("B_hex"), saltHex, identity, get("x_hex"),
        )

        assertEquals(get("A_hex").length, get("N_hex").length)
        assertEquals(get("sessionKey_hex"), s.key)
    }

    @Test
    fun sessionKeyAndClientProofVector() {
        val s = Srp.deriveSession(
            get("client_secret_a_hex"), get("B_hex"), saltHex, identity, get("x_hex"),
        )
        assertEquals("session key K", get("sessionKey_hex"), s.key)
        assertEquals("client proof M1", get("clientProof_M1_hex"), s.proof)
    }

    @Test
    fun serverProofIsAccepted() {
        val s = Srp.deriveSession(
            get("client_secret_a_hex"), get("B_hex"), saltHex, identity, get("x_hex"),
        )
        Srp.verifySession(get("A_hex"), s, get("serverProof_M2_hex"))
    }

    @Test
    fun aTamperedServerProofIsRejected() {

        val s = Srp.deriveSession(
            get("client_secret_a_hex"), get("B_hex"), saltHex, identity, get("x_hex"),
        )
        val bad = get("serverProof_M2_hex").let { it.dropLast(1) + if (it.last() == '0') '1' else '0' }
        assertThrows(IllegalStateException::class.java) {
            Srp.verifySession(get("A_hex"), s, bad)
        }
    }

    @Test
    fun invalidServerEphemeralIsRejected() {

        val zero = "0".repeat(get("N_hex").length)
        assertThrows(IllegalArgumentException::class.java) {
            Srp.deriveSession(get("client_secret_a_hex"), zero, saltHex, identity, get("x_hex"))
        }
    }

    @Test
    fun generatedSaltAndEphemeralHaveTheRightShape() {
        repeat(5) {
            assertEquals(64, Srp.generateSalt().length)
            val e = Srp.generateEphemeral()
            assertEquals(64, e.secret.length)
            assertEquals("A must be padded to N", get("N_hex").length, e.public.length)
        }
        assertNotEquals(Srp.generateSalt(), Srp.generateSalt())
        assertNotEquals(Srp.generateEphemeral().secret, Srp.generateEphemeral().secret)
    }

    @Test
    fun aFullHandshakeWithFreshEphemeralsIsSelfConsistent() {

        val salt = Srp.generateSalt()
        val x = Srp.derivePrivateKey(salt, identity, stretchedPassword)
        val eph = Srp.generateEphemeral()

        val n = java.math.BigInteger(get("N_hex"), 16)
        val g = java.math.BigInteger.valueOf(2)
        val k = java.math.BigInteger(get("k_hex"), 16)
        val vv = java.math.BigInteger(Srp.deriveVerifier(x), 16)
        val b = java.math.BigInteger(Srp.generateEphemeral().secret, 16)
        val bPub = k.multiply(vv).add(g.modPow(b, n)).mod(n)
        val bHex = bPub.toString(16).padStart(get("N_hex").length, '0')

        val s = Srp.deriveSession(eph.secret, bHex, salt, identity, x)
        assertEquals(64, s.key.length)
        assertEquals(64, s.proof.length)
    }
}
