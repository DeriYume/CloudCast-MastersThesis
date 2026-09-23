package com.cloudcast.app.data.network

import android.util.Log
import com.cloudcast.app.BuildConfig
import com.cloudcast.app.core.ApiConfig
import com.cloudcast.app.data.TokenStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.shareIn
import kotlinx.coroutines.isActive
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

class EventStream(private val tokenStore: TokenStore) {

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val shared: Flow<String> by lazy {
        connect().shareIn(
            scope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
            started = SharingStarted.WhileSubscribed(stopTimeoutMillis = 5_000),
            replay = 0,
        )
    }

    fun events(): Flow<String> = shared

    private fun connect(): Flow<String> = callbackFlow {
        var attempt = 0
        while (coroutineContext.isActive) {
            val token = tokenStore.currentToken()
            logd { "connect attempt=$attempt token=${if (token == null) "MISSING" else "present"}" }
            if (token == null) {

                delay(RECONNECT_MAX_MS)
                continue
            }

            var opened = false
            try {
                val request = Request.Builder()
                    .url(ApiConfig.BASE_URL.trimEnd('/') + "/files/notifications/stream")
                    .header("Authorization", "Bearer $token")
                    .header("Accept", "text/event-stream")
                    .header("Cache-Control", "no-cache")
                    .build()

                logd { "GET ${request.url}" }
                client.newCall(request).execute().use { response ->
                    logd { "response ${response.code} ${response.header("content-type")}" }
                    if (!response.isSuccessful) error("stream ${response.code}")
                    opened = true
                    attempt = 0
                    val source = response.body?.source() ?: error("no stream body")

                    var eventName = "message"
                    var sawData = false
                    while (coroutineContext.isActive && !source.exhausted()) {
                        val line = source.readUtf8LineStrict()
                        when {
                            line.isEmpty() -> {

                                if (sawData) {
                                    logd { "event: $eventName" }
                                    val sent = trySend(eventName)
                                    if (sent.isFailure) Log.w(TAG, "dropped event $eventName: $sent")
                                }
                                eventName = "message"
                                sawData = false
                            }
                            line.startsWith(":") -> Unit
                            line.startsWith("event:") -> eventName = line.removePrefix("event:").trim()
                            line.startsWith("data:") -> sawData = true
                        }
                    }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {

                Log.w(TAG, "stream error: ${e.javaClass.simpleName}: ${e.message}")
            }

            if (!coroutineContext.isActive) break

            attempt = if (opened) 1 else (attempt + 1).coerceAtMost(MAX_ATTEMPT)
            delay((RECONNECT_BASE_MS * (1L shl (attempt - 1))).coerceAtMost(RECONNECT_MAX_MS))
        }
        awaitClose { }
    }.flowOn(Dispatchers.IO)

    private inline fun logd(message: () -> String) {
        if (BuildConfig.DEBUG) Log.d(TAG, message())
    }

    private companion object {
        const val TAG = "CloudCastSSE"
        const val RECONNECT_BASE_MS = 1_000L
        const val RECONNECT_MAX_MS = 30_000L
        const val MAX_ATTEMPT = 6
    }
}
