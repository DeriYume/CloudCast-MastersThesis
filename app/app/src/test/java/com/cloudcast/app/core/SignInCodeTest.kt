package com.cloudcast.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SignInCodeTest {

    @Test
    fun stripsGroupingAndUpperCases() {
        assertEquals("XK4M9PTW", SignInCode.normalize("xk4m-9ptw"))
        assertEquals("XK4M9PTW", SignInCode.normalize("XK4M 9PTW"))
        assertEquals("XK4M9PTW", SignInCode.normalize("  XK4M-9PTW  "))
    }

    @Test
    fun doesNotSubstituteLookalikeCharacters() {

        assertEquals("I", SignInCode.normalize("I"))
        assertEquals("L", SignInCode.normalize("l"))
        assertEquals("O", SignInCode.normalize("O"))

        assertTrue(SignInCode.normalize("XK4M9OTW") != SignInCode.normalize("XK4M90TW"))
    }

    @Test
    fun normalizeIsIdempotentOnAnIssuedCode() {

        val issued = "XK4M9PTW"
        assertEquals(issued, SignInCode.normalize(issued))
        assertEquals(issued, SignInCode.normalize(SignInCode.format(issued)))
    }

    @Test
    fun emptyInputNormalizesToNull() {
        assertEquals(null, SignInCode.normalize(""))
        assertEquals(null, SignInCode.normalize("---"))
        assertEquals(null, SignInCode.normalize("   "))
    }

    @Test
    fun formatsAsTwoGroupsOfFour() {
        assertEquals("XK4M-9PTW", SignInCode.format("XK4M9PTW"))
    }

    @Test
    fun formatAsTypedBuildsUpProgressively() {
        assertEquals("X", SignInCode.formatAsTyped("x"))
        assertEquals("XK4M", SignInCode.formatAsTyped("xk4m"))

        assertEquals("XK4M-9", SignInCode.formatAsTyped("xk4m9"))
        assertEquals("XK4M-9PTW", SignInCode.formatAsTyped("xk4m9ptw"))
    }

    @Test
    fun formatAsTypedCapsAtCodeLength() {

        assertEquals("XK4M-9PTW", SignInCode.formatAsTyped("XK4M9PTWZZZZ"))
    }

    @Test
    fun formatAsTypedRejectsCharactersOutsideTheAlphabet() {

        assertEquals("XK4M-9PT", SignInCode.formatAsTyped("XK4M9PTU"))
        assertEquals("XK4M-9TW", SignInCode.formatAsTyped("XK4M9OTW"))
        assertEquals("XK4M-9TW", SignInCode.formatAsTyped("XK4M9ITW"))
    }

    @Test
    fun completenessGatesOnLengthAndAlphabet() {
        assertTrue(SignInCode.isComplete("XK4M9PTW"))
        assertFalse("a half-typed code is not complete", SignInCode.isComplete("XK4M9"))
        assertFalse("nine characters is not a code", SignInCode.isComplete("XK4M9PTWZ"))

        assertFalse("U is not in the alphabet", SignInCode.isComplete("XK4M9PTU"))
        assertFalse("O is not in the alphabet", SignInCode.isComplete("XK4M9PTO"))
        assertFalse("I is not in the alphabet", SignInCode.isComplete("XK4M9PTI"))
        assertFalse("L is not in the alphabet", SignInCode.isComplete("XK4M9PTL"))
    }

    @Test
    fun aMisreadCodeIsRejectedRatherThanRescued() {

        val issued = "XK4M90TW"
        assertTrue(SignInCode.normalize("xk4m-9Otw") != issued)
        assertFalse(SignInCode.isComplete(SignInCode.normalize("xk4m-9Otw")!!))
    }

    @Test
    fun caseAndGroupingAreFormattingNotContent() {
        val issued = "XK4M9PTW"
        for (typed in listOf("XK4M9PTW", "xk4m9ptw", "XK4M-9PTW", "xk4m-9ptw", " XK4M 9PTW ")) {
            assertEquals("\"$typed\" is the same code", issued, SignInCode.normalize(typed))
        }
    }

    @Test
    fun displayIsAlwaysUpperCaseWhateverWasTyped() {

        for (typed in listOf("xk4m9ptw", "Xk4M9pTw", "xk4m-9ptw")) {
            assertEquals("XK4M-9PTW", SignInCode.formatAsTyped(typed))
        }
    }

    @Test
    fun caseFoldingDoesNotResurrectLookalikes() {

        assertEquals("O", SignInCode.normalize("o"))
        assertTrue(SignInCode.normalize("o") != SignInCode.normalize("0"))
        assertTrue(SignInCode.normalize("i") != SignInCode.normalize("1"))
    }
}
