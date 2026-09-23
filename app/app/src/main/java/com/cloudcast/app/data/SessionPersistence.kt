package com.cloudcast.app.data

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import com.cloudcast.app.crypto.KeystoreVault
import com.cloudcast.app.crypto.Session
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.Executor
import javax.crypto.Cipher
import kotlin.coroutines.resume

class SessionPersistence(
    private val context: Context,
    private val tokenStore: TokenStore,
    private val settingsStore: SettingsStore,
) {

    enum class Outcome {

        RESTORED,

        NONE,

        AUTH_FAILED,

        UNAVAILABLE,
    }

    @Volatile
    private var host: FragmentActivity? = null

    fun attach(activity: FragmentActivity) {
        host = activity
        activity.lifecycle.addObserver(
            object : androidx.lifecycle.DefaultLifecycleObserver {
                override fun onDestroy(owner: androidx.lifecycle.LifecycleOwner) {
                    if (host === activity) host = null
                }
            },
        )
    }

    fun biometricAvailable(): Boolean =
        BiometricManager.from(context)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS

    suspend fun persist() {
        val activity = host
        if (!settingsStore.staySignedIn()) {
            forget()
            return
        }
        val blob = Session.exportSnapshot() ?: return

        val wasGated = KeystoreVault.requiresAuth()
        if (wasGated && activity == null) {
            Log.i(TAG, "cannot re-gate snapshot without an activity; dropping it")
            forget()
            wipe(blob)
            return
        }

        val useBiometric = activity != null && biometricAvailable()
        try {
            val cipher = KeystoreVault.encryptCipher(requireBiometric = useBiometric)
            val ready = if (useBiometric) {
                authenticate(
                    activity!!,
                    cipher,
                    title = "Stay signed in",
                    subtitle = "Confirm it's you so CloudCast can unlock your vault next time.",
                ) ?: run {
                    if (wasGated) {

                        Log.i(TAG, "biometric declined for a gated snapshot; dropping it")
                        forget()
                        return
                    }

                    KeystoreVault.encryptCipher(requireBiometric = false)
                }
            } else {
                cipher
            }
            val wrapped = KeystoreVault.wrapWith(ready, blob)
            tokenStore.saveSessionBlob(wrapped.ivB64, wrapped.cipherB64)
        } catch (e: Exception) {
            Log.w(TAG, "could not persist session: ${e.javaClass.simpleName}: ${e.message}")
            forget()
        } finally {
            wipe(blob)
        }
    }

    suspend fun forget() {
        KeystoreVault.clear()
        tokenStore.saveSessionBlob(null, null)
    }

    suspend fun restore(activity: FragmentActivity): Outcome {
        attach(activity)
        if (!settingsStore.staySignedIn()) return Outcome.NONE
        if (Session.isUnlocked()) return Outcome.RESTORED
        if (tokenStore.currentToken() == null) return Outcome.NONE
        val (iv, blobB64) = tokenStore.sessionBlob() ?: return Outcome.NONE

        val cipher = KeystoreVault.decryptCipher(iv) ?: return Outcome.UNAVAILABLE
        val ready = if (KeystoreVault.requiresAuth()) {
            authenticate(
                activity,
                cipher,
                title = "Unlock CloudCast",
                subtitle = "Your files are encrypted on this device.",
            ) ?: return Outcome.AUTH_FAILED
        } else {
            cipher
        }

        val blob = KeystoreVault.unwrapWith(ready, blobB64) ?: return Outcome.UNAVAILABLE

        Session.restoreSnapshot(blob)
        return Outcome.RESTORED
    }

    private suspend fun authenticate(
        activity: FragmentActivity,
        cipher: Cipher,
        title: String,
        subtitle: String,
    ): Cipher? = suspendCancellableCoroutine { cont ->
        val executor: Executor = androidx.core.content.ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (cont.isActive) cont.resume(result.cryptoObject?.cipher)
                }

                override fun onAuthenticationError(code: Int, message: CharSequence) {

                    Log.d(TAG, "biometric error $code: $message")
                    if (cont.isActive) cont.resume(null)
                }

            },
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Use password")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setConfirmationRequired(false)
            .build()

        prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
        cont.invokeOnCancellation { prompt.cancelAuthentication() }
    }

    private fun wipe(b: KeystoreVault.SessionBlob) {
        b.userSk.fill(0); b.publicKey.fill(0); b.mk.fill(0)
        b.kdfSalt.fill(0); b.encryptedPrivateKey.fill(0)
    }

    private companion object {
        const val TAG = "CloudCastSession"
    }
}
