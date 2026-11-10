package io.github.affid.stagehand.core

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class KeyValueStoreTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun `keeps values as written, numbers and all`() = runTest {
        val store = KeyValueStore(tmp.root)
        val value = Json.parseToJsonElement("""{"a":1.50,"b":[1e3,"é ",null],"c":12345678901234567890}""")
        store.set("library:http://localhost:30000", value)
        assertEquals(value.toString(), store.get("library:http://localhost:30000").toString())
    }

    @Test
    fun `survives a new store on the same folder`() = runTest {
        KeyValueStore(tmp.root).set("servers", Json.parseToJsonElement("[1]"))
        assertEquals("[1]", KeyValueStore(tmp.root).get("servers").toString())
    }

    @Test
    fun `unset keys read as nothing, null as null`() = runTest {
        val store = KeyValueStore(tmp.root)
        assertNull(store.get("missing"))
        store.set("n", JsonNull)
        assertEquals(JsonNull, store.get("n"))
    }

    @Test
    fun `keys with any characters stay apart`() = runTest {
        val store = KeyValueStore(tmp.root)
        store.set("a/../b", Json.parseToJsonElement("1"))
        store.set("a/..%2fb", Json.parseToJsonElement("2"))
        assertEquals("1", store.get("a/../b").toString())
        assertEquals("2", store.get("a/..%2fb").toString())
        assertEquals(2, tmp.root.resolve("kv").listFiles()!!.size)
    }

    @Test
    fun `a broken file reads as nothing`() = runTest {
        val store = KeyValueStore(tmp.root)
        store.set("k", Json.parseToJsonElement("1"))
        tmp.root.resolve("kv").listFiles()!!.single().writeText("{broken")
        assertNull(store.get("k"))
    }
}
