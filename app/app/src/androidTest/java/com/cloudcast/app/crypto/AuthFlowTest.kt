package com.cloudcast.app.crypto

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.cloudcast.app.data.network.AuthApi
import com.cloudcast.app.data.network.ChangeEmailRequestV2
import com.cloudcast.app.data.network.ChangeEmailResult
import com.cloudcast.app.data.network.ChangePasswordRequestV2
import com.cloudcast.app.data.network.ChangePasswordResult
import com.cloudcast.app.data.network.RecoverChallengeRequest
import com.cloudcast.app.data.network.RegenerateRecoveryRequest
import com.cloudcast.app.data.network.RegenerateRecoveryResult
import com.cloudcast.app.data.network.RecoverRequest
import com.cloudcast.app.data.network.RegisterRequest
import com.cloudcast.app.data.network.SrpAuthenticateRequest
import com.cloudcast.app.data.network.SrpChallengeRequest
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AuthFlowTest {

    private lateinit var server: FakeAuthServer
    private lateinit var auth: AuthCrypto

    private val email = "user@example.com"
    private val password = "example-vector-password"

    private class FakeApi(private val s: FakeAuthServer) : AuthApi {
        override suspend fun register(body: RegisterRequest) = s.register(body)
        override suspend fun srpChallenge(body: SrpChallengeRequest) = s.srpChallenge(body)
        override suspend fun srpAuthenticate(body: SrpAuthenticateRequest) = s.srpAuthenticate(body)
        override suspend fun recoverChallenge(body: RecoverChallengeRequest) = s.recoverChallenge(body)
        override suspend fun recoverSubmit(body: RecoverRequest) = s.recoverSubmit(body)

        override suspend fun changePassword(body: ChangePasswordRequestV2): ChangePasswordResult =
            error("changePassword is outside the flows this fake covers")

        override suspend fun changeEmail(body: ChangeEmailRequestV2): ChangeEmailResult =
            error("changeEmail is outside the flows this fake covers")

        override suspend fun regenerateRecovery(body: RegenerateRecoveryRequest): RegenerateRecoveryResult =
            error("regenerateRecovery is outside the flows this fake covers")
    }

    @Before
    fun setUp() {
        Sodium.ready()
        server = FakeAuthServer()
        auth = AuthCrypto(FakeApi(server))
        Session.clearSession()
    }

    @After
    fun tearDown() = Session.clearSession()

    @Test
    fun registerThenLoginUnlocksTheSession() = runBlocking {
        val reg = auth.register(email, password)
        assertTrue("a recovery code must be returned", reg.recoveryCode.isNotBlank())
        assertTrue("session must NOT open on register alone", !Session.isUnlocked())

        val login = auth.login(email, password)
        assertTrue(login.token.isNotBlank())
        assertTrue("session must be unlocked after login", Session.isUnlocked())
        assertNotNull(server.lastServerProof)
    }

    @Test
    fun theSessionCanSealAndOpenNamesAfterLogin() = runBlocking {
        auth.register(email, password)
        auth.login(email, password)

        val sealed = Session.sealName("Tax Return 2026.pdf")
        assertEquals("Tax Return 2026.pdf", Session.openName(sealed))
        assertNotEquals("sealed name must not be plaintext", "Tax Return 2026.pdf", sealed)
    }

    @Test
    fun loggingInTwiceYieldsTheSameKeys() = runBlocking {
        auth.register(email, password)
        auth.login(email, password)
        val sealed = Session.sealName("stable.txt")
        Session.clearSession()

        auth.login(email, password)

        assertEquals("stable.txt", Session.openName(sealed))
    }

    @Test
    fun wrongPasswordIsRejectedByTheServer() = runBlocking {
        auth.register(email, password)

        assertThrows(Exception::class.java) {
            runBlocking { auth.login(email, "wrong password") }
        }
        assertTrue("no session on a failed login", !Session.isUnlocked())
    }

    @Test
    fun unknownAccountFails() {
        assertThrows(Exception::class.java) {
            runBlocking { auth.login("nobody@example.com", password) }
        }
        assertTrue(!Session.isUnlocked())
    }

    @Test
    fun aChallengeIsSingleUse() = runBlocking {
        auth.register(email, password)
        val ch = server.srpChallenge(SrpChallengeRequest(email))
        val eph = Srp.generateEphemeral()
        val s = Srp.deriveSession(
            eph.secret, ch.serverPublic, ch.salt, email,
            Srp.derivePrivateKey(ch.salt, email, Sodium.srpPassword(password, ch.salt)),
        )
        server.srpAuthenticate(SrpAuthenticateRequest(ch.challengeId, eph.public, s.proof))

        assertThrows(Exception::class.java) {
            server.srpAuthenticate(SrpAuthenticateRequest(ch.challengeId, eph.public, s.proof))
        }
        Unit
    }

    @Test
    fun theServerStoresNothingThatOpensTheVault() = runBlocking {
        val reg = auth.register(email, password)
        val acc = server.account(email)!!

        for (blob in listOf(acc.encryptedPrivateKey, acc.recoveryEncryptedPrivateKey, acc.mkSealed)) {
            val bytes = Session.unb64(blob)
            assertTrue("stored blob should be non-trivial ciphertext", bytes.size > 32)
        }

        val dump = listOf(
            acc.srpSaltHex, acc.srpVerifierHex, acc.publicKey, acc.encryptedPrivateKey,
            acc.recoveryEncryptedPrivateKey, acc.kdfSalt, acc.mkSealed,
        ).joinToString("|")
        assertTrue("password must not be stored", !dump.contains(password))
        assertTrue("recovery code must not be stored", !dump.contains(reg.recoveryCode))
    }

    @Test
    fun recoveryResetsThePasswordAndKeepsTheSameKeypair() = runBlocking {
        val reg = auth.register(email, password)
        auth.login(email, password)
        val sealedBefore = Session.sealName("before.txt")
        val pkBefore = Session.myPublicKeyB64()
        Session.clearSession()

        val newPassword = "an entirely different passphrase"
        auth.recover(email, reg.recoveryCode, newPassword)

        assertThrows(Exception::class.java) {
            runBlocking { auth.login(email, password) }
        }

        auth.login(email, newPassword)
        assertTrue(Session.isUnlocked())

        assertEquals(pkBefore, Session.myPublicKeyB64())
        assertEquals("before.txt", Session.openName(sealedBefore))
    }

    @Test
    fun theRecoveryCodeSurvivesAPasswordReset() = runBlocking {
        val reg = auth.register(email, password)
        auth.recover(email, reg.recoveryCode, "first new password")

        auth.recover(email, reg.recoveryCode, "second new password")
        auth.login(email, "second new password")
        assertTrue(Session.isUnlocked())
    }

    @Test
    fun aWrongRecoveryCodeIsRejectedWithAFriendlyError() = runBlocking {
        auth.register(email, password)
        val wrong = UserKeys.encodeRecoveryCode(Sodium.randomBytes(32))
        assertThrows(AuthCrypto.RecoveryCodeRejected::class.java) {
            runBlocking { auth.recover(email, wrong, "whatever") }
        }
        Unit
    }

    @Test
    fun theVaultUploadedAtRegistrationIsTheOneLoginOpens() = runBlocking {
        auth.register(email, password)
        val acc = server.account(email)!!

        val sk = UserKeys.privateKeyFromPassword(
            password, Session.unb64(acc.kdfSalt), Session.unb64(acc.encryptedPrivateKey),
        )
        assertArrayEquals(Session.unb64(acc.publicKey), Sodium.publicKeyFromSecret(sk))
    }
}
