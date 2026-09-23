package com.cloudcast.app.crypto

import android.util.Base64
import com.cloudcast.app.core.Formats
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object Session {

    private class Keys(
        val userSk: ByteArray,
        val publicKey: ByteArray,
        val mk: ByteArray,

        val kdfSalt: ByteArray,
        val encryptedPrivateKey: ByteArray,
    )

    @Volatile
    private var keys: Keys? = null

    private val _unlocked = MutableStateFlow(false)

    val unlocked: StateFlow<Boolean> = _unlocked.asStateFlow()

    private const val B64 = Base64.NO_WRAP

    private fun k(): Keys = keys ?: error("Your keys are locked - please sign in again.")

    fun setSession(
        userSk: ByteArray,
        publicKey: ByteArray,
        mkSealed: ByteArray,
        kdfSalt: ByteArray,
        encryptedPrivateKey: ByteArray,
    ) {
        keys = Keys(
            userSk = userSk,
            publicKey = publicKey,
            mk = UserKeys.openMk(mkSealed, publicKey, userSk),
            kdfSalt = kdfSalt,
            encryptedPrivateKey = encryptedPrivateKey,
        )
        _unlocked.value = true
    }

    fun clearSession() {
        keys?.let { it.userSk.wipe(); it.mk.wipe() }
        keys = null
        _unlocked.value = false
    }

    fun isUnlocked(): Boolean = keys != null

    fun exportSnapshot(): KeystoreVault.SessionBlob? {
        val k = keys ?: return null
        return KeystoreVault.SessionBlob(
            userSk = k.userSk.copyOf(),
            publicKey = k.publicKey.copyOf(),
            mk = k.mk.copyOf(),
            kdfSalt = k.kdfSalt.copyOf(),
            encryptedPrivateKey = k.encryptedPrivateKey.copyOf(),
        )
    }

    fun restoreSnapshot(blob: KeystoreVault.SessionBlob) {
        keys = Keys(
            userSk = blob.userSk,
            publicKey = blob.publicKey,
            mk = blob.mk,
            kdfSalt = blob.kdfSalt,
            encryptedPrivateKey = blob.encryptedPrivateKey,
        )
        _unlocked.value = true
    }

    fun canVerifyPassword(): Boolean {
        val k = keys ?: return false
        return k.kdfSalt.isNotEmpty() && k.encryptedPrivateKey.isNotEmpty()
    }

    fun verifyPassword(password: String): Boolean {
        val k = keys ?: return false
        if (k.kdfSalt.isEmpty() || k.encryptedPrivateKey.isEmpty()) return false
        return try {
            val sk = UserKeys.privateKeyFromPassword(password, k.kdfSalt, k.encryptedPrivateKey)
            val ok = sk.contentEquals(k.userSk)
            sk.wipe()
            ok
        } catch (_: Exception) {

            false
        }
    }

    fun rewrapUnderNewPassword(newPassword: String): String {
        val k = k()
        val rewrapped = UserKeys.rewrapForNewPassword(k.userSk, newPassword, k.kdfSalt)
        keys = Keys(k.userSk, k.publicKey, k.mk, k.kdfSalt, rewrapped)
        return b64(rewrapped)
    }

    fun sealName(name: String): String =
        b64(Sodium.secretboxSeal(name.toByteArray(Charsets.UTF_8), k().mk))

    fun openName(nameEncB64: String?): String {
        if (nameEncB64.isNullOrEmpty()) return ""
        return try {
            Sodium.secretboxOpen(unb64(nameEncB64), k().mk).toString(Charsets.UTF_8)
        } catch (_: Exception) {
            UNREADABLE
        }
    }

    fun sealBlob(bytes: ByteArray): String = b64(Sodium.secretboxSeal(bytes, k().mk))

    fun openBlob(b64: String): ByteArray = Sodium.secretboxOpen(unb64(b64), k().mk)

    fun myPublicKeyB64(): String = b64(k().publicKey)

    fun newDek(): ByteArray = Sodium.generateDek()

    fun wrapDekForSelf(dek: ByteArray): String = b64(Sodium.sealTo(dek, k().publicKey))

    fun wrapDekForPub(dek: ByteArray, recipientPkB64: String): String =
        b64(Sodium.sealTo(dek, unb64(recipientPkB64)))

    fun openWrappedDek(wrappedB64: String): ByteArray =
        Sodium.sealOpen(unb64(wrappedB64), k().publicKey, k().userSk)

    fun openSealedBytesToMe(sealedB64: String): ByteArray =
        Sodium.sealOpen(unb64(sealedB64), k().publicKey, k().userSk)

    class FileMeta(val name: String, val mime: String)

    const val DEFAULT_MIME = Formats.DEFAULT_MIME

    private fun encodeMeta(name: String, mime: String): ByteArray {
        val obj = JsonObject().apply {
            addProperty(Formats.META_NAME_KEY, name)
            addProperty(Formats.META_MIME_KEY, mime.ifEmpty { DEFAULT_MIME })
        }
        return obj.toString().toByteArray(Charsets.UTF_8)
    }

    private fun decodeMeta(plain: ByteArray): FileMeta {
        val text = plain.toString(Charsets.UTF_8)
        return try {
            val o = JsonParser.parseString(text).asJsonObject
            val n = o.get(Formats.META_NAME_KEY)?.asString ?: return FileMeta(text, DEFAULT_MIME)
            val m = o.get(Formats.META_MIME_KEY)?.asString?.takeIf { it.isNotEmpty() } ?: DEFAULT_MIME
            FileMeta(n, m)
        } catch (_: Exception) {
            FileMeta(text, DEFAULT_MIME)
        }
    }

    fun sealMeta(name: String, mime: String): String =
        b64(Sodium.secretboxSeal(encodeMeta(name, mime), k().mk))

    fun openMeta(metaEncB64: String?): FileMeta {
        if (metaEncB64.isNullOrEmpty()) return FileMeta("", DEFAULT_MIME)
        return try {
            decodeMeta(Sodium.secretboxOpen(unb64(metaEncB64), k().mk))
        } catch (_: Exception) {
            FileMeta(UNREADABLE, DEFAULT_MIME)
        }
    }

    fun sealMetaForPub(name: String, mime: String, recipientPkB64: String): String =
        b64(Sodium.sealTo(encodeMeta(name, mime), unb64(recipientPkB64)))

    fun openMetaSealedToMe(sealedB64: String?): FileMeta {
        if (sealedB64.isNullOrEmpty()) return FileMeta("", DEFAULT_MIME)
        return try {
            decodeMeta(Sodium.sealOpen(unb64(sealedB64), k().publicKey, k().userSk))
        } catch (_: Exception) {
            FileMeta(UNREADABLE, DEFAULT_MIME)
        }
    }

    fun sealNameForPub(name: String, recipientPkB64: String): String =
        b64(Sodium.sealTo(name.toByteArray(Charsets.UTF_8), unb64(recipientPkB64)))

    fun openNameSealedToMe(sealedB64: String?): String {
        if (sealedB64.isNullOrEmpty()) return ""
        return try {
            Sodium.sealOpen(unb64(sealedB64), k().publicKey, k().userSk).toString(Charsets.UTF_8)
        } catch (_: Exception) {
            UNREADABLE
        }
    }

    fun sealSkTo(transferPkB64: String): String = b64(Sodium.sealTo(k().userSk, unb64(transferPkB64)))

    class NewRecoveryVault(val recoveryCode: String, val recoveryEncryptedPrivateKey: String)

    fun newRecoveryVault(): NewRecoveryVault {
        val raw = Sodium.randomBytes(32)
        val vaultKey = Sodium.recoveryVaultKey(raw)
        try {
            return NewRecoveryVault(
                recoveryCode = UserKeys.encodeRecoveryCode(raw),
                recoveryEncryptedPrivateKey = b64(Sodium.secretboxSeal(k().userSk, vaultKey)),
            )
        } finally {
            raw.wipe(); vaultKey.wipe()
        }
    }

    fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, B64)

    fun unb64(s: String): ByteArray = Base64.decode(s, B64)

    const val UNREADABLE = "(unreadable)"
}
