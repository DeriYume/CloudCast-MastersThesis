package com.cloudcast.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "cloudcast_auth")

class TokenStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("token")
    private val emailKey = stringPreferencesKey("email")
    private val pendingDeletionKey = stringPreferencesKey("pending_deletion")

    private val sessionIvKey = stringPreferencesKey("session_iv")
    private val sessionBlobKey = stringPreferencesKey("session_blob")

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[tokenKey] }
    val emailFlow: Flow<String?> = context.dataStore.data.map { it[emailKey] }

    val pendingDeletionFlow: Flow<String?> = context.dataStore.data.map { it[pendingDeletionKey] }

    suspend fun currentToken(): String? = tokenFlow.first()

    suspend fun save(token: String, email: String) {
        context.dataStore.edit {
            it[tokenKey] = token
            it[emailKey] = email
        }
    }

    suspend fun setPendingDeletion(purgeAfter: String?) {
        context.dataStore.edit {
            if (purgeAfter == null) it.remove(pendingDeletionKey) else it[pendingDeletionKey] = purgeAfter
        }
    }

    suspend fun saveSessionBlob(ivB64: String?, cipherB64: String?) {
        context.dataStore.edit {
            if (ivB64 == null || cipherB64 == null) {
                it.remove(sessionIvKey)
                it.remove(sessionBlobKey)
            } else {
                it[sessionIvKey] = ivB64
                it[sessionBlobKey] = cipherB64
            }
        }
    }

    suspend fun sessionBlob(): Pair<String, String>? {
        val prefs = context.dataStore.data.first()
        val iv = prefs[sessionIvKey] ?: return null
        val blob = prefs[sessionBlobKey] ?: return null
        return iv to blob
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }

    suspend fun clearSessionKeepEmail() {
        context.dataStore.edit {
            it.remove(tokenKey)
            it.remove(pendingDeletionKey)
            it.remove(sessionIvKey)
            it.remove(sessionBlobKey)
        }
    }
}
