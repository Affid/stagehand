package dev.modulelibrary.app.core

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private const val SETUP = "http://localhost:30000/setup"
private const val JOIN = "http://localhost:30000/join"

@OptIn(ExperimentalCoroutinesApi::class)
class RelayTest {
    private class Harness(scope: TestScope) {
        val handled = mutableListOf<Triple<Caller, String, JsonObject>>()
        val toBackground = mutableListOf<String>()
        val replies = mutableListOf<String>()
        val relay = Relay(
            scope = scope.backgroundScope,
            serverAllowed = { it == SETUP },
            handle = { caller, type, payload, _ ->
                handled += Triple(caller, type, payload)
                JsonPrimitive("done")
            },
            routeTimeoutMs = 5_000,
            runningAllowed = { it == JOIN },
        )

        fun page(source: Caller, text: String, url: String = SETUP) =
            relay.fromPage(source, url, text) { replies += it }

        fun background(text: String) =
            relay.fromPage(Caller.BACKGROUND, BACKGROUND_PAGE, text) { toBackground += it }

        fun lastReply(): JsonObject = Json.parseToJsonElement(replies.last()).jsonObject
    }

    private fun req(id: String, type: String, payload: String = "{}") =
        """{"v":1,"id":"$id","type":"$type","payload":$payload}"""

    @Test
    fun `answers a background request through the handler`() = runTest {
        val h = Harness(this)
        h.background(req("b1", "kv.get", """{"key":"k"}"""))
        runCurrent()
        assertEquals(Triple(Caller.BACKGROUND, "kv.get", Json.parseToJsonElement("""{"key":"k"}""")), h.handled.single())
        assertEquals("""{"v":1,"re":"b1","ok":true,"result":"done"}""", h.toBackground.single())
    }

    @Test
    fun `refuses requests a page may not make`() = runTest {
        val h = Harness(this)
        h.page(Caller.SERVER, req("s1", "kv.get", """{"key":"k"}"""))
        h.page(Caller.HOME, req("h1", "fetch", """{"url":"x","purpose":"config"}"""))
        h.page(Caller.SERVER, req("s2", "confirm", """{"text":"?"}"""), url = "http://localhost:30000/join")
        runCurrent()
        assertTrue(h.handled.isEmpty())
        assertEquals(3, h.replies.size)
        h.replies.forEach { assertTrue(it, it.contains("\"ok\":false") && it.contains("isn't allowed")) }
    }

    @Test
    fun `our running page on join asks for a password and applying, nothing else, and Setup never asks for one`() = runTest {
        val h = Harness(this)
        val ask = """{"purpose":"close","world":"Strahd","people":0,"wrong":false}"""
        h.page(Caller.SERVER, req("r1", "password.ask", ask), url = JOIN)
        h.page(Caller.SERVER, req("r2", "apply.start", """{"world":"Strahd","changes":2}"""), url = JOIN)
        runCurrent()
        assertEquals(listOf(Caller.RUNNING to "password.ask", Caller.RUNNING to "apply.start"), h.handled.map { it.first to it.second })
        h.page(Caller.SERVER, req("r3", "runtime.send", """{"message":{}}"""), url = JOIN)
        h.page(Caller.SERVER, req("s1", "password.ask", ask))
        runCurrent()
        assertEquals(2, h.handled.size)
        assertTrue(h.replies.takeLast(2).all { it.contains("isn't allowed") })
    }

    @Test
    fun `refuses a bad payload`() = runTest {
        val h = Harness(this)
        h.page(Caller.SERVER, req("s1", "confirm", """{"text":""}"""))
        runCurrent()
        assertEquals("Bad payload for confirm", h.lastReply()["error"]!!.jsonPrimitive.content)
    }

    @Test
    fun `drops what isn't the wire format`() = runTest {
        val h = Harness(this)
        h.page(Caller.SERVER, "nope")
        h.page(Caller.SERVER, """{"v":2,"id":"a","type":"confirm"}""")
        runCurrent()
        assertTrue(h.replies.isEmpty())
    }

    @Test
    fun `holds runtime messages until the background is ready, with the sender`() = runTest {
        val h = Harness(this)
        h.page(Caller.SERVER, req("s1", "runtime.send", """{"message":{"type":"GET_STATE"}}"""))
        runCurrent()
        assertTrue(h.toBackground.isEmpty())
        h.background(req("b1", READY))
        runCurrent()
        val route = Json.parseToJsonElement(h.toBackground.last()).jsonObject
        assertEquals(ROUTE, route["type"]!!.jsonPrimitive.content)
        assertEquals(
            Json.parseToJsonElement(
                """{"message":{"type":"GET_STATE"},"sender":{"id":"$APP_ID","url":"$SETUP","fromTab":true}}""",
            ),
            route["payload"],
        )
        val id = route["id"]!!.jsonPrimitive.content
        h.background("""{"v":1,"re":"$id","ok":true,"result":{"state":1}}""")
        runCurrent()
        assertEquals("""{"v":1,"re":"s1","ok":true,"result":{"state":1}}""", h.replies.single())
    }

    @Test
    fun `home messages go with fromTab false`() = runTest {
        val h = Harness(this)
        h.background(req("b1", READY))
        h.page(Caller.HOME, req("h1", "runtime.send", """{"message":1}"""), url = HOME_PAGE)
        runCurrent()
        val sender = Json.parseToJsonElement(h.toBackground.last()).jsonObject["payload"]!!.jsonObject["sender"]
        assertEquals(Json.parseToJsonElement("""{"id":"$APP_ID","url":"$HOME_PAGE","fromTab":false}"""), sender)
    }

    @Test
    fun `passes on the background's error`() = runTest {
        val h = Harness(this)
        h.background(req("b1", READY))
        h.page(Caller.SERVER, req("s1", "runtime.send", """{"message":1}"""))
        runCurrent()
        val id = Json.parseToJsonElement(h.toBackground.last()).jsonObject["id"]!!.jsonPrimitive.content
        h.background("""{"v":1,"re":"$id","ok":false,"error":"Not admin"}""")
        runCurrent()
        assertEquals("Not admin", h.lastReply()["error"]!!.jsonPrimitive.content)
    }

    @Test
    fun `replies count only from the page asked`() = runTest {
        val h = Harness(this)
        h.background(req("b1", READY))
        h.page(Caller.SERVER, req("s1", "runtime.send", """{"message":1}"""))
        runCurrent()
        val id = Json.parseToJsonElement(h.toBackground.last()).jsonObject["id"]!!.jsonPrimitive.content
        h.page(Caller.SERVER, """{"v":1,"re":"$id","ok":true,"result":"forged"}""")
        h.page(Caller.HOME, """{"v":1,"re":"$id","ok":true,"result":"forged"}""", url = HOME_PAGE)
        runCurrent()
        assertTrue(h.replies.isEmpty())
    }

    @Test
    fun `times out a route the background never answers`() = runTest {
        val h = Harness(this)
        h.background(req("b1", READY))
        h.page(Caller.SERVER, req("s1", "runtime.send", """{"message":1}"""))
        advanceTimeBy(5_001)
        runCurrent()
        assertTrue(h.lastReply()["error"]!!.jsonPrimitive.content.contains("did not answer"))
    }

    @Test
    fun `a reloading background fails its routes and must say ready again`() = runTest {
        val h = Harness(this)
        h.background(req("b1", READY))
        h.page(Caller.SERVER, req("s1", "runtime.send", """{"message":1}"""))
        runCurrent()
        h.relay.backgroundReloading()
        runCurrent()
        assertTrue(h.lastReply()["error"]!!.jsonPrimitive.content.contains("reloaded"))
        val before = h.toBackground.size
        h.page(Caller.SERVER, req("s2", "runtime.send", """{"message":2}"""))
        runCurrent()
        assertEquals(before, h.toBackground.size)
        h.background(req("b2", READY))
        runCurrent()
        assertTrue(h.toBackground.last().contains("\"message\":2"))
    }

    @Test
    fun `asks a page and gets its answer`() = runTest {
        val h = Harness(this)
        val posted = mutableListOf<String>()
        var answer: JsonElement? = null
        backgroundScope.launchAsk(h.relay, posted) { answer = it }
        runCurrent()
        val id = Json.parseToJsonElement(posted.single()).jsonObject["id"]!!.jsonPrimitive.content
        h.page(Caller.SERVER, """{"v":1,"re":"$id","ok":true,"result":{"handled":true}}""")
        runCurrent()
        assertEquals(Json.parseToJsonElement("""{"handled":true}"""), answer)
    }

    @Test
    fun `a handler's failure is the page's error`() = runTest {
        val relay = Relay(backgroundScope, { true }, { _, _, _, _ -> throw IllegalArgumentException("disk full") })
        val replies = mutableListOf<String>()
        relay.fromPage(Caller.BACKGROUND, BACKGROUND_PAGE, req("b1", "kv.get", """{"key":"k"}""")) { replies += it }
        runCurrent()
        assertEquals("""{"v":1,"re":"b1","ok":false,"error":"disk full"}""", replies.single())
    }

    @Test
    fun `a handler that times out still answers the page`() = runTest {
        val relay = Relay(backgroundScope, { true }, { _, _, _, _ ->
            kotlinx.coroutines.withTimeout(1) { kotlinx.coroutines.delay(100) }
            null
        })
        val replies = mutableListOf<String>()
        relay.fromPage(Caller.BACKGROUND, BACKGROUND_PAGE, req("b1", "kv.get", """{"key":"k"}""")) { replies += it }
        advanceTimeBy(200)
        runCurrent()
        assertEquals("""{"v":1,"re":"b1","ok":false,"error":"Native failed"}""", replies.single())
    }

    @Test
    fun `unexpected failures reach the page as a plain message, details to the log`() = runTest {
        val logged = mutableListOf<Throwable>()
        val relay = Relay(
            backgroundScope, { true },
            { _, _, _, _ -> throw java.io.IOException("Can't make /data/user/0/secret") },
            log = { _, e -> logged += e },
        )
        val replies = mutableListOf<String>()
        relay.fromPage(Caller.BACKGROUND, BACKGROUND_PAGE, req("b1", "kv.get", """{"key":"k"}""")) { replies += it }
        runCurrent()
        assertEquals("""{"v":1,"re":"b1","ok":false,"error":"Native failed"}""", replies.single())
        assertEquals(1, logged.size)
    }

    @Test
    fun `a page can't keep too many requests waiting`() = runTest {
        val h = Harness(this)
        repeat(MAX_IN_FLIGHT + 5) { h.page(Caller.SERVER, req("s$it", "runtime.send", """{"message":$it}""")) }
        h.background(req("b1", READY))
        runCurrent()
        assertEquals(1 + MAX_IN_FLIGHT, h.toBackground.size)
    }

    @Test
    fun `a server page that may not ask can't answer native either`() = runTest {
        val h = Harness(this)
        val posted = mutableListOf<String>()
        var answer: JsonElement? = null
        backgroundScope.launchAsk(h.relay, posted) { answer = it }
        runCurrent()
        val id = Json.parseToJsonElement(posted.single()).jsonObject["id"]!!.jsonPrimitive.content
        h.page(Caller.SERVER, """{"v":1,"re":"$id","ok":true,"result":1}""", url = "http://localhost:30000/join")
        runCurrent()
        assertEquals(null, answer)
        h.page(Caller.SERVER, """{"v":1,"re":"$id","ok":true,"result":2}""")
        runCurrent()
        assertEquals(JsonPrimitive(2), answer)
    }

    @Test
    fun `a reply that can't be delivered doesn't break the relay`() = runTest {
        val h = Harness(this)
        h.relay.fromPage(Caller.BACKGROUND, BACKGROUND_PAGE, req("b1", "kv.get", """{"key":"k"}""")) {
            error("WebView gone")
        }
        runCurrent()
        h.background(req("b2", "kv.get", """{"key":"k"}"""))
        runCurrent()
        assertEquals(1, h.toBackground.size)
    }
}

private fun kotlinx.coroutines.CoroutineScope.launchAsk(
    relay: Relay,
    posted: MutableList<String>,
    done: (JsonElement?) -> Unit,
) = launch {
    done(relay.ask(Caller.SERVER, { posted += it }, "back", JsonObject(emptyMap()), 1_000))
}
