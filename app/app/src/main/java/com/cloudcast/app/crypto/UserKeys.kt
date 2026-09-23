package com.cloudcast.app.crypto

import android.util.Base64

object UserKeys {

    class NewUserKeys(

        val salt: ByteArray,

        val publicKey: ByteArray,

        val encryptedPrivateKey: ByteArray,

        val recoveryEncryptedPrivateKey: ByteArray,

        val mkSealed: ByteArray,

        val recoveryCode: String,
    )

    fun createUserKeys(password: String): NewUserKeys {
        val salt = Sodium.generateSalt()
        val kp = Sodium.generateKeypair()
        val recoveryKeyBytes = Sodium.randomBytes(32)
        val recoveryCode = encodeRecoveryCode(recoveryKeyBytes)
        val mk = Sodium.randomBytes(32)
        val vaultKey = Sodium.deriveVaultKey(password, salt)
        val rVaultKey = Sodium.recoveryVaultKey(recoveryKeyBytes)

        val out = NewUserKeys(
            salt = salt,
            publicKey = kp.publicKey,
            encryptedPrivateKey = Sodium.secretboxSeal(kp.privateKey, vaultKey),
            recoveryEncryptedPrivateKey = Sodium.secretboxSeal(kp.privateKey, rVaultKey),
            mkSealed = Sodium.sealTo(mk, kp.publicKey),
            recoveryCode = recoveryCode,
        )

        kp.privateKey.wipe(); vaultKey.wipe(); rVaultKey.wipe(); recoveryKeyBytes.wipe(); mk.wipe()
        return out
    }

    fun openMk(mkSealed: ByteArray, publicKey: ByteArray, privateKey: ByteArray): ByteArray =
        Sodium.sealOpen(mkSealed, publicKey, privateKey)

    fun privateKeyFromPassword(password: String, salt: ByteArray, encryptedPrivateKey: ByteArray): ByteArray {
        val vaultKey = Sodium.deriveVaultKey(password, salt)
        try {
            return Sodium.secretboxOpen(encryptedPrivateKey, vaultKey)
        } finally {
            vaultKey.wipe()
        }
    }

    fun privateKeyFromRecovery(recoveryCode: String, recoveryEncryptedPrivateKey: ByteArray): ByteArray {
        val raw = decodeRecoveryCode(recoveryCode)
        val rVaultKey = Sodium.recoveryVaultKey(raw)
        try {
            return Sodium.secretboxOpen(recoveryEncryptedPrivateKey, rVaultKey)
        } finally {
            raw.wipe(); rVaultKey.wipe()
        }
    }

    fun rewrapForNewPassword(privateKey: ByteArray, newPassword: String, salt: ByteArray): ByteArray {
        val vaultKey = Sodium.deriveVaultKey(newPassword, salt)
        try {
            return Sodium.secretboxSeal(privateKey, vaultKey)
        } finally {
            vaultKey.wipe()
        }
    }

    fun wrapDekFor(dek: ByteArray, recipientPk: ByteArray): ByteArray = Sodium.sealTo(dek, recipientPk)

    fun unwrapDek(wrapped: ByteArray, pk: ByteArray, sk: ByteArray): ByteArray = Sodium.sealOpen(wrapped, pk, sk)

    private const val B64 = Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP

    fun encodeRecoveryCode(raw: ByteArray): String = Base64.encodeToString(raw, B64)

    fun decodeRecoveryCode(code: String): ByteArray = Base64.decode(code.trim(), B64)
}
