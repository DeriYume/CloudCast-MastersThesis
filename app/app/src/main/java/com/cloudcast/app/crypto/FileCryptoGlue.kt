package com.cloudcast.app.crypto

import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object FileCryptoGlue {

    fun displayName(nameEnc: String?, nameSealed: String?): String = when {
        !nameSealed.isNullOrEmpty() -> Session.openNameSealedToMe(nameSealed)
        !nameEnc.isNullOrEmpty() -> Session.openName(nameEnc)
        else -> ""
    }

    private fun sharedBy(sharerLabel: String?): String? =
        if (sharerLabel.isNullOrEmpty()) null else Session.openNameSealedToMe(sharerLabel)

    suspend fun hydrate(files: List<FileDto>): List<FileDto> =
        withContext(Dispatchers.Default) { files.onEach { hydrateItem(it) } }

    @JvmName("hydrateFolders")
    suspend fun hydrate(folders: List<FolderDto>): List<FolderDto> =
        withContext(Dispatchers.Default) { folders.onEach { hydrateItem(it) } }

    private fun hydrateItem(file: FileDto) = hydrate(file)

    private fun hydrateItem(folder: FolderDto) = hydrate(folder)

    fun hydrate(file: FileDto): FileDto = file.also {
        val meta = if (!it.meta_sealed.isNullOrEmpty()) {
            Session.openMetaSealedToMe(it.meta_sealed)
        } else {
            Session.openMeta(it.meta_enc)
        }
        it.original_name = meta.name
        it.mime_type = meta.mime
        it.shared_by = sharedBy(it.sharer_label)
    }

    fun hydrate(folder: FolderDto): FolderDto = folder.also {
        it.name = displayName(it.name_enc, it.name_sealed)
        it.shared_by = sharedBy(it.sharer_label)
    }

    class EncryptedUpload(

        val ciphertext: ByteArray,

        val metaEnc: String,

        val wrappedDek: String,

        val plaintextSize: Long,
    )

    fun prepareUpload(plaintext: ByteArray, name: String, mime: String): EncryptedUpload {
        val dek = Session.newDek()
        try {
            return EncryptedUpload(
                ciphertext = FileCrypto.encryptFile(plaintext, dek),
                metaEnc = Session.sealMeta(name, mime),
                wrappedDek = Session.wrapDekForSelf(dek),
                plaintextSize = plaintext.size.toLong(),
            )
        } finally {

            dek.wipe()
        }
    }

    fun decryptDownload(ciphertext: ByteArray, wrappedDekB64: String): ByteArray {
        val dek = Session.openWrappedDek(wrappedDekB64)
        try {
            return FileCrypto.decryptFile(ciphertext, dek)
        } finally {
            dek.wipe()
        }
    }

    class ResealedForSelf(val metaEnc: String, val wrappedDek: String)

    fun resealForSelf(wrappedDekB64: String, displayName: String, mime: String): ResealedForSelf {
        val dek = Session.openWrappedDek(wrappedDekB64)
        try {
            return ResealedForSelf(
                metaEnc = Session.sealMeta(displayName, mime),
                wrappedDek = Session.wrapDekForSelf(dek),
            )
        } finally {
            dek.wipe()
        }
    }
}
