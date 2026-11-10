package io.github.affid.stagehand.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UserInputTest {
    private fun rule() = TapRule(slopPx = 20f, maxPressMs = 500, windowMs = 1_000)

    @Test
    fun `a short still press is a tap, good once within the window`() {
        val r = rule()
        r.down(100f, 100f, 1_000, pointers = 1)
        r.up(105f, 103f, 1_150)
        assertTrue(r.take(1_500))
        assertFalse(r.take(1_600))
    }

    @Test
    fun `a tap goes stale`() {
        val r = rule()
        r.down(0f, 0f, 1_000, pointers = 1)
        r.up(0f, 0f, 1_100)
        assertFalse(r.take(2_200))
    }

    @Test
    fun `a scroll, a long press or two fingers are no tap`() {
        val r = rule()
        r.down(0f, 0f, 1_000, pointers = 1)
        r.up(0f, 80f, 1_100)
        assertFalse(r.take(1_200))
        r.down(0f, 0f, 2_000, pointers = 1)
        r.up(0f, 0f, 2_700)
        assertFalse(r.take(2_800))
        r.down(0f, 0f, 3_000, pointers = 2)
        r.up(0f, 0f, 3_100)
        assertFalse(r.take(3_200))
    }

    @Test
    fun `a second finger during the press spoils it`() {
        val r = rule()
        r.down(0f, 0f, 1_000, pointers = 1)
        r.morePointers()
        r.up(0f, 0f, 1_100)
        assertFalse(r.take(1_200))
    }

    @Test
    fun `an up without a down is no tap`() {
        val r = rule()
        r.up(0f, 0f, 1_100)
        assertFalse(r.take(1_200))
    }

    @Test
    fun `a page's question loses hidden characters and long gaps`() {
        assertEquals("Delete \"x\"?\n\nSure", plainQuestion("Delete ‮\"x\"​?\n\n\n\n\nSure\u0007"))
        assertEquals("a\tb", plainQuestion("a\tb"))
    }

    @Test
    fun `a long server name is cut in the middle`() {
        assertEquals("localhost:30000", shortLabel("localhost:30000"))
        val long = "a".repeat(70) + ".example.com:30000"
        val cut = shortLabel(long)
        assertEquals(LABEL_MAX, cut.length)
        assertTrue(cut.startsWith("aaaa") && cut.endsWith(":30000") && cut.contains("…"))
    }

    @Test
    fun `a suggested file name is tidied and ends in json`() {
        assertEquals("stagehand-2026-11-08.json", safeFileName("stagehand-2026-11-08.json"))
        assertEquals("invoice.pdf.json", safeFileName("invoice‮fdp.json".replace("‮fdp", ".pdf")))
        assertEquals("ab.json", safeFileName("a/b\u0000"))
        assertEquals("library.json", safeFileName("​‮"))
        assertEquals(100, safeFileName("x".repeat(300)).length)
    }
}
