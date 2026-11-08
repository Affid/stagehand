package dev.modulelibrary.app.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WireTest {
    @Test
    fun `reads a request`() {
        val m = Wire.parse("""{"v":1,"id":"a1","type":"kv.get","payload":{"key":"k"}}""")
        assertEquals(WireRequest("a1", "kv.get", buildJsonObject { put("key", "k") }), m)
    }

    @Test
    fun `reads a request without a payload`() {
        assertEquals(WireRequest("a", "home.open", null), Wire.parse("""{"v":1,"id":"a","type":"home.open"}"""))
    }

    @Test
    fun `reads replies, ok and not`() {
        assertEquals(WireReply("x", true, JsonPrimitive(3), null), Wire.parse("""{"v":1,"re":"x","ok":true,"result":3}"""))
        assertEquals(WireReply("x", false, null, "no"), Wire.parse("""{"v":1,"re":"x","ok":false,"error":"no"}"""))
    }

    @Test
    fun `refuses what isn't the wire format`() {
        listOf(
            "", "nope", "[]", "1", "null",
            """{"v":2,"id":"a","type":"t"}""",
            """{"v":"1","id":"a","type":"t"}""",
            """{"id":"a","type":"t"}""",
            """{"v":1,"id":"","type":"t"}""",
            """{"v":1,"id":"a","type":""}""",
            """{"v":1,"id":1,"type":"t"}""",
            """{"v":1,"id":"${"a".repeat(65)}","type":"t"}""",
            """{"v":1,"id":"a","type":"${"t".repeat(65)}"}""",
            """{"v":1,"re":"x","ok":"yes"}""",
            """{"v":1,"re":"x","ok":false}""",
            """{"v":1,"re":7,"ok":true}""",
        ).forEach { assertNull(it, Wire.parse(it)) }
    }

    @Test
    fun `refuses a message over the cap`() {
        val big = """{"v":1,"id":"a","type":"t","payload":"${"x".repeat(MAX_MESSAGE_CHARS)}"}"""
        assertNull(Wire.parse(big))
    }

    @Test
    fun `writes requests and replies`() {
        val req = Json.parseToJsonElement(Wire.request("n1", ROUTE, JsonNull)).jsonObject
        assertEquals("""{"v":1,"id":"n1","type":"route","payload":null}""", req.toString())
        assertEquals("""{"v":1,"re":"a","ok":true,"result":null}""", Wire.ok("a", null))
        assertEquals("""{"v":1,"re":"a","ok":false,"error":"bad \"x\""}""", Wire.error("a", "bad \"x\""))
    }

    @Test
    fun `cuts long errors`() {
        val reply = Wire.parse(Wire.error("a", "e".repeat(5000))) as WireReply
        assertEquals(2000, reply.error!!.length)
    }
}
