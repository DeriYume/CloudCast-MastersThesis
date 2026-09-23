package com.cloudcast.app.data.network

data class RegisterRequest(
    val email: String,

    val srp_salt: String,

    val srp_verifier: String,

    val public_key: String,
    val encrypted_private_key: String,
    val recovery_encrypted_private_key: String,
    val kdf_salt: String,
    val mk_sealed: String,
)

data class RegisterResult(val id: String)

data class SrpChallengeRequest(val email: String)

data class SrpChallengeResponse(
    val challengeId: String,

    val salt: String,

    val serverPublic: String,
)

data class SrpAuthenticateRequest(
    val challengeId: String,

    val clientPublic: String,

    val clientProof: String,
)

data class VaultDto(
    val public_key: String,
    val encrypted_private_key: String,
    val kdf_salt: String,
    val mk_sealed: String,
)

data class SrpAuthenticateResponse(
    val token: String,

    val serverProof: String,
    val rotationRequired: Boolean = false,

    val pendingDeletion: String? = null,
    val vault: VaultDto,
)

data class RecoverChallengeRequest(val email: String)

data class RecoverChallengeResponse(
    val challengeId: String,

    val recovery_encrypted_private_key: String,
    val kdf_salt: String,

    val sealed_nonce: String,
)

data class RecoverRequest(
    val challengeId: String,

    val nonce: String,

    val srp_salt: String,

    val srp_verifier: String,

    val encrypted_private_key: String,
)

data class RecoverResult(val recovered: Boolean = false)

data class ChangePasswordRequestV2(

    val srp_salt: String,

    val srp_verifier: String,

    val encrypted_private_key: String,
)

data class ChangePasswordResult(val changed: Boolean = false)

data class ChangeEmailRequestV2(
    val newEmail: String,

    val srp_salt: String,

    val srp_verifier: String,
)

data class ChangeEmailResult(val email: String)

data class RegenerateRecoveryRequest(

    val recovery_encrypted_private_key: String,
)

data class RegenerateRecoveryResult(val regenerated: Boolean = false)

data class DeleteAccountResult(

    val purge_after: String? = null,
)

data class RestoreAccountResult(val restored: Boolean = false)
