package com.cloudcast.app.core

import com.cloudcast.app.data.network.ApiError
import com.google.gson.Gson
import retrofit2.HttpException

private val errorGson = Gson()

fun parseApiError(e: Throwable): ApiError? {
    if (e is HttpException) {
        val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
        if (!body.isNullOrBlank()) {
            return runCatching { errorGson.fromJson(body, ApiError::class.java) }.getOrNull()
        }
    }
    return null
}

fun friendlyError(e: Throwable, fallback: String): String {
    parseApiError(e)?.error?.takeIf { it.isNotBlank() }?.let { return it }
    networkMessage(e)?.let { return it }
    httpStatusMessage(e)?.let { return it }

    if (e is IllegalStateException || e is IllegalArgumentException) {
        e.message?.takeIf { it.isNotBlank() }?.let { return it }
    }
    return fallback
}

private fun networkMessage(e: Throwable): String? {
    var t: Throwable? = e
    var depth = 0
    while (t != null && depth < 8) {
        when (t) {

            is java.net.UnknownHostException ->
                return "Can't reach CloudCast. Check your internet connection and try again."

            is java.net.ConnectException, is java.net.NoRouteToHostException, is java.net.PortUnreachableException ->
                return "Could not reach the server. It may be offline - try again shortly."

            is java.net.SocketTimeoutException ->
                return "The server took too long to respond. Try again."

            is javax.net.ssl.SSLException ->
                return "Couldn't establish a secure connection to the server."

            is java.net.SocketException ->
                return "The connection to the server was lost. Try again."
        }

        if (t is java.io.IOException && t.cause == null) {
            return "Could not reach the server. Check your connection and try again."
        }
        t = t.cause
        depth++
    }
    return null
}

private fun httpStatusMessage(e: Throwable): String? = when ((e as? HttpException)?.code()) {
    500, 502, 503, 504 -> "The server ran into a problem. Please try again shortly."
    408 -> "That took too long. Try again."
    429 -> "Too many attempts. Wait a moment and try again."
    else -> null
}

fun httpStatus(e: Throwable): Int? = (e as? HttpException)?.code()
