package dev.modulelibrary.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessageRulesTest {
    @Test
    fun `accepts main-frame messages from the committed page's origin`() {
        assertTrue(acceptMessage(true, "http://localhost:30000", "http://localhost:30000/setup"))
        assertTrue(acceptMessage(true, APP_ORIGIN, BACKGROUND_PAGE))
    }

    @Test
    fun `refuses frames, other origins and pages not yet committed`() {
        assertFalse(acceptMessage(false, "http://localhost:30000", "http://localhost:30000/setup"))
        assertFalse(acceptMessage(true, "http://evil:1", "http://localhost:30000/setup"))
        assertFalse(acceptMessage(true, "http://localhost:30000", null))
        assertFalse(acceptMessage(true, "null", "http://localhost:30000/setup"))
    }

    @Test
    fun `Back - the page first, then history, then home, then out`() {
        assertEquals(BackAction.NONE, backStep(Screen.SERVER, pageHandled = true, canGoBack = true))
        assertEquals(BackAction.HISTORY, backStep(Screen.SERVER, pageHandled = false, canGoBack = true))
        assertEquals(BackAction.HOME, backStep(Screen.SERVER, pageHandled = false, canGoBack = false))
        assertEquals(BackAction.EXIT, backStep(Screen.HOME, pageHandled = false, canGoBack = true))
    }

    @Test
    fun `server label for dialogs is the host and port`() {
        assertEquals("localhost:30000", serverLabel("http://localhost:30000/setup"))
        assertEquals("vtt.example.com", serverLabel("https://vtt.example.com/foundry/setup"))
        assertEquals("", serverLabel("about:blank"))
    }
}
