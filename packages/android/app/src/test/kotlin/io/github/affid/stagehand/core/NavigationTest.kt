package io.github.affid.stagehand.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NavigationTest {
    private val servers = listOf("http://10.0.2.2:30000", "https://vtt.example.com/foundry")

    @Test
    fun `a server's game or players page becomes its join page, where our running page is`() {
        assertEquals("http://10.0.2.2:30000/join", runningInsteadOf("http://10.0.2.2:30000/game", servers))
        assertEquals("http://10.0.2.2:30000/join", runningInsteadOf("http://10.0.2.2:30000/players", servers))
        assertEquals(
            "https://vtt.example.com/foundry/join",
            runningInsteadOf("https://vtt.example.com/foundry/game?x=1", servers),
        )
    }

    @Test
    fun `other pages, other servers and look-alike paths stay as they are`() {
        assertNull(runningInsteadOf("http://10.0.2.2:30000/join", servers))
        assertNull(runningInsteadOf("http://10.0.2.2:30000/setup", servers))
        assertNull(runningInsteadOf("http://10.0.2.2:30000/gamers", servers))
        assertNull(runningInsteadOf("http://other:30000/game", servers))
        assertNull(runningInsteadOf("https://vtt.example.com/game", servers))
        assertNull(runningInsteadOf("not a url", servers))
    }

    @Test
    fun `a server's join page is the running page, its auth page our login`() {
        assertEquals(true, isRunningPage("http://10.0.2.2:30000/join", servers))
        assertEquals(false, isRunningPage("http://10.0.2.2:30000/joiner", servers))
        assertEquals(false, isRunningPage("http://other/join", servers))
        assertEquals("http://10.0.2.2:30000", loginServerOf("http://10.0.2.2:30000/auth", servers))
        assertEquals(
            "https://vtt.example.com/foundry",
            loginServerOf("https://vtt.example.com/foundry/auth?x", servers),
        )
        assertNull(loginServerOf("http://10.0.2.2:30000/setup", servers))
        assertNull(loginServerOf("http://other/auth", servers))
    }

    @Test
    fun `Foundry's dead end after a lost connection is known by its server`() {
        assertEquals("http://10.0.2.2:30000", lostServerOf("http://10.0.2.2:30000/no", servers))
        assertEquals("https://vtt.example.com/foundry", lostServerOf("https://vtt.example.com/foundry/no", servers))
        assertNull(lostServerOf("http://10.0.2.2:30000/notes", servers))
        assertNull(lostServerOf("http://10.0.2.2:30000/setup", servers))
        assertNull(lostServerOf("http://other:30000/no", servers))
    }

    @Test
    fun `a page that failed to load belongs to the saved server it is under`() {
        assertEquals("http://10.0.2.2:30000", serverOf("http://10.0.2.2:30000/setup?x=1", servers))
        assertEquals("http://10.0.2.2:30000", serverOf("http://10.0.2.2:30000", servers))
        assertEquals("https://vtt.example.com/foundry", serverOf("https://vtt.example.com/foundry/join", servers))
        assertNull(serverOf("http://other:30000/setup", servers))
        assertNull(serverOf("not a url", servers))
    }

    @Test
    fun `the longest saved server wins, and a page beside the route prefix goes to its origin's server`() {
        val nested = listOf("https://vtt.example.com", "https://vtt.example.com/foundry")
        assertEquals("https://vtt.example.com/foundry", serverOf("https://vtt.example.com/foundry/setup", nested))
        assertEquals("https://vtt.example.com", serverOf("https://vtt.example.com/foundry2/setup", nested))
        assertEquals("https://vtt.example.com/foundry", serverOf("https://vtt.example.com/elsewhere", servers))
    }

    @Test
    fun `a proxy's answer for a server that is down counts as unreachable, Foundry's own errors don't`() {
        listOf(502, 503, 504).forEach { assertEquals(true, gatewayDown(it)) }
        listOf(200, 302, 403, 404, 500).forEach { assertEquals(false, gatewayDown(it)) }
    }
}
