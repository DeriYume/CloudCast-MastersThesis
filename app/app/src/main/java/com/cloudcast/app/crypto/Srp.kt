package com.cloudcast.app.crypto

import java.math.BigInteger
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale

object Srp {

    private const val N_HEX =
        "AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050" +
            "A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50" +
            "E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B8" +
            "55F97993EC975EEAA80D740ADBF4FF747359D041D5C33EA71D281E446B14773B" +
            "CA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748" +
            "544523B524B0D57D5EA77A2775D2ECFA032CFBDBF52FB37861602790" +
            "04E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8" +
            "E9DBFBB694B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F" +
            "9E4AFF73"

    private val N: BigInteger = BigInteger(N_HEX, 16)
    private val g: BigInteger = BigInteger.valueOf(2)

    private val nBytes: Int = (N.bitLength() + 7) / 8

    private const val HASH_BYTES = 32

    private val k: BigInteger = BigInteger(1, hash(pad(N), byteArrayOf(0x02)))

    private val random = SecureRandom()

    fun generateSalt(): String = ByteArray(HASH_BYTES).also { random.nextBytes(it) }.toHex()

    fun derivePrivateKey(saltHex: String, identity: String, password: String): String {
        val inner = hash("$identity:$password".toByteArray(Charsets.UTF_8))
        return hash(saltHex.fromHex(), inner).toHex()
    }

    fun deriveVerifier(privateKeyHex: String): String =
        g.modPow(BigInteger(privateKeyHex, 16), N).toPaddedHex()

    class Ephemeral(val secret: String, val public: String)

    fun generateEphemeral(): Ephemeral {
        val a = ByteArray(HASH_BYTES).also { random.nextBytes(it) }
        return Ephemeral(
            secret = a.toHex(),
            public = g.modPow(BigInteger(1, a), N).toPaddedHex(),
        )
    }

    class Session(val key: String, val proof: String)

    fun deriveSession(
        clientSecretEphemeral: String,
        serverPublicEphemeral: String,
        saltHex: String,
        identity: String,
        privateKeyHex: String,
    ): Session {
        val a = BigInteger(clientSecretEphemeral, 16)
        val b = BigInteger(serverPublicEphemeral, 16)
        val salt = saltHex.fromHex()
        val x = BigInteger(privateKeyHex, 16)

        require(b.mod(N).signum() != 0) { "The server sent an invalid public ephemeral" }

        val aPub = g.modPow(a, N)
        val u = BigInteger(1, hash(pad(aPub), pad(b)))

        val base = b.subtract(k.multiply(g.modPow(x, N))).mod(N)
        val s = base.modPow(a.add(u.multiply(x)), N)

        val key = hash(pad(s))

        val hN = hash(pad(N))
        val hG = hash(byteArrayOf(0x02))
        val xored = ByteArray(hN.size) { (hN[it].toInt() xor hG[it].toInt()).toByte() }
        val proof = hash(
            xored,
            hash(identity.toByteArray(Charsets.UTF_8)),
            salt,
            pad(aPub),
            pad(b),
            key,
        )

        return Session(key = key.toHex(), proof = proof.toHex())
    }

    fun verifySession(clientPublicEphemeral: String, session: Session, serverProof: String) {
        val expected = hash(
            pad(BigInteger(clientPublicEphemeral, 16)),
            session.proof.fromHex(),
            session.key.fromHex(),
        )
        check(MessageDigest.isEqual(expected, serverProof.fromHex())) {
            "Server provided session proof is invalid"
        }
    }

    private fun hash(vararg parts: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("SHA-256")
        for (p in parts) md.update(p)
        return md.digest()
    }

    private fun pad(v: BigInteger): ByteArray {
        val raw = v.toByteArray()
        val start = if (raw.size > 1 && raw[0] == 0.toByte()) 1 else 0
        val len = raw.size - start
        require(len <= nBytes) { "value wider than the group modulus" }
        return ByteArray(nBytes).also { raw.copyInto(it, nBytes - len, start) }
    }

    private fun BigInteger.toPaddedHex(): String = pad(this).toHex()

    private fun ByteArray.toHex(): String =
        joinToString("") { "%02x".format(Locale.ROOT, it) }

    private fun String.fromHex(): ByteArray {
        require(length % 2 == 0) { "hex string must have an even length" }
        return ByteArray(length / 2) {
            ((digitToIntChecked(this[it * 2]) shl 4) or digitToIntChecked(this[it * 2 + 1])).toByte()
        }
    }

    private fun digitToIntChecked(c: Char): Int {
        val v = Character.digit(c, 16)
        require(v >= 0) { "invalid hex character: $c" }
        return v
    }
}
