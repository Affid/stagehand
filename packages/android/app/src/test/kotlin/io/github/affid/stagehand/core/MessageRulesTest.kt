package io.github.affid.stagehand.core

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
    fun `Back - the page first, then history, then home`() {
        assertEquals(BackAction.NONE, backStep(Screen.SERVER, pageHandled = true, canGoBack = true, homeOverServer = true))
        assertEquals(BackAction.HISTORY, backStep(Screen.SERVER, pageHandled = false, canGoBack = true, homeOverServer = true))
        assertEquals(BackAction.HOME, backStep(Screen.SERVER, pageHandled = false, canGoBack = false, homeOverServer = true))
    }

    @Test
    fun `a second Back soon after goes on even if the page claims it`() {
        assertEquals(
            BackAction.HOME,
            backStep(Screen.SERVER, pageHandled = true, canGoBack = false, homeOverServer = false, pressedAgainSoon = true),
        )
        assertEquals(
            BackAction.HISTORY,
            backStep(Screen.SERVER, pageHandled = true, canGoBack = true, homeOverServer = false, pressedAgainSoon = true),
        )
    }

    @Test
    fun `Back on home returns to the server it was opened over, else leaves`() {
        assertEquals(BackAction.SERVER, backStep(Screen.HOME, pageHandled = false, canGoBack = true, homeOverServer = true))
        assertEquals(BackAction.EXIT, backStep(Screen.HOME, pageHandled = false, canGoBack = false, homeOverServer = false))
    }

    @Test
    fun `Back on home closes its open sheet first, even pressed again soon`() {
        assertEquals(BackAction.NONE, backStep(Screen.HOME, pageHandled = true, canGoBack = false, homeOverServer = true))
        assertEquals(
            BackAction.NONE,
            backStep(Screen.HOME, pageHandled = true, canGoBack = false, homeOverServer = false, pressedAgainSoon = true),
        )
    }

    @Test
    fun `history goes back only to the same server's own pages, never its login`() {
        val s = listOf("http://localhost:30000")
        assertTrue(historyBackAllowed("http://localhost:30000/setup", s))
        assertTrue(historyBackAllowed("http://localhost:30000/join", s))
        assertFalse(historyBackAllowed("http://localhost:30000/auth", s))
        assertFalse(historyBackAllowed("http://localhost:30000/auth?x=1", s))
        assertFalse(historyBackAllowed("http://other:1/setup", s))
        assertFalse(historyBackAllowed(null, s))
    }

    @Test
    fun `server label for dialogs is the host and port`() {
        assertEquals("localhost:30000", serverLabel("http://localhost:30000/setup"))
        assertEquals("vtt.example.com", serverLabel("https://vtt.example.com/foundry/setup"))
        assertEquals("", serverLabel("about:blank"))
    }
}
