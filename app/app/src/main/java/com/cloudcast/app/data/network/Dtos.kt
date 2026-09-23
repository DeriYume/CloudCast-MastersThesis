package com.cloudcast.app.data.network

data class UserProfile(
    val id: String,
    val email: String,
    val created_at: String,
    val graceDays: Int? = null,
    val pendingDeletion: String? = null,
) {

    @Transient
    var display_name: String? = null
}

data class MeResponse(val user: UserProfile)

data class LogoutResponse(val loggedOut: Boolean)

data class ConflictInfo(
    val type: String,
    val name: String,
    val existing_id: String? = null,
)

data class ApiError(
    val error: String? = null,
    val code: String? = null,
    val conflict: ConflictInfo? = null,
)

data class CreateFolderRequest(val name: String, val parent_id: String?, val on_conflict: String? = null)
data class RenameFolderRequest(val name: String, val on_conflict: String? = null)
data class MoveFolderRequest(val parent_id: String?, val on_conflict: String? = null)
data class DeleteResponse(val deleted: Boolean? = null)

data class RenameFileRequest(val original_name: String, val on_conflict: String? = null)

data class PatchFileRequest(
    val folder_id: String? = null,
)
data class MoveFileRequest(val folder_id: String?, val on_conflict: String? = null)

data class SharedWithMeResponse(
    val files: List<FileDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
)

data class SharedByMeResponse(
    val files: List<FileDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
)

data class SaveSharedResponse(val file: FileDto)

data class ExpiringResponse(
    val files: List<FileDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
)

data class EmbedQueryRequest(val q: String)

data class EmbedQueryResponse(val vector: List<Float> = emptyList())

data class EmbeddingDto(
    val file_id: String,
    val embedding_enc: String? = null,
    val source: String? = null,
)

data class EmbeddingsResponse(val embeddings: List<EmbeddingDto> = emptyList())

data class QrOfferResponse(
    val code: String,
    val expiresAt: String,
)

data class QrRegisterRequest(
    val code: String,
    val transfer_pk: String,
)

data class QrRegisterResponse(val ok: Boolean = false)

data class QrPendingResponse(
    val status: String,
    val transfer_pk: String? = null,
)

data class ApproveLoginRequest(
    val code: String,
    val sealed_sk: String,
)

data class ApproveLoginResponse(val approved: Boolean = false)

data class QrPollResponse(
    val status: String,
    val sealed_token: String? = null,
    val sealed_sk: String? = null,
    val public_key: String? = null,
    val mk_sealed: String? = null,
)

data class PrefsBlobResponse(
    val blob: String? = null,
    val revision: Int = 0,
)

data class PrefsBlobRequest(
    val blob: String,
    val revision: Int,
)

data class PrefsRevisionResponse(val revision: Int = 0)

data class NotificationDto(
    val id: String,
    val type: String,
    val file_id: String? = null,
    val folder_id: String? = null,

    val created_at: String,
)

data class NotificationsResponse(
    val notifications: List<NotificationDto> = emptyList(),
    val unread: Int = 0,
)
