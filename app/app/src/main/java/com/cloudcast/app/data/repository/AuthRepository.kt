package com.cloudcast.app.data.repository

import com.cloudcast.app.core.displayNameFromEmail
import com.cloudcast.app.crypto.AuthCrypto
import com.cloudcast.app.crypto.Session
import com.cloudcast.app.crypto.Sodium
import com.cloudcast.app.data.SessionPersistence
import com.cloudcast.app.data.TokenStore
import com.cloudcast.app.data.network.ApiService
import com.cloudcast.app.data.network.ApproveLoginRequest
import com.cloudcast.app.data.network.QrRegisterRequest
import com.cloudcast.app.data.network.RetrofitAuthApi
import com.cloudcast.app.data.network.UserProfile
import kotlinx.coroutines.flow.first
import java.time.Instant

class AuthRepository(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val sessionPersistence: SessionPersistence,

    private val clearCaches: () -> Unit = {},
) {
    val tokenFlow = tokenStore.tokenFlow
    val emailFlow = tokenStore.emailFlow

    suspend fun me(): UserProfile = api.me().user.also { u ->
        u.display_name = displayNameFromEmail(u.email)
        tokenStore.setPendingDeletion(u.pendingDeletion)
    }

    private val authCrypto = AuthCrypto(RetrofitAuthApi(api))

    suspend fun register(email: String, password: String): String =
        authCrypto.register(email, password).recoveryCode

    suspend fun login(email: String, password: String): LoginOutcome {
        val result = authCrypto.login(email, password)
        tokenStore.save(result.token, email.trim().lowercase())

        tokenStore.setPendingDeletion(result.pendingDeletion)

        sessionPersistence.persist()
        return LoginOutcome(result.rotationRequired, result.pendingDeletion)
    }

    val pendingDeletionFlow = tokenStore.pendingDeletionFlow

    suspend fun recover(email: String, recoveryCode: String, newPassword: String) =
        authCrypto.recover(email, recoveryCode, newPassword)

    suspend fun logout() {
        runCatching { api.logout() }

        Session.clearSession()
        runCatching { clearCaches() }

        runCatching { sessionPersistence.forget() }
        tokenStore.clear()
    }

    suspend fun forceSignOut() {
        Session.clearSession()
        runCatching { clearCaches() }
        runCatching { sessionPersistence.forget() }
        tokenStore.clearSessionKeepEmail()
    }

    suspend fun deleteAccount(): String? {
        val purgeAfter = api.deleteAccount().purge_after
        tokenStore.setPendingDeletion(purgeAfter)
        return purgeAfter
    }

    suspend fun restoreAccount(): Boolean {
        val restored = api.restoreAccount().restored
        if (restored) tokenStore.setPendingDeletion(null)
        return restored
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) {
        val email = emailFlow.first()
            ?: error("Not signed in - no cached email to use as the SRP identity.")
        authCrypto.changePassword(email, currentPassword, newPassword)

        sessionPersistence.persist()
    }

    suspend fun refreshPersistedSession() = sessionPersistence.persist()

    suspend fun forgetPersistedSession() = sessionPersistence.forget()

    suspend fun changeEmail(password: String, newEmail: String): String {
        val email = authCrypto.changeEmail(newEmail, password)

        val token = tokenStore.currentToken()
        if (token != null) tokenStore.save(token, email)
        return email
    }

    suspend fun regenerateRecoveryCode(password: String): String =
        authCrypto.regenerateRecoveryCode(password)

    suspend fun confirmPassword(password: String): Boolean = authCrypto.confirmPassword(password)

    fun canConfirmPassword(): Boolean = Session.canVerifyPassword()

    suspend fun offerQrCode(): QrOffer {
        val res = api.qrOffer()
        return QrOffer(
            code = res.code,

            expiresAtMillis = runCatching { Instant.parse(res.expiresAt).toEpochMilli() }
                .getOrDefault(System.currentTimeMillis() + QR_TTL_MS),
        )
    }

    suspend fun qrPending(code: String): QrPendingState {
        val res = api.qrPending(code.trim())
        val pk = res.transfer_pk
        return when {
            res.status == "registered" && !pk.isNullOrBlank() -> QrPendingState.Registered(pk)
            res.status == "waiting" -> QrPendingState.Waiting

            else -> QrPendingState.Stale(res.status)
        }
    }

    suspend fun approveLogin(code: String, transferPkB64: String): Boolean {
        Sodium.ready()
        return api.approveLogin(
            ApproveLoginRequest(code = code.trim(), sealed_sk = Session.sealSkTo(transferPkB64)),
        ).approved
    }

    suspend fun registerQrTransfer(code: String): Sodium.Keypair {
        Sodium.ready()
        val transfer = Sodium.generateKeypair()
        api.qrRegister(QrRegisterRequest(code = code.trim(), transfer_pk = Session.b64(transfer.publicKey)))
        return transfer
    }

    suspend fun pollQrRedeem(code: String, transfer: Sodium.Keypair): QrRedeemResult {
        val res = api.qrPoll(code.trim())
        val sealedToken = res.sealed_token
        val sealedSk = res.sealed_sk
        val publicKey = res.public_key
        val mkSealed = res.mk_sealed
        if (res.status != "approved" ||
            sealedToken.isNullOrBlank() || sealedSk.isNullOrBlank() ||
            publicKey.isNullOrBlank() || mkSealed.isNullOrBlank()
        ) {
            return QrRedeemResult.NotReady(res.status)
        }

        try {
            Sodium.ready()
            val token = Sodium.sealOpen(Session.unb64(sealedToken), transfer.publicKey, transfer.privateKey)
                .toString(Charsets.UTF_8)
            val userSk = Sodium.sealOpen(Session.unb64(sealedSk), transfer.publicKey, transfer.privateKey)

            Session.setSession(
                userSk = userSk,
                publicKey = Session.unb64(publicKey),
                mkSealed = Session.unb64(mkSealed),
                kdfSalt = ByteArray(0),
                encryptedPrivateKey = ByteArray(0),
            )

            tokenStore.save(token, "")
            val email = runCatching { me().email }.getOrNull()
            if (!email.isNullOrBlank()) tokenStore.save(token, email)

            sessionPersistence.persist()
            return QrRedeemResult.Success
        } catch (e: Exception) {

            Session.clearSession()
            runCatching { tokenStore.clear() }
            return QrRedeemResult.Failed(e)
        }
    }

    private companion object {

        const val QR_TTL_MS = 60_000L
    }
}

data class LoginOutcome(

    val rotationRequired: Boolean = false,

    val pendingDeletion: String? = null,
)

data class QrOffer(val code: String, val expiresAtMillis: Long)

sealed interface QrPendingState {

    data object Waiting : QrPendingState

    data class Registered(val transferPkB64: String) : QrPendingState

    data class Stale(val status: String) : QrPendingState
}

sealed interface QrRedeemResult {

    data object Success : QrRedeemResult

    data class NotReady(val status: String) : QrRedeemResult

    data class Failed(val cause: Exception) : QrRedeemResult
}
