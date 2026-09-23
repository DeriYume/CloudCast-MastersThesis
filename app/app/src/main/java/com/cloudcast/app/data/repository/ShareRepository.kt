package com.cloudcast.app.data.repository

import com.cloudcast.app.crypto.FileCryptoGlue
import com.cloudcast.app.crypto.Session

import com.cloudcast.app.crypto.wipe
import com.cloudcast.app.data.network.ApiService
import com.cloudcast.app.data.network.ContactDto
import com.cloudcast.app.data.network.CreateShareRequestV2
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.data.network.LeaveShareRequest
import com.cloudcast.app.data.network.ShareDtoV2
import com.cloudcast.app.data.network.ShareExpiryRequest
import com.cloudcast.app.data.network.ShareFileKey
import com.cloudcast.app.data.network.ShareFolderName
import com.cloudcast.app.data.network.UnshareRequest
import com.cloudcast.app.data.network.UpdateShareRequest
import com.cloudcast.app.data.TokenStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

class ShareRepository(
    private val api: ApiService,
    private val tokenStore: TokenStore,
) {

    private suspend fun ownerLabel(): String =
        tokenStore.emailFlow.first()?.takeIf { it.isNotBlank() } ?: "Someone"

    data class ShareItem(
        val id: String,
        val recipientId: String,

        val label: String,
        val expiresAt: String?,
        val permission: String,
        val createdAt: String,
    )

    data class Recipient(
        val id: String,
        val publicKeyB64: String,

        val label: String,
    )

    data class Contact(val id: String, val label: String)

    suspend fun resolveRecipient(query: String): Recipient? = withContext(Dispatchers.IO) {
        val q = query.trim()
        if (q.isEmpty()) return@withContext null
        api.searchUsers(q).results.firstOrNull()?.let {

            Recipient(id = it.id, publicKeyB64 = it.public_key, label = q)
        }
    }

    suspend fun contacts(): List<Contact> = withContext(Dispatchers.IO) {
        api.contacts().contacts.mapNotNull { it.toContact() }
    }

    private fun ContactDto.toContact(): Contact? {
        val opened = Session.openName(recipient_label)
        if (opened.isEmpty() || opened == Session.UNREADABLE) return null
        return Contact(id = recipient_id, label = opened)
    }

    suspend fun listFileShares(fileId: String): List<ShareItem> = withContext(Dispatchers.IO) {
        api.listShares(fileId = fileId, folderId = null).shares.map { it.toItem() }
    }

    suspend fun listFolderShares(folderId: String): List<ShareItem> = withContext(Dispatchers.IO) {
        api.listShares(fileId = null, folderId = folderId).shares.map { it.toItem() }
    }

    private fun ShareDtoV2.toItem() = ShareItem(
        id = id,
        recipientId = recipient_id,

        label = Session.openName(recipient_label),
        expiresAt = expires_at,
        permission = permission ?: PERMISSION_VIEW,
        createdAt = created_at,
    )

    suspend fun shareFile(
        fileId: String,
        recipient: Recipient,
        expiresAt: String? = null,
        permission: String = PERMISSION_VIEW,
    ): ShareItem = withContext(Dispatchers.IO) {
        val owner = ownerLabel()
        val file = FileCryptoGlue.hydrate(api.getFile(fileId).file)
        val wrapped = file.wrapped_dek
            ?: error("This file has no key attached - it can't be shared.")

        val dek = Session.openWrappedDek(wrapped)
        val body = try {
            CreateShareRequestV2(
                recipient_id = recipient.id,
                recipient_label = Session.sealName(recipient.label),
                sharer_label = Session.sealNameForPub(owner, recipient.publicKeyB64),
                file_id = fileId,

                meta_sealed = Session.sealMetaForPub(file.original_name, file.mime_type, recipient.publicKeyB64),
                wrapped_dek = Session.wrapDekForPub(dek, recipient.publicKeyB64),
                expires_at = expiresAt,
                permission = permission,
            )
        } finally {
            dek.wipe()
        }
        api.createShare(body).share.toItem().copy(label = recipient.label)
    }

    suspend fun shareFolder(
        folderId: String,
        recipient: Recipient,
        expiresAt: String? = null,
        permission: String = PERMISSION_VIEW,
    ): ShareItem = withContext(Dispatchers.IO) {
        val owner = ownerLabel()
        val folder = FileCryptoGlue.hydrate(api.getFolder(folderId).folder)
        val collected = collectFolderShare(folderId, recipient.publicKeyB64)
        val body = CreateShareRequestV2(
            recipient_id = recipient.id,
            recipient_label = Session.sealName(recipient.label),
            sharer_label = Session.sealNameForPub(owner, recipient.publicKeyB64),
            folder_id = folderId,
            meta_sealed = Session.sealNameForPub(folder.name, recipient.publicKeyB64),
            keys = collected.fileKeys,
            folder_keys = collected.folderNames,
            expires_at = expiresAt,
            permission = permission,
        )
        api.createShare(body).share.toItem().copy(label = recipient.label)
    }

    private class CollectedShare(
        val fileKeys: List<ShareFileKey>,
        val folderNames: List<ShareFolderName>,
    )

    private suspend fun collectFolderShare(
        folderId: String,
        recipientPk: String,
    ): CollectedShare {
        val all = FileCryptoGlue.hydrate(api.listFolders().folders)
        val byId = all.associateBy { it.id }
        val childrenOf = all.groupBy { it.parent_id }

        val subtree = mutableListOf<String>()
        val seen = mutableSetOf<String>()
        val stack = ArrayDeque(listOf(folderId))
        while (stack.isNotEmpty()) {
            val id = stack.removeLast()
            if (!seen.add(id)) continue
            subtree += id
            childrenOf[id]?.forEach { stack.addLast(it.id) }
        }

        val fileKeys = mutableListOf<ShareFileKey>()
        val folderNames = mutableListOf<ShareFolderName>()
        for (id in subtree) {

            if (id != folderId) {
                byId[id]?.let {
                    folderNames += ShareFolderName(
                        folder_id = id,
                        meta_sealed = Session.sealNameForPub(it.name, recipientPk),
                    )
                }
            }
            for (meta in api.listFolderFiles(id).files) {
                val full = runCatching { FileCryptoGlue.hydrate(api.getFile(meta.id).file) }
                    .getOrNull() ?: continue
                val wrapped = full.wrapped_dek ?: continue
                val dek = runCatching { Session.openWrappedDek(wrapped) }.getOrNull() ?: continue
                try {
                    fileKeys += ShareFileKey(
                        file_id = full.id,
                        wrapped_dek = Session.wrapDekForPub(dek, recipientPk),
                        meta_sealed = Session.sealMetaForPub(full.original_name, full.mime_type, recipientPk),
                    )
                } finally {
                    dek.wipe()
                }
            }
        }
        return CollectedShare(fileKeys, folderNames)
    }

    suspend fun updatePermission(shareId: String, permission: String): String =
        withContext(Dispatchers.IO) {
            api.updateShare(shareId, UpdateShareRequest(permission = permission)).share.permission ?: permission
        }

    suspend fun updateShareExpiry(shareId: String, expiresAt: String?) = withContext(Dispatchers.IO) {
        api.updateShare(
            shareId,
            if (expiresAt == null) UpdateShareRequest(clear_expiry = true)
            else UpdateShareRequest(expires_at = expiresAt),
        )
        Unit
    }

    suspend fun revoke(shareId: String) = withContext(Dispatchers.IO) {
        api.deleteShare(shareId)
        Unit
    }

    suspend fun unshareAll(fileId: String? = null, folderId: String? = null) =
        withContext(Dispatchers.IO) {
            api.unshareAll(UnshareRequest(file_id = fileId, folder_id = folderId))
            Unit
        }

    suspend fun leave(fileId: String? = null, folderId: String? = null) =
        withContext(Dispatchers.IO) {
            api.leaveShare(LeaveShareRequest(file_id = fileId, folder_id = folderId))
            Unit
        }

    suspend fun setShareExpiry(
        fileId: String? = null,
        folderId: String? = null,
        expiresAt: String?,
    ) = withContext(Dispatchers.IO) {
        api.setShareExpiry(ShareExpiryRequest(fileId, folderId, expiresAt))
        Unit
    }

    suspend fun sharedWithMe(): Pair<List<FileDto>, List<FolderDto>> = withContext(Dispatchers.IO) {
        val res = api.sharedWithMe()
        FileCryptoGlue.hydrate(res.files) to FileCryptoGlue.hydrate(res.folders)
    }

    suspend fun sharedByMe(): Pair<List<FileDto>, List<FolderDto>> = withContext(Dispatchers.IO) {
        val res = api.sharedByMe()
        FileCryptoGlue.hydrate(res.files) to FileCryptoGlue.hydrate(res.folders)
    }

    private companion object {
        const val PERMISSION_VIEW = "view"
    }
}
