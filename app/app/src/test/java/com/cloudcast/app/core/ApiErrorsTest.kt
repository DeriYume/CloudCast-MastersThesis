package com.cloudcast.app.core

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException

class ApiErrorsTest {

    private val fallback = "Sign in failed"

    private fun httpError(code: Int, body: String): HttpException =
        HttpException(
            retrofit2.Response.error<Any>(
                body.toResponseBody("application/json".toMediaType()),
                Response.Builder()
                    .request(Request.Builder().url("http://localhost/").build())
                    .protocol(Protocol.HTTP_1_1)
                    .code(code)
                    .message("error")
                    .build(),
            ),
        )

    private fun assertNoDevDetail(msg: String) {
        val leaks = listOf(
            "10.0.2.2", "localhost", "192.168", "http://", "https://", ":8080", "/",
            "Exception", "java.", "okhttp", "retrofit", "null",
        )
        for (l in leaks) {
            assertFalse("leaked \"$l\" into: $msg", msg.contains(l, ignoreCase = true))
        }
        assertTrue("message should be a sentence: $msg", msg.length > 10)
    }

    @Test
    fun `server messages are preferred and passed through verbatim`() {

        assertEquals(
            "Authentication failed",
            friendlyError(httpError(401, """{"error":"Authentication failed"}"""), fallback),
        )
    }

    @Test
    fun `connection refused reads as the server being unreachable`() {

        val msg = friendlyError(ConnectException("Failed to connect to /10.0.2.2:8080"), fallback)
        assertNoDevDetail(msg)
        assertTrue(msg, msg.contains("server", ignoreCase = true))
    }

    @Test
    fun `unknown host reads as a connectivity problem`() {
        val msg = friendlyError(UnknownHostException("Unable to resolve host \"api.cloudcast\""), fallback)
        assertNoDevDetail(msg)
        assertTrue(msg, msg.contains("connection", ignoreCase = true))
    }

    @Test
    fun `timeout says the server was slow, not that the connection is down`() {

        val msg = friendlyError(SocketTimeoutException("timeout"), fallback)
        assertNoDevDetail(msg)
        assertTrue(msg, msg.contains("too long", ignoreCase = true))
    }

    @Test
    fun `TLS failures get their own message`() {

        val msg = friendlyError(SSLHandshakeException("Trust anchor for certification path not found."), fallback)
        assertNoDevDetail(msg)
        assertTrue(msg, msg.contains("secure", ignoreCase = true))
    }

    @Test
    fun `wrapped causes are still recognised`() {

        val wrapped = RuntimeException("request failed", IOException("boom", ConnectException("Failed to connect to /10.0.2.2:8080")))
        val msg = friendlyError(wrapped, fallback)
        assertNoDevDetail(msg)
        assertTrue(msg, msg.contains("server", ignoreCase = true))
    }

    @Test
    fun `server-side status codes without a body get a sensible message`() {
        val msg = friendlyError(httpError(503, ""), fallback)
        assertNoDevDetail(msg)
        assertTrue(msg, msg.contains("server", ignoreCase = true))
    }

    @Test
    fun `our own deliberate messages pass through`() {

        assertEquals(
            "Your keys are locked - please sign in again.",
            friendlyError(IllegalStateException("Your keys are locked - please sign in again."), fallback),
        )
        assertEquals(
            "Could not read archive (not a valid zip)",
            friendlyError(IllegalArgumentException("Could not read archive (not a valid zip)"), fallback),
        )
    }

    @Test
    fun `unrecognised failures use the caller's fallback, not their own message`() {

        assertEquals(
            fallback,
            friendlyError(NullPointerException("Attempt to invoke virtual method on a null object reference"), fallback),
        )
        assertEquals(fallback, friendlyError(RuntimeException("kotlin.jvm.internal blah"), fallback))
    }

    @Test
    fun `httpStatus still reports the code for callers that branch on it`() {

        assertEquals(503, httpStatus(httpError(503, "")))
        assertEquals(null, httpStatus(ConnectException("nope")))
    }
}
