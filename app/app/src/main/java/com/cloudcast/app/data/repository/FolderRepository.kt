package com.cloudcast.app.data.repository

import com.cloudcast.app.core.NameIndex
import com.cloudcast.app.core.indexFrom
import com.cloudcast.app.core.resolveName
import com.cloudcast.app.crypto.FileCryptoGlue
import com.cloudcast.app.crypto.Session
import com.cloudcast.app.data.network.ApiService
import com.cloudcast.app.data.network.CreateFolderRequestV2
import com.cloudcast.app.data.network.FolderDto
import com.google.gson.GsonBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.google.gson.JsonObject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

class FolderRepository(private val api: ApiService) {

    private val moveRequestGson = GsonBuilder().serializeNulls().create()

    private fun jsonBody(json: String) =
        json.toRequestBody("application/json".toMediaTypeOrNull())

    suspend fun list(): List<FolderDto> = FileCryptoGlue.hydrate(api.listFolders().folders)

    private suspend fun folderNameIndex(parentId: String?): NameIndex =
        indexFrom(list().filter { it.parent_id == parentId }, { it.id }, { it.name })

    suspend fun move(id: String, parentId: String?, onConflict: String? = null): FolderDto =
        withContext(Dispatchers.IO) {
            val current = FileCryptoGlue.hydrate(api.getFolder(id).folder)

            val finalName = resolveName(
                index = folderNameIndex(parentId),
                desired = current.name,
                onConflict = onConflict,
                isFolder = true,
                excludeId = id,
                deleteExisting = { delete(it) },
            )
            val body = mutableMapOf<String, Any?>("parent_id" to parentId)
            if (finalName != current.name) body["name_enc"] = Session.sealName(finalName)
            FileCryptoGlue.hydrate(api.patchFolder(id, jsonBody(moveRequestGson.toJson(body))).folder)
        }

    suspend fun create(name: String, parentId: String?, onConflict: String? = null): FolderDto =
        withContext(Dispatchers.IO) {
            val finalName = resolveName(
                index = folderNameIndex(parentId),
                desired = name.trim(),
                onConflict = onConflict,
                isFolder = true,
                deleteExisting = { delete(it) },
            )
            FileCryptoGlue.hydrate(
                api.createFolder(
                    CreateFolderRequestV2(name_enc = Session.sealName(finalName), parent_id = parentId),
                ).folder,
            )
        }

    suspend fun rename(id: String, name: String, onConflict: String? = null): FolderDto =
        withContext(Dispatchers.IO) {
            val current = FileCryptoGlue.hydrate(api.getFolder(id).folder)
            val finalName = resolveName(
                index = folderNameIndex(current.parent_id),
                desired = name.trim(),
                onConflict = onConflict,
                isFolder = true,
                excludeId = id,
                deleteExisting = { delete(it) },
            )
            FileCryptoGlue.hydrate(
                api.patchFolder(
                    id,
                    jsonBody(moveRequestGson.toJson(mapOf("name_enc" to Session.sealName(finalName)))),
                ).folder,
            )
        }

    suspend fun delete(id: String) {
        api.deleteFolder(id)
    }

    suspend fun setExpiry(id: String, expiresAt: String?): FolderDto {
        val obj = JsonObject().apply {
            if (expiresAt == null) add("expires_at", null) else addProperty("expires_at", expiresAt)
        }
        return FileCryptoGlue.hydrate(api.patchFolder(id, jsonBody(obj.toString())).folder)
    }

}
