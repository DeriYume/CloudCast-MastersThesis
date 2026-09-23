package com.cloudcast.app.data.network

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthDtoContractTest {

    private val gson = Gson()

    private fun json(v: Any): JsonObject = JsonParser.parseString(gson.toJson(v)).asJsonObject

    private fun assertKeys(expected: Set<String>, actual: JsonObject, what: String) {
        val got = actual.keySet()
        val missing = expected - got
        val unexpected = got - expected
        assertTrue(
            "$what is missing keys the server requires: $missing (sent: $got)",
            missing.isEmpty(),
        )
        assertTrue(
            "$what sends keys the server does not read: $unexpected",
            unexpected.isEmpty(),
        )
    }

    @Test
    fun registerRequestMatchesTheServersRequiredFields() {
        val body = RegisterRequest(
            email = "a@b.com",
            srp_salt = "aa",
            srp_verifier = "bb",
            public_key = "cc",
            encrypted_private_key = "dd",
            recovery_encrypted_private_key = "ee",
            kdf_salt = "ff",
            mk_sealed = "gg",
        )
        assertKeys(
            setOf(
                "email", "srp_salt", "srp_verifier", "public_key",
                "encrypted_private_key", "recovery_encrypted_private_key",
                "kdf_salt", "mk_sealed",
            ),
            json(body),
            "RegisterRequest",
        )
    }

    @Test
    fun srpChallengeRequestShape() {
        assertKeys(setOf("email"), json(SrpChallengeRequest("a@b.com")), "SrpChallengeRequest")
    }

    @Test
    fun srpAuthenticateRequestShape() {

        assertKeys(
            setOf("challengeId", "clientPublic", "clientProof"),
            json(SrpAuthenticateRequest("id", "A", "M1")),
            "SrpAuthenticateRequest",
        )
    }

    @Test
    fun srpChallengeResponseParsesTheServersShape() {
        val res = gson.fromJson(
            """{"challengeId":"c1","salt":"aabb","serverPublic":"ccdd"}""",
            SrpChallengeResponse::class.java,
        )
        assertEquals("c1", res.challengeId)
        assertEquals("aabb", res.salt)
        assertEquals("ccdd", res.serverPublic)
    }

    @Test
    fun srpAuthenticateResponseParsesTheServersShape() {

        val res = gson.fromJson(
            """
            {"token":"jwt","serverProof":"M2","rotationRequired":false,"pendingDeletion":null,
             "vault":{"public_key":"pk","encrypted_private_key":"esk","kdf_salt":"ks","mk_sealed":"mk"}}
            """.trimIndent(),
            SrpAuthenticateResponse::class.java,
        )
        assertEquals("jwt", res.token)
        assertEquals("M2", res.serverProof)
        assertEquals(false, res.rotationRequired)
        assertEquals(null, res.pendingDeletion)
        assertEquals("pk", res.vault.public_key)
        assertEquals("esk", res.vault.encrypted_private_key)
        assertEquals("ks", res.vault.kdf_salt)
        assertEquals("mk", res.vault.mk_sealed)
    }

    @Test
    fun pendingDeletionIsReadWhenPresent() {
        val res = gson.fromJson(
            """
            {"token":"t","serverProof":"m","rotationRequired":true,
             "pendingDeletion":"2026-08-01T00:00:00.000Z",
             "vault":{"public_key":"a","encrypted_private_key":"b","kdf_salt":"c","mk_sealed":"d"}}
            """.trimIndent(),
            SrpAuthenticateResponse::class.java,
        )
        assertEquals("2026-08-01T00:00:00.000Z", res.pendingDeletion)
        assertTrue(res.rotationRequired)
    }

    @Test
    fun recoverChallengeResponseParsesTheServersShape() {
        val res = gson.fromJson(
            """
            {"challengeId":"c","recovery_encrypted_private_key":"rek","kdf_salt":"ks","sealed_nonce":"sn"}
            """.trimIndent(),
            RecoverChallengeResponse::class.java,
        )
        assertEquals("c", res.challengeId)
        assertEquals("rek", res.recovery_encrypted_private_key)
        assertEquals("ks", res.kdf_salt)
        assertEquals("sn", res.sealed_nonce)
    }

    @Test
    fun recoverRequestShape() {

        assertKeys(
            setOf("challengeId", "nonce", "srp_salt", "srp_verifier", "encrypted_private_key"),
            json(RecoverRequest("c", "n", "s", "v", "e")),
            "RecoverRequest",
        )
    }

    @Test
    fun keyMaterialFieldsStaySnakeCase() {

        val o = json(
            RegisterRequest(
                email = "a@b.com", srp_salt = "1", srp_verifier = "2", public_key = "3",
                encrypted_private_key = "4", recovery_encrypted_private_key = "5",
                kdf_salt = "6", mk_sealed = "7",
            ),
        )
        for (k in listOf(
            "srp_salt", "srp_verifier", "public_key", "encrypted_private_key",
            "recovery_encrypted_private_key", "kdf_salt", "mk_sealed",
        )) {
            assertTrue("$k must be snake_case on the wire", o.has(k))
        }
        for (k in listOf("srpSalt", "publicKey", "encryptedPrivateKey", "kdfSalt", "mkSealed")) {
            assertTrue("$k must NOT appear - the server reads snake_case", !o.has(k))
        }
    }

    @Test
    fun qrRegisterRequestMatchesTheServersRequiredFields() {

        assertKeys(
            setOf("code", "transfer_pk"),
            json(QrRegisterRequest(code = "ABC123", transfer_pk = "pk")),
            "QrRegisterRequest",
        )
    }

    @Test
    fun approveRequestCarriesTheSealedKey() {

        assertKeys(
            setOf("code", "sealed_sk"),
            json(ApproveLoginRequest(code = "ABC123", sealed_sk = "sealed")),
            "ApproveLoginRequest",
        )
    }

    @Test
    fun qrOfferResponseParsesTheServersShape() {

        val res = gson.fromJson(
            """{"code":"A1B2C3D4E5","expiresAt":"2026-08-01T00:00:00.000Z"}""",
            QrOfferResponse::class.java,
        )
        assertEquals("A1B2C3D4E5", res.code)
        assertEquals("2026-08-01T00:00:00.000Z", res.expiresAt)
    }

    @Test
    fun qrPendingResponseParsesBothStates() {
        val waiting = gson.fromJson("""{"status":"waiting"}""", QrPendingResponse::class.java)
        assertEquals("waiting", waiting.status)
        assertEquals(null, waiting.transfer_pk)

        val registered = gson.fromJson(
            """{"status":"registered","transfer_pk":"dGhlLWtleQ=="}""",
            QrPendingResponse::class.java,
        )
        assertEquals("registered", registered.status)
        assertEquals("dGhlLWtleQ==", registered.transfer_pk)
    }

    @Test
    fun qrPollResponseParsesTheSealedPayload() {

        val res = gson.fromJson(
            """
            {"status":"approved","sealed_token":"st","sealed_sk":"ssk",
             "public_key":"pk","mk_sealed":"mk"}
            """.trimIndent(),
            QrPollResponse::class.java,
        )
        assertEquals("approved", res.status)
        assertEquals("st", res.sealed_token)
        assertEquals("ssk", res.sealed_sk)
        assertEquals("pk", res.public_key)
        assertEquals("mk", res.mk_sealed)
    }

    @Test
    fun qrPollNonApprovedStatusesCarryNoPayload() {
        for (status in listOf("pending", "consumed", "expired", "invalid")) {
            val res = gson.fromJson("""{"status":"$status"}""", QrPollResponse::class.java)
            assertEquals(status, res.status)
            assertEquals("$status must not carry a token", null, res.sealed_token)
            assertEquals("$status must not carry a key", null, res.sealed_sk)
        }
    }

    @Test
    fun qrPollHasNoPlainTokenField() {

        val keys = json(
            QrPollResponse(status = "approved", sealed_token = "a", sealed_sk = "b", public_key = "c", mk_sealed = "d"),
        ).keySet()
        assertTrue("QrPollResponse must not expose a plain `token`", !keys.contains("token"))
        assertTrue(keys.containsAll(setOf("sealed_token", "sealed_sk", "public_key", "mk_sealed")))
    }
}
