package com.cloudcast.app.data.network

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShareDtoContractTest {

    private val gson = Gson()

    private fun json(any: Any): JsonObject =
        JsonParser.parseString(gson.toJson(any)).asJsonObject

    @Test
    fun `file share sends exactly the keys the server reads`() {
        val body = CreateShareRequestV2(
            recipient_id = "u1",
            recipient_label = "AAAA",
            sharer_label = "BBBB",
            file_id = "f1",
            meta_sealed = "CCCC",
            wrapped_dek = "DDDD",
            expires_at = null,
            permission = "save",
        )
        val o = json(body)

        assertEquals("u1", o["recipient_id"].asString)
        assertEquals("AAAA", o["recipient_label"].asString)
        assertEquals("BBBB", o["sharer_label"].asString)
        assertEquals("f1", o["file_id"].asString)
        assertEquals("CCCC", o["meta_sealed"].asString)
        assertEquals("DDDD", o["wrapped_dek"].asString)
        assertEquals("save", o["permission"].asString)

        assertFalse("folder_id must be absent on a file share", o.has("folder_id"))
        assertFalse(o.has("keys"))
        assertFalse(o.has("folder_keys"))
    }

    @Test
    fun `folder share carries per-file keys and per-subfolder names`() {
        val body = CreateShareRequestV2(
            recipient_id = "u1",
            recipient_label = "AAAA",
            sharer_label = "BBBB",
            folder_id = "d1",
            meta_sealed = "CCCC",
            keys = listOf(ShareFileKey("f1", "DEK", "NAME")),
            folder_keys = listOf(ShareFolderName("d2", "SUBNAME")),
        )
        val o = json(body)
        assertEquals("d1", o["folder_id"].asString)
        assertFalse("file_id must be absent on a folder share", o.has("file_id"))

        val k = o["keys"].asJsonArray[0].asJsonObject
        assertEquals("f1", k["file_id"].asString)
        assertEquals("DEK", k["wrapped_dek"].asString)
        assertEquals("NAME", k["meta_sealed"].asString)

        val fk = o["folder_keys"].asJsonArray[0].asJsonObject
        assertEquals("d2", fk["folder_id"].asString)
        assertEquals("SUBNAME", fk["meta_sealed"].asString)
    }

    @Test
    fun `permission defaults to view`() {

        val o = json(CreateShareRequestV2(recipient_id = "u", recipient_label = "a", sharer_label = "b"))
        assertEquals("view", o["permission"].asString)
    }

    @Test
    fun `share rows parse from the server's column aliases`() {

        val wire = """
            {"shares":[{"id":"s1","recipient_id":"u1","recipient_label":"QUJD",
                        "expires_at":null,"permission":"view","created_at":"2026-07-28T00:00:00Z"}]}
        """.trimIndent()
        val parsed = gson.fromJson(wire, SharesResponseV2::class.java)
        val row = parsed.shares.single()
        assertEquals("s1", row.id)
        assertEquals("u1", row.recipient_id)
        assertEquals("QUJD", row.recipient_label)
        assertNull(row.expires_at)
        assertEquals("view", row.permission)
    }

    @Test
    fun `user search parses id and public key`() {
        val wire = """{"results":[{"id":"u1","public_key":"UEs=","handle_enc":null}]}"""
        val parsed = gson.fromJson(wire, UserSearchResponseV2::class.java)
        val hit = parsed.results.single()
        assertEquals("u1", hit.id)
        assertEquals("UEs=", hit.public_key)
    }

    @Test
    fun `contacts parse recipient id and sealed label`() {
        val wire = """{"contacts":[{"recipient_id":"u1","recipient_label":"QUJD"}]}"""
        val parsed = gson.fromJson(wire, ContactsResponse::class.java)
        assertEquals("u1", parsed.contacts.single().recipient_id)
        assertEquals("QUJD", parsed.contacts.single().recipient_label)
    }

    @Test
    fun `an unhydrated row reads as blank rather than throwing`() {

        val file = gson.fromJson("""{"id":"f1"}""", FileDto::class.java)
        assertEquals("", file.original_name)
        assertEquals(0, file.original_name.length)

        val folder = gson.fromJson("""{"id":"d1"}""", FolderDto::class.java)
        assertEquals("", folder.name)
    }

    @Test
    fun `incoming shared items expose sharer_label as a wire field`() {

        val wire = """
            {"files":[{"id":"f1","meta_sealed":"TkFNRQ==","sharer_label":"U0hBUkVS",
                       "permission":"save","created_at":"x"}]}
        """.trimIndent()
        val parsed = gson.fromJson(wire, SharedWithMeResponse::class.java)
        val f = parsed.files.single()
        assertEquals("U0hBUkVS", f.sharer_label)
        assertEquals("save", f.permission)

        assertNull(f.shared_by)
    }

    @Test
    fun `transient display fields never go out on the wire`() {

        val file = FileDto(id = "f1").apply {
            original_name = "secret-plans.pdf"
            shared_by = "alice@example.com"
        }
        val o = json(file)
        assertFalse("plaintext name must not be serialised", o.has("original_name"))
        assertFalse("plaintext sharer must not be serialised", o.has("shared_by"))

        assertFalse("backing field must not be serialised", o.has("originalNameOrNull"))

        val folder = FolderDto(id = "d1").apply {
            name = "Taxes"
            shared_by = "bob@example.com"
        }
        val fo = json(folder)
        assertFalse(fo.has("name"))
        assertFalse(fo.has("shared_by"))
        assertFalse(fo.has("nameOrNull"))
    }

    @Test
    fun `targeted bulk actions send exactly one of file_id or folder_id`() {
        val unshareFile = json(UnshareRequest(file_id = "f1"))
        assertTrue(unshareFile.has("file_id"))
        assertFalse(unshareFile.has("folder_id"))

        val leaveFolder = json(LeaveShareRequest(folder_id = "d1"))
        assertTrue(leaveFolder.has("folder_id"))
        assertFalse(leaveFolder.has("file_id"))
    }
}
