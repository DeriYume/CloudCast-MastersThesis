package com.cloudcast.app.data.network

import com.cloudcast.app.crypto.Session

data class FileDto(
    val id: String,
    val folder_id: String? = null,

    val meta_enc: String? = null,

    val meta_sealed: String? = null,

    val wrapped_dek: String? = null,
    val size_bytes: Long = 0,

    val is_favorite: Boolean = false,
    val expires_at: String? = null,

    val created_at: String = "",
    val folder_name: String? = null,

    val permission: String? = null,

    val sharer_label: String? = null,
    val share_expires_at: String? = null,
    val recipient_count: Int = 0,
) {

    @Transient
    private var originalNameOrNull: String? = null

    var original_name: String
        get() = originalNameOrNull ?: ""
        set(value) {
            originalNameOrNull = value
        }

    @Transient
    private var mimeOrNull: String? = null

    var mime_type: String
        get() = mimeOrNull ?: Session.DEFAULT_MIME
        set(value) {
            mimeOrNull = value
        }

    @Transient
    var shared_by: String? = null
}

fun FileDto.withFavorite(isFavorite: Boolean): FileDto =
    copy(is_favorite = isFavorite).also {
        it.original_name = original_name
        it.mime_type = mime_type
        it.shared_by = shared_by
    }

data class FilesResponse(val files: List<FileDto> = emptyList())
data class FileResponse(val file: FileDto)

data class FolderDto(
    override val id: String,
    val parent_id: String? = null,
    val name_enc: String? = null,
    val name_sealed: String? = null,
    val expires_at: String? = null,

    val created_at: String = "",
    val permission: String? = null,

    val sharer_label: String? = null,
    val share_expires_at: String? = null,
    val recipient_count: Int = 0,
) : com.cloudcast.app.core.MatchableFolder {

    override val parentId: String? get() = parent_id
    override val displayName: String get() = name

    @Transient
    private var nameOrNull: String? = null

    var name: String
        get() = nameOrNull ?: ""
        set(value) {
            nameOrNull = value
        }

    @Transient
    var shared_by: String? = null
}

data class FoldersResponse(val folders: List<FolderDto> = emptyList())
data class FolderResponse(val folder: FolderDto)

data class CreateFolderRequestV2(

    val name_enc: String,
    val parent_id: String? = null,
)

data class PatchFileRequestV2(

    val meta_enc: String? = null,
    val folder_id: String? = null,

    val expires_at: String? = null,
)

data class PatchFolderRequestV2(
    val name_enc: String? = null,
    val parent_id: String? = null,
    val expires_at: String? = null,
)

data class SaveSharedRequestV2(
    val meta_enc: String,
    val wrapped_dek: String,
    val folder_id: String? = null,
)

data class DeleteResult(val deleted: Boolean = false)
