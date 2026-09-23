package com.cloudcast.app.data.network

data class CreateShareRequestV2(
    val recipient_id: String,

    val recipient_label: String,

    val sharer_label: String,
    val file_id: String? = null,
    val folder_id: String? = null,

    val meta_sealed: String? = null,

    val wrapped_dek: String? = null,

    val keys: List<ShareFileKey>? = null,

    val folder_keys: List<ShareFolderName>? = null,
    val expires_at: String? = null,

    val permission: String = "view",
)

data class ShareFileKey(
    val file_id: String,
    val wrapped_dek: String,

    val meta_sealed: String,
)

data class ShareFolderName(
    val folder_id: String,

    val meta_sealed: String,
)

data class ShareDtoV2(
    val id: String = "",
    val recipient_id: String = "",
    val recipient_label: String? = null,
    val expires_at: String? = null,
    val permission: String? = null,
    val created_at: String = "",
)

data class SharesResponseV2(val shares: List<ShareDtoV2> = emptyList())

data class ShareResponseV2(val share: ShareDtoV2)

data class UpdateShareRequest(
    val permission: String? = null,
    val expires_at: String? = null,
    val clear_expiry: Boolean? = null,
)

data class ContactDto(
    val recipient_id: String,
    val recipient_label: String? = null,
)

data class ContactsResponse(val contacts: List<ContactDto> = emptyList())

data class UserSuggestionDtoV2(
    val id: String,

    val public_key: String,
)

data class UserSearchResponseV2(val results: List<UserSuggestionDtoV2> = emptyList())

data class UnshareRequest(
    val file_id: String? = null,
    val folder_id: String? = null,
)

data class LeaveShareRequest(
    val file_id: String? = null,
    val folder_id: String? = null,
)

data class ShareExpiryRequest(
    val file_id: String? = null,
    val folder_id: String? = null,
    val expires_at: String? = null,
)

data class UnsharedResponse(val unshared: Boolean = false)
data class LeftResponse(val left: Boolean = false)
data class UpdatedResponse(val updated: Boolean = false)
