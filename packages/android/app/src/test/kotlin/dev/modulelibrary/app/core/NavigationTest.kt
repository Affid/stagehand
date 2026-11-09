package dev.modulelibrary.app.core

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
}
