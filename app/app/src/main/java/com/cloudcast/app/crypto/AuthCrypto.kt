package com.cloudcast.app.crypto

import com.cloudcast.app.data.network.AuthApi
import com.cloudcast.app.data.network.ChangeEmailRequestV2
import com.cloudcast.app.data.network.ChangePasswordRequestV2
import com.cloudcast.app.data.network.RecoverChallengeRequest
import com.cloudcast.app.data.network.RecoverRequest
import com.cloudcast.app.data.network.RegenerateRecoveryRequest
import com.cloudcast.app.data.network.RegisterRequest
import com.cloudcast.app.data.network.SrpAuthenticateRequest
import com.cloudcast.app.data.network.SrpChallengeRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthCrypto(private val api: AuthApi) {

    class Registration(

        val recoveryCode: String,
    )

    class LoginResult(
        val token: String,
        val rotationRequired: Boolean,

        val pendingDeletion: String?,
    )

    suspend fun register(email: String, password: String): Registration =
        withContext(Dispatchers.Default) {
            Sodium.ready()
            val normalisedEmail = email.trim().lowercase()
            val keys = UserKeys.createUserKeys(password)

            val srpSalt = Srp.generateSalt()
            val srpVerifier = Srp.deriveVerifier(
                Srp.derivePrivateKey(srpSalt, normalisedEmail, Sodium.srpPassword(password, srpSalt)),
            )

            api.register(
                RegisterRequest(
                    email = normalisedEmail,
                    srp_salt = srpSalt,
                    srp_verifier = srpVerifier,
                    public_key = Session.b64(keys.publicKey),
                    encrypted_private_key = Session.b64(keys.encryptedPrivateKey),
                    recovery_encrypted_private_key = Session.b64(keys.recoveryEncryptedPrivateKey),
                    kdf_salt = Session.b64(keys.salt),
                    mk_sealed = Session.b64(keys.mkSealed),
                ),
            )

            Registration(recoveryCode = keys.recoveryCode)
        }

    suspend fun login(email: String, password: String): LoginResult =
        withContext(Dispatchers.Default) {
            Sodium.ready()
            val normalisedEmail = email.trim().lowercase()

            val challenge = api.srpChallenge(SrpChallengeRequest(normalisedEmail))
            val ephemeral = Srp.generateEphemeral()
            val session = Srp.deriveSession(
                clientSecretEphemeral = ephemeral.secret,
                serverPublicEphemeral = challenge.serverPublic,
                saltHex = challenge.salt,
                identity = normalisedEmail,
                privateKeyHex = Srp.derivePrivateKey(
                    challenge.salt,
                    normalisedEmail,
                    Sodium.srpPassword(password, challenge.salt),
                ),
            )

            val auth = api.srpAuthenticate(
                SrpAuthenticateRequest(
                    challengeId = challenge.challengeId,
                    clientPublic = ephemeral.public,
                    clientProof = session.proof,
                ),
            )

            Srp.verifySession(ephemeral.public, session, auth.serverProof)

            val userSk = UserKeys.privateKeyFromPassword(
                password = password,
                salt = Session.unb64(auth.vault.kdf_salt),
                encryptedPrivateKey = Session.unb64(auth.vault.encrypted_private_key),
            )
            Session.setSession(
                userSk = userSk,
                publicKey = Session.unb64(auth.vault.public_key),
                mkSealed = Session.unb64(auth.vault.mk_sealed),
                kdfSalt = Session.unb64(auth.vault.kdf_salt),
                encryptedPrivateKey = Session.unb64(auth.vault.encrypted_private_key),
            )

            LoginResult(
                token = auth.token,
                rotationRequired = auth.rotationRequired,
                pendingDeletion = auth.pendingDeletion,
            )
        }

    suspend fun recover(email: String, recoveryCode: String, newPassword: String) =
        withContext(Dispatchers.Default) {
            Sodium.ready()
            val normalisedEmail = email.trim().lowercase()
            val challenge = api.recoverChallenge(RecoverChallengeRequest(normalisedEmail))

            val sk = try {
                UserKeys.privateKeyFromRecovery(
                    recoveryCode.trim(),
                    Session.unb64(challenge.recovery_encrypted_private_key),
                )
            } catch (_: Exception) {

                throw RecoveryCodeRejected()
            }

            val pk = Sodium.publicKeyFromSecret(sk)
            val nonce = Sodium.sealOpen(Session.unb64(challenge.sealed_nonce), pk, sk)

            val kdfSalt = Session.unb64(challenge.kdf_salt)
            val rewrapped = UserKeys.rewrapForNewPassword(sk, newPassword, kdfSalt)
            val srpSalt = Srp.generateSalt()
            val srpVerifier = Srp.deriveVerifier(
                Srp.derivePrivateKey(srpSalt, normalisedEmail, Sodium.srpPassword(newPassword, srpSalt)),
            )

            api.recoverSubmit(
                RecoverRequest(
                    challengeId = challenge.challengeId,
                    nonce = Session.b64(nonce),
                    srp_salt = srpSalt,
                    srp_verifier = srpVerifier,
                    encrypted_private_key = Session.b64(rewrapped),
                ),
            )

            sk.wipe()
        }

    suspend fun changePassword(email: String, currentPassword: String, newPassword: String) =
        withContext(Dispatchers.Default) {
            Sodium.ready()
            val normalisedEmail = email.trim().lowercase()

            if (!Session.verifyPassword(currentPassword)) throw WrongPassword()

            val srpSalt = Srp.generateSalt()
            api.changePassword(
                ChangePasswordRequestV2(
                    srp_salt = srpSalt,
                    srp_verifier = Srp.deriveVerifier(
                        Srp.derivePrivateKey(srpSalt, normalisedEmail, Sodium.srpPassword(newPassword, srpSalt)),
                    ),

                    encrypted_private_key = Session.rewrapUnderNewPassword(newPassword),
                ),
            )

        }

    suspend fun changeEmail(newEmail: String, password: String): String =
        withContext(Dispatchers.Default) {
            Sodium.ready()
            if (!Session.verifyPassword(password)) throw WrongPassword()
            val normalised = newEmail.trim().lowercase()
            val srpSalt = Srp.generateSalt()
            api.changeEmail(
                ChangeEmailRequestV2(
                    newEmail = normalised,
                    srp_salt = srpSalt,
                    srp_verifier = Srp.deriveVerifier(
                        Srp.derivePrivateKey(srpSalt, normalised, Sodium.srpPassword(password, srpSalt)),
                    ),
                ),
            ).email
        }

    suspend fun regenerateRecoveryCode(password: String): String = withContext(Dispatchers.Default) {
        Sodium.ready()

        if (!Session.verifyPassword(password)) throw WrongPassword()
        val vault = Session.newRecoveryVault()
        api.regenerateRecovery(RegenerateRecoveryRequest(vault.recoveryEncryptedPrivateKey))
        vault.recoveryCode
    }

    suspend fun confirmPassword(password: String): Boolean = withContext(Dispatchers.Default) {
        Sodium.ready()
        Session.verifyPassword(password)
    }

    class RecoveryCodeRejected :
        Exception("That recovery code didn't work - check for typos or extra spaces.")

    class WrongPassword : Exception("That password isn't right.")
}
