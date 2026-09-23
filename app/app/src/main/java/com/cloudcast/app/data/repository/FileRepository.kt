package com.cloudcast.app.data.repository

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.documentfile.provider.DocumentFile
import com.cloudcast.app.core.ContentKind
import com.cloudcast.app.core.NameIndex
import com.cloudcast.app.core.indexFrom
import com.cloudcast.app.core.resolveName
import com.cloudcast.app.core.ZipTools
import com.cloudcast.app.core.contentKind
import com.cloudcast.app.core.httpStatus
import com.cloudcast.app.crypto.FileCryptoGlue
import com.cloudcast.app.crypto.Session
import com.cloudcast.app.crypto.wipe
import com.cloudcast.app.data.network.ApiService
import com.cloudcast.app.data.network.AiGrantRequest
import com.cloudcast.app.data.network.AiPreferences
import com.cloudcast.app.data.network.AiConfigResponse
import com.cloudcast.app.data.network.EmbedQueryRequest
import com.cloudcast.app.data.network.SaveSharedRequestV2
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.data.network.NotificationDto
import com.cloudcast.app.data.network.NotificationsResponse

import com.cloudcast.app.data.network.withFavorite
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class FileRepository(
    private val api: ApiService,
    private val context: Context,

    private val favorites: FavoritesStore,
) {
    private val moveRequestGson = GsonBuilder().serializeNulls().create()

    private fun stamp(files: List<FileDto>): List<FileDto> =
        files.map { it.withFavorite(favorites.isFavorite(it.id)) }

    private fun stamp(file: FileDto): FileDto = file.withFavorite(favorites.isFavorite(file.id))

    private fun jsonBody(json: String) =
        json.toRequestBody("application/json".toMediaTypeOrNull())

    suspend fun list(folderId: String?, all: Boolean = false): List<FileDto> =
        stamp(
            FileCryptoGlue.hydrate(
                api.listFiles(
                    folder = folderId,
                    all = if (all) "true" else null,
                ).files,
            ),
        )

    suspend fun listFavorites(): List<FileDto> = list(null, all = true).filter { it.is_favorite }

    suspend fun delete(id: String) {
        api.deleteFile(id)
    }

    suspend fun get(id: String) = stamp(FileCryptoGlue.hydrate(api.getFile(id).file))

    suspend fun contentBytes(id: String, wrappedDek: String? = null): ByteArray =
        withContext(Dispatchers.IO) {
            val wrapped = wrappedDek
                ?: api.getFile(id).file.wrapped_dek
                ?: throw IllegalStateException("No decryption key was returned for this file.")
            val ciphertext = api.previewContent(id).use { it.bytes() }
            FileCryptoGlue.decryptDownload(ciphertext, wrapped)
        }

    suspend fun cacheContent(id: String, suffix: String, wrappedDek: String? = null): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "preview").apply { mkdirs() }
        val out = File(dir, "$id$suffix")

        out.outputStream().use { dst -> dst.write(contentBytes(id, wrappedDek)) }
        out
    }

    suspend fun zipEntries(id: String, wrappedDek: String? = null): ZipTools.Listing =
        withContext(Dispatchers.IO) { ZipTools.listEntries(contentBytes(id, wrappedDek)) }

    suspend fun textContent(
        id: String,
        maxBytes: Int = 256 * 1024,
        wrappedDek: String? = null,
    ): Pair<String, Boolean> =
        withContext(Dispatchers.IO) {
            val bytes = contentBytes(id, wrappedDek)
            val limited = if (bytes.size > maxBytes) bytes.copyOf(maxBytes) else bytes
            String(limited, Charsets.UTF_8) to (bytes.size > maxBytes)
        }

    suspend fun saveTo(id: String, dest: Uri) = withContext(Dispatchers.IO) {
        val bytes = contentBytes(id)
        context.contentResolver.openOutputStream(dest)?.use { it.write(bytes) }
            ?: throw IllegalStateException("Couldn't open the chosen location")
    }

    suspend fun saveArchive(
        files: List<Pair<String, String>>,
        folders: List<Pair<String, String>>,
        dest: Uri,
    ) = withContext(Dispatchers.IO) {
        val out = context.contentResolver.openOutputStream(dest)
            ?: throw IllegalStateException("Couldn't open the chosen location")
        out.use { stream ->
            ZipTools.write(stream) { zip ->
                for ((id, name) in files) {
                    zip.add(ZipTools.safeName(name), contentBytes(id))
                }
                for ((id, name) in folders) {
                    addFolderToZip(zip, id, ZipTools.safeName(name) + "/")
                }
            }
        }
    }

    private suspend fun addFolderToZip(zip: ZipTools.ZipWriter, folderId: String, prefix: String) {
        for (f in listFolderFiles(folderId)) {
            zip.add(prefix + ZipTools.safeName(f.original_name), contentBytes(f.id))
        }
        for (sub in FileCryptoGlue.hydrate(api.listSubfolders(folderId).folders)) {
            addFolderToZip(zip, sub.id, prefix + ZipTools.safeName(sub.name) + "/")
        }
    }

    suspend fun saveContentInto(
        treeUri: Uri,
        displayName: String,
        mimeType: String,
        fileId: String,
    ) = withContext(Dispatchers.IO) {
        val tree = DocumentFile.fromTreeUri(context, treeUri)
            ?: throw IllegalStateException("Couldn't open the chosen folder")
        val doc = tree.createFile(mimeType.ifBlank { "application/octet-stream" }, displayName)
            ?: throw IllegalStateException("Couldn't create \"$displayName\"")
        val plaintext = contentBytes(fileId)
        context.contentResolver.openOutputStream(doc.uri)?.use { it.write(plaintext) }
            ?: throw IllegalStateException("Couldn't write \"$displayName\"")
    }

    suspend fun setFavorite(id: String, favorite: Boolean) {
        favorites.toggle(id, favorite)
    }

    suspend fun refreshFavorites() { favorites.refreshIfStale() }

    private suspend fun fileNameIndex(folderId: String?): NameIndex =
        indexFrom(list(folderId), { it.id }, { it.original_name })

    suspend fun rename(id: String, name: String, onConflict: String? = null): FileDto =
        withContext(Dispatchers.IO) {
            val trimmed = name.trim()
            val current = get(id)
            val finalName = resolveName(
                index = fileNameIndex(current.folder_id),
                desired = trimmed,
                onConflict = onConflict,
                isFolder = false,
                excludeId = id,
                deleteExisting = { delete(it) },
            )
            FileCryptoGlue.hydrate(
                api.patchFile(
                    id,

                    jsonBody(
                        moveRequestGson.toJson(
                            mapOf("meta_enc" to Session.sealMeta(finalName, current.mime_type)),
                        ),
                    ),
                ).file,
            )
        }

    suspend fun move(id: String, folderId: String?, onConflict: String? = null): FileDto =
        withContext(Dispatchers.IO) {
            val current = get(id)

            val finalName = resolveName(
                index = fileNameIndex(folderId),
                desired = current.original_name,
                onConflict = onConflict,
                isFolder = false,
                excludeId = id,
                deleteExisting = { delete(it) },
            )
            val body = mutableMapOf<String, Any?>("folder_id" to folderId)
            if (finalName != current.original_name) {
                body["meta_enc"] = Session.sealMeta(finalName, current.mime_type)
            }
            FileCryptoGlue.hydrate(api.patchFile(id, jsonBody(moveRequestGson.toJson(body))).file)
        }

    suspend fun setExpiry(id: String, expiresAt: String?): FileDto {
        val obj = JsonObject().apply {
            if (expiresAt == null) add("expires_at", null) else addProperty("expires_at", expiresAt)
        }
        return FileCryptoGlue.hydrate(api.patchFile(id, jsonBody(obj.toString())).file)
    }

    suspend fun saveSharedFile(id: String): FileDto = withContext(Dispatchers.IO) {
        val file = FileCryptoGlue.hydrate(api.getFile(id).file)
        val wrapped = file.wrapped_dek
            ?: throw IllegalStateException("No decryption key was returned for this shared file.")

        val resealed = FileCryptoGlue.resealForSelf(wrapped, file.original_name, file.mime_type)
        FileCryptoGlue.hydrate(
            api.saveSharedFile(
                id,
                SaveSharedRequestV2(
                    meta_enc = resealed.metaEnc,
                    wrapped_dek = resealed.wrappedDek,
                ),
            ).file,
        )
    }

    suspend fun notifications(): Pair<List<NotificationDto>, Int> {
        val res = api.notifications()
        return res.notifications to res.unread
    }

    suspend fun deleteNotification(id: String) {
        try {
            api.deleteNotification(id)
        } catch (e: Exception) {
            if (httpStatus(e) != 404) throw e
        }
    }

    suspend fun clearNotifications() {
        api.clearNotifications()
    }

    suspend fun expiring(): Pair<List<FileDto>, List<FolderDto>> = withContext(Dispatchers.IO) {
        val res = api.expiring()
        FileCryptoGlue.hydrate(res.files) to FileCryptoGlue.hydrate(res.folders)
    }

    @Volatile
    private var serverPublicKey: String? = null

    private suspend fun serverKey(): String =
        serverPublicKey ?: api.aiServerKey().public_key.also { serverPublicKey = it }

    private suspend fun mintGrant(id: String, wrappedDek: String? = null): String {
        val wrapped = wrappedDek
            ?: api.getFile(id).file.wrapped_dek
            ?: throw IllegalStateException("No decryption key was returned for this file.")
        val dek = Session.openWrappedDek(wrapped)
        return try {
            Session.wrapDekForPub(dek, serverKey())
        } finally {

            dek.wipe()
        }
    }

    @Volatile
    private var aiConfigCache: AiConfigResponse? = null

    fun clearAiCaches() {
        aiConfigCache = null
    }

    suspend fun aiConfig(): AiConfigResponse =
        aiConfigCache ?: withContext(Dispatchers.IO) { api.aiConfig() }.also { aiConfigCache = it }

    suspend fun aiPreferences(): AiPreferences = aiConfig().preferences

    suspend fun updateAiPreferences(prefs: AiPreferences) = withContext(Dispatchers.IO) {
        api.updateAiPreferences(prefs)

        aiConfigCache = (aiConfigCache ?: api.aiConfig()).copy(preferences = prefs)
        Unit
    }

    suspend fun analyze(id: String, wrappedDek: String? = null): String =
        withContext(Dispatchers.IO) {
            val grant = mintGrant(id, wrappedDek)
            val sealed = api.analyze(id, AiGrantRequest(grant)).summary_sealed
            Session.openNameSealedToMe(sealed)
        }

    suspend fun classify(id: String, wrappedDek: String? = null): String =
        withContext(Dispatchers.IO) {
            val grant = mintGrant(id, wrappedDek)
            Session.openNameSealedToMe(api.classify(id, AiGrantRequest(grant)).category_sealed)
        }

    suspend fun embedFile(id: String, wrappedDek: String? = null) = withContext(Dispatchers.IO) {
        api.embedFile(id, AiGrantRequest(mintGrant(id, wrappedDek)))
        Unit
    }

    suspend fun extractKeywords(id: String, wrappedDek: String? = null): Boolean =
        withContext(Dispatchers.IO) {
            val res = api.extractKeywords(id, AiGrantRequest(mintGrant(id, wrappedDek)))
            res.ok && res.skipped == null
        }

    suspend fun keywords(): Map<String, List<String>> = withContext(Dispatchers.Default) {
        api.keywords().keywords.mapNotNull { row ->
            val sealed = row.keywords_enc ?: return@mapNotNull null
            val words = runCatching {
                val json = Session.openSealedBytesToMe(sealed).toString(Charsets.UTF_8)
                keywordGson.fromJson(json, Array<String>::class.java).orEmpty().toList()
            }.getOrNull() ?: return@mapNotNull null
            row.file_id to words
        }.toMap()
    }

    private val keywordGson = GsonBuilder().create()

    data class FilingSuggestion(val embedding: FloatArray, val suggestedName: String)

    suspend fun suggestFiling(id: String, wrappedDek: String? = null): FilingSuggestion =
        withContext(Dispatchers.IO) {
            val res = api.suggestFiling(id, AiGrantRequest(mintGrant(id, wrappedDek)))
            FilingSuggestion(
                embedding = decodeVector(Session.openSealedBytesToMe(res.embedding_enc)),
                suggestedName = Session.openNameSealedToMe(res.suggested_name_enc),
            )
        }

    suspend fun folderCentroids(): Map<String, FloatArray> = withContext(Dispatchers.Default) {
        val all = listAllFiles()
        val vectors = embeddings()
        val folderOf = all.associate { it.id to it.folder_id }

        val sums = HashMap<String, FloatArray>()
        val counts = HashMap<String, Int>()
        for ((fileId, vec) in vectors) {
            val folderId = folderOf[fileId] ?: continue
            val sum = sums[folderId]
            if (sum == null) {
                sums[folderId] = vec.copyOf()
                counts[folderId] = 1
            } else {
                for (i in sum.indices) if (i < vec.size) sum[i] += vec[i]
                counts[folderId] = counts.getValue(folderId) + 1
            }
        }
        sums.mapValues { (folderId, sum) ->
            val n = counts.getValue(folderId).toFloat()
            FloatArray(sum.size) { sum[it] / n }
        }
    }

    private fun decodeVector(bytes: ByteArray): FloatArray {
        val buf = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        return FloatArray(bytes.size / 4) { buf.getFloat(it * 4) }
    }

    suspend fun reindexSemantic(concurrency: Int = 3): Int = withContext(Dispatchers.IO) {
        val targets = listAllFiles().filter {

            when (contentKind(it.mime_type, it.original_name)) {
                ContentKind.TEXT, ContentKind.CODE, ContentKind.IMAGE,
                ContentKind.DOC, ContentKind.PDF,
                -> true
                else -> false
            }
        }
        val cursor = java.util.concurrent.atomic.AtomicInteger(0)
        val done = java.util.concurrent.atomic.AtomicInteger(0)
        coroutineScope {
            repeat(concurrency.coerceAtLeast(1)) {
                launch {
                    while (true) {
                        val i = cursor.getAndIncrement()
                        if (i >= targets.size) break
                        val file = targets[i]
                        try {
                            embedFile(file.id)
                            done.incrementAndGet()
                        } catch (e: Exception) {

                            if (httpStatus(e) == 503 || httpStatus(e) == 403) throw e

                        }

                        runCatching { extractKeywords(file.id) }
                    }
                }
            }
        }
        done.get()
    }

    suspend fun getFolder(id: String): FolderDto = FileCryptoGlue.hydrate(api.getFolder(id).folder)

    suspend fun listFolderFiles(id: String): List<FileDto> =
        stamp(FileCryptoGlue.hydrate(api.listFolderFiles(id).files))

    fun mimeOf(uri: Uri): String =
        context.contentResolver.getType(uri) ?: "application/octet-stream"

    fun nameOf(uri: Uri): String = displayName(context.contentResolver, uri) ?: "upload"

    suspend fun upload(uri: Uri, folderId: String?, onConflict: String? = null): FileDto = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val picked = displayName(resolver, uri) ?: "upload"
        val mime = resolver.getType(uri) ?: "application/octet-stream"

        val name = resolveName(
            index = fileNameIndex(folderId),
            desired = picked,
            onConflict = onConflict,
            isFolder = false,
            deleteExisting = { delete(it) },
        )
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("Couldn't read the selected file")

        val prepared = FileCryptoGlue.prepareUpload(bytes, name, mime)
        val filePart = MultipartBody.Part.createFormData(
            "file",
            "blob",
            prepared.ciphertext.toRequestBody("application/octet-stream".toMediaTypeOrNull()),
        )
        fun text(v: String) = v.toRequestBody("text/plain".toMediaTypeOrNull())

        FileCryptoGlue.hydrate(
            api.uploadFile(
                file = filePart,
                metaEnc = text(prepared.metaEnc),
                wrappedDek = text(prepared.wrappedDek),
                sizeBytes = text(prepared.plaintextSize.toString()),
                folderId = folderId?.let { text(it) },
            ).file,
        )
    }

    suspend fun listAllFiles(): List<FileDto> = withContext(Dispatchers.IO) {
        stamp(FileCryptoGlue.hydrate(api.listFiles(all = "true").files))
    }

    suspend fun embedQuery(query: String): FloatArray = withContext(Dispatchers.IO) {
        api.embedQuery(EmbedQueryRequest(query.trim())).vector.toFloatArray()
    }

    suspend fun embeddings(): Map<String, FloatArray> = withContext(Dispatchers.Default) {
        api.embeddings().embeddings.mapNotNull { row ->
            val sealed = row.embedding_enc ?: return@mapNotNull null
            val vec = runCatching {
                val bytes = Session.openSealedBytesToMe(sealed)
                val buf = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
                FloatArray(bytes.size / 4) { buf.getFloat(it * 4) }
            }.getOrNull() ?: return@mapNotNull null
            row.file_id to vec
        }.toMap()
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String? {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) return c.getString(idx)
            }
        }
        return null
    }
}
