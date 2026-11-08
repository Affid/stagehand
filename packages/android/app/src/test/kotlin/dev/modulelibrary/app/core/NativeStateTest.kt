package dev.modulelibrary.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class NativeStateTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private val file get() = tmp.root.resolve("native.json")

    @Test
    fun `starts empty`() {
        val s = NativeState.load(file)
        assertEquals(emptySet<String>(), s.origins)
        assertEquals(emptyMap<String, String>(), s.scripts)
        assertFalse(s.releaseHistory)
        assertEquals(null, s.lastServer)
    }

    @Test
    fun `saves and loads every field`() {
        val s = NativeState(
            origins = setOf("http://localhost:30000"),
            scripts = mapOf("ml-a" to "http://localhost:30000"),
            releaseHistory = true,
            lastServer = "http://localhost:30000",
        )
        s.save(file)
        assertEquals(s, NativeState.load(file))
    }

    @Test
    fun `a broken file starts empty`() {
        file.writeText("{nope")
        assertEquals(NativeState(), NativeState.load(file))
        file.writeText("""{"origins":[1],"scripts":{"a":2},"releaseHistory":"x"}""")
        assertEquals(NativeState(), NativeState.load(file))
        file.writeText("""{"origins":[]}""")
        assertEquals(NativeState(), NativeState.load(file))
    }

    @Test
    fun `servers with scripts on saved origins`() {
        val s = NativeState(
            origins = setOf("http://localhost:30000"),
            scripts = mapOf(
                "a" to "http://localhost:30000",
                "b" to "http://localhost:30000",
                "c" to "http://other:1",
            ),
        )
        assertEquals(setOf("http://localhost:30000"), s.activeServers())
        assertTrue(s.copy(origins = s.origins + "http://other:1").activeServers().contains("http://other:1"))
    }
}
