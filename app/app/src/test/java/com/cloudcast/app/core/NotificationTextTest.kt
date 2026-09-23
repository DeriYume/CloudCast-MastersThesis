package com.cloudcast.app.core

import com.cloudcast.app.data.network.NotificationDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationTextTest {

    private fun n(type: String, fileId: String? = null, folderId: String? = null) =
        NotificationDto(
            id = "n1",
            type = type,
            file_id = fileId,
            folder_id = folderId,
            created_at = "2026-07-29T10:00:00.000Z",
        )

    @Test
    fun everyContractTypeGetsRealProse() {

        for (type in listOf("share", "unshare", "expiring", "expired", "owner_leaving")) {
            val message = notificationMessage(n(type, fileId = "f1"))
            assertFalse("$type leaked the raw enum", message == type)
            assertTrue("$type should read as a sentence", message.endsWith("."))
        }
    }

    @Test
    fun distinguishesFilesFromFolders() {
        assertEquals("A file was shared with you.", notificationMessage(n("share", fileId = "f1")))
        assertEquals("A folder was shared with you.", notificationMessage(n("share", folderId = "d1")))
    }

    @Test
    fun ownerLeavingTellsTheUserWhatToDo() {

        assertTrue(notificationMessage(n("owner_leaving", fileId = "f1")).contains("save"))
        assertTrue(notificationMessage(n("owner_leaving", folderId = "d1")).contains("save"))
    }

    @Test
    fun unknownTypesFallBackWithoutLeakingTheEnum() {

        val message = notificationMessage(n("some_future_type", fileId = "f1"))
        assertFalse(message.contains("some_future_type"))
        assertEquals("You have a new notification.", message)
    }

    @Test
    fun namesNeverAppear() {

        val message = notificationMessage(n("share", fileId = "invoice-2026.pdf"))
        assertFalse("a file id must never reach the message", message.contains("invoice"))
    }
}
