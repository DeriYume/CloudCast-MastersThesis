package com.cloudcast.app.crypto

import com.cloudcast.app.data.network.RecoverChallengeRequest
import com.cloudcast.app.data.network.RecoverChallengeResponse
import com.cloudcast.app.data.network.RecoverRequest
import com.cloudcast.app.data.network.RecoverResult
import com.cloudcast.app.data.network.RegisterRequest
import com.cloudcast.app.data.network.RegisterResult
import com.cloudcast.app.data.network.SrpAuthenticateRequest
import com.cloudcast.app.data.network.SrpAuthenticateResponse
import com.cloudcast.app.data.network.SrpChallengeRequest
import com.cloudcast.app.data.network.SrpChallengeResponse
import com.cloudcast.app.data.network.VaultDto
import java.math.BigInteger
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

class FakeAuthServer {

    class Account(
        val email: String,
        val srpSaltHex: String,
        val srpVerifierHex: String,
        val publicKey: String,
        var encryptedPrivateKey: String,
        val recoveryEncryptedPrivateKey: String,
        val kdfSalt: String,
        val mkSealed: String,
    )

    private val accounts = mutableMapOf<String, Account>()
    private val challenges = mutableMapOf<String, Challenge>()
    private val recoveries = mutableMapOf<String, Recovery>()
    private val random = SecureRandom()

    private class Challenge(val email: String, val b: BigInteger, val bPubHex: String)
    private class Recovery(val email: String, val nonce: ByteArray)

    fun account(email: String): Account? = accounts[email.lowercase()]

    var lastServerProof: String? = null
        private set

    private val n = BigInteger(N_HEX, 16)
    private val g = BigInteger.valueOf(2)
    private val nBytes = (n.bitLength() + 7) / 8
    private val k = BigInteger(1, sha256(pad(n), byteArrayOf(0x02)))

    fun register(body: RegisterRequest): RegisterResult {
        val email = body.email.lowercase()
        require(!accounts.containsKey(email)) { "Email or handle already registered" }
        accounts[email] = Account(
            email = email,
            srpSaltHex = body.srp_salt,
            srpVerifierHex = body.srp_verifier,
            publicKey = body.public_key,
            encryptedPrivateKey = body.encrypted_private_key,
            recoveryEncryptedPrivateKey = body.recovery_encrypted_private_key,
            kdfSalt = body.kdf_salt,
            mkSealed = body.mk_sealed,
        )
        return RegisterResult(id = UUID.randomUUID().toString())
    }

    fun srpChallenge(body: SrpChallengeRequest): SrpChallengeResponse {
        val acc = accounts[body.email.lowercase()] ?: error("No such account")

        val b = BigInteger(1, ByteArray(32).also { random.nextBytes(it) })
        val v = BigInteger(acc.srpVerifierHex, 16)
        val bPub = k.multiply(v).add(g.modPow(b, n)).mod(n)
        val id = UUID.randomUUID().toString()
        val bPubHex = pad(bPub).toHex()
        challenges[id] = Challenge(acc.email, b, bPubHex)
        return SrpChallengeResponse(challengeId = id, salt = acc.srpSaltHex, serverPublic = bPubHex)
    }

    fun srpAuthenticate(body: SrpAuthenticateRequest): SrpAuthenticateResponse {
        val ch = challenges.remove(body.challengeId) ?: error("Authentication failed")
        val acc = accounts[ch.email] ?: error("User not found")

        val aPub = BigInteger(body.clientPublic, 16)
        require(aPub.mod(n).signum() != 0) { "invalid client ephemeral" }

        val v = BigInteger(acc.srpVerifierHex, 16)
        val u = BigInteger(1, sha256(pad(aPub), pad(BigInteger(ch.bPubHex, 16))))

        val s = aPub.multiply(v.modPow(u, n)).modPow(ch.b, n)
        val key = sha256(pad(s))

        val hN = sha256(pad(n))
        val hG = sha256(byteArrayOf(0x02))
        val xored = ByteArray(hN.size) { (hN[it].toInt() xor hG[it].toInt()).toByte() }
        val expectedM1 = sha256(
            xored,
            sha256(acc.email.toByteArray(Charsets.UTF_8)),
            acc.srpSaltHex.fromHex(),
            pad(aPub),
            pad(BigInteger(ch.bPubHex, 16)),
            key,
        )

        check(MessageDigest.isEqual(expectedM1, body.clientProof.fromHex())) {
            "Authentication failed"
        }

        val m2 = sha256(pad(aPub), expectedM1, key).toHex()
        lastServerProof = m2
        return SrpAuthenticateResponse(
            token = "fake-jwt-${UUID.randomUUID()}",
            serverProof = m2,
            rotationRequired = false,
            pendingDeletion = null,
            vault = VaultDto(
                public_key = acc.publicKey,
                encrypted_private_key = acc.encryptedPrivateKey,
                kdf_salt = acc.kdfSalt,
                mk_sealed = acc.mkSealed,
            ),
        )
    }

    fun recoverChallenge(body: RecoverChallengeRequest): RecoverChallengeResponse {
        val acc = accounts[body.email.lowercase()] ?: error("No such account")
        val nonce = Sodium.randomBytes(32)
        val id = UUID.randomUUID().toString()
        recoveries[id] = Recovery(acc.email, nonce)
        return RecoverChallengeResponse(
            challengeId = id,
            recovery_encrypted_private_key = acc.recoveryEncryptedPrivateKey,
            kdf_salt = acc.kdfSalt,

            sealed_nonce = Session.b64(Sodium.sealTo(nonce, Session.unb64(acc.publicKey))),
        )
    }

    fun recoverSubmit(body: RecoverRequest): RecoverResult {
        val rec = recoveries.remove(body.challengeId) ?: error("Invalid or expired challenge")
        val answered = Session.unb64(body.nonce)
        check(MessageDigest.isEqual(answered, rec.nonce)) { "Proof of possession failed" }
        val acc = accounts[rec.email]!!
        accounts[rec.email] = Account(
            email = acc.email,
            srpSaltHex = body.srp_salt,
            srpVerifierHex = body.srp_verifier,
            publicKey = acc.publicKey,
            encryptedPrivateKey = body.encrypted_private_key,
            recoveryEncryptedPrivateKey = acc.recoveryEncryptedPrivateKey,
            kdfSalt = acc.kdfSalt,
            mkSealed = acc.mkSealed,
        )
        return RecoverResult(recovered = true)
    }

    private fun sha256(vararg parts: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("SHA-256")
        for (p in parts) md.update(p)
        return md.digest()
    }

    private fun pad(v: BigInteger): ByteArray {
        val raw = v.toByteArray()
        val start = if (raw.size > 1 && raw[0] == 0.toByte()) 1 else 0
        val len = raw.size - start
        return ByteArray(nBytes).also { raw.copyInto(it, nBytes - len, start) }
    }

    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }

    private fun String.fromHex() =
        ByteArray(length / 2) { ((Character.digit(this[it * 2], 16) shl 4) or Character.digit(this[it * 2 + 1], 16)).toByte() }

    private companion object {
        const val N_HEX =
            "AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050" +
                "A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50" +
                "E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B8" +
                "55F97993EC975EEAA80D740ADBF4FF747359D041D5C33EA71D281E446B14773B" +
                "CA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748" +
                "544523B524B0D57D5EA77A2775D2ECFA032CFBDBF52FB37861602790" +
                "04E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8" +
                "E9DBFBB694B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F" +
                "9E4AFF73"
    }
}
