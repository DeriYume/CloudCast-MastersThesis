package com.cloudcast.app.data.repository

import com.cloudcast.app.core.Formats
import com.cloudcast.app.core.httpStatus
import com.cloudcast.app.crypto.Session
import com.cloudcast.app.data.network.ApiService
import com.cloudcast.app.data.network.PrefsBlobRequest
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class FavoritesStore(private val api: ApiService) {

    @Volatile
    private var cached: Snapshot = Snapshot(emptySet(), 0)

    @Volatile
    private var loadedAtMs: Long = 0L

    private val writeLock = Mutex()

    data class Snapshot(val ids: Set<String>, val revision: Int)

    fun current(): Set<String> = cached.ids

    fun isFavorite(fileId: String): Boolean = fileId in cached.ids

    suspend fun refresh(): Set<String> = withContext(Dispatchers.IO) {
        val res = api.getPrefsBlob(KIND)
        cached = decode(res.blob, res.revision)
        loadedAtMs = System.currentTimeMillis()
        cached.ids
    }

    suspend fun refreshIfStale(ttlMs: Long = DEFAULT_TTL_MS): Set<String> =
        if (loadedAtMs != 0L && System.currentTimeMillis() - loadedAtMs < ttlMs) cached.ids
        else refresh()

    suspend fun toggle(fileId: String, favorite: Boolean): Set<String> = withContext(Dispatchers.IO) {
        writeLock.withLock {
            repeat(MAX_ATTEMPTS) {
                val base = cached
                val next = if (favorite) base.ids + fileId else base.ids - fileId
                try {
                    val res = api.putPrefsBlob(KIND, PrefsBlobRequest(blob = seal(next), revision = base.revision))
                    cached = Snapshot(next, res.revision)

                    loadedAtMs = System.currentTimeMillis()
                    return@withLock next
                } catch (e: Exception) {

                    if (httpStatus(e) != 409) throw e
                    val fresh = api.getPrefsBlob(KIND)
                    cached = decode(fresh.blob, fresh.revision)
                    loadedAtMs = System.currentTimeMillis()
                }
            }

            error("Couldn't update favourites - please try again.")
        }
    }

    fun clear() {
        cached = Snapshot(emptySet(), 0)

        loadedAtMs = 0L
    }

    private fun decode(blobB64: String?, revision: Int): Snapshot {
        if (blobB64.isNullOrEmpty()) return Snapshot(emptySet(), revision)
        return try {
            val json = Session.openBlob(blobB64).toString(Charsets.UTF_8)
            val ids: List<String> = gson.fromJson(json, idListType) ?: emptyList()
            Snapshot(ids.toSet(), revision)
        } catch (_: Exception) {

            Snapshot(emptySet(), revision)
        }
    }

    private fun seal(ids: Set<String>): String =
        Session.sealBlob(gson.toJson(ids.toList()).toByteArray(Charsets.UTF_8))

    private companion object {
        const val KIND = Formats.BLOB_KIND_FAVORITES
        const val MAX_ATTEMPTS = 3
        const val DEFAULT_TTL_MS = 30_000L
        val gson = Gson()
        val idListType = object : TypeToken<List<String>>() {}.type
    }
}
