package dev.modulelibrary.app.core

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

private const val SERVER = "http://localhost:30000"
private const val PATTERN = "http://localhost:30000/*"
private const val SETUP = "$SERVER/setup"

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class NativeHandlersTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private class FakeUi : NativeUi {
        val saved = mutableListOf<Pair<String, String>>()
        var toOpen: String? = null
        val questions = mutableListOf<Pair<String, String>>()
        var answer = CompletableDeferred(true)
        val links = mutableListOf<String>()
        var homes = 0
        override suspend fun saveFile(fileName: String, text: String) {
            saved += fileName to text
        }
        override suspend fun openFile(): String? = toOpen
        override suspend fun confirm(question: String, server: String): Boolean {
            questions += question to server
            return answer.await()
        }
        override fun openExternal(url: String) {
            links += url
        }
        override fun showHome() {
            homes++
        }
    }

    private class FakeHost : ScriptHost {
        val changes = mutableListOf<NativeState>()
        override fun serversChanged(state: NativeState) {
            changes += state
        }
    }

    private var now = 10_000L
    private var tapped = true
    private val ui = FakeUi()
    private val host = FakeHost()
    private val fetched = mutableListOf<String>()
    private val handlers by lazy {
        NativeHandlers(
            store = KeyValueStore(tmp.root),
            stateFile = tmp.root.resolve("native.json"),
            fetcher = Fetcher { url -> fetched += url; "body" },
            scripts = host,
            ui = ui,
            clock = { now },
            tappedLately = { tapped },
        )
    }

    private fun obj(text: String): JsonObject = Json.parseToJsonElement(text).jsonObject
    private suspend fun call(type: String, payload: String, url: String = BACKGROUND_PAGE): JsonElement? =
        handlers.handle(type, obj(payload), url)

    @Test
    fun `key-value - unset is an empty object, set values come back`() = runTest {
        assertEquals(obj("{}"), call("kv.get", """{"key":"k"}"""))
        call("kv.set", """{"key":"k","value":{"a":[1,2]}}""")
        assertEquals(obj("""{"value":{"a":[1,2]}}"""), call("kv.get", """{"key":"k"}"""))
    }

    @Test
    fun `adding a server saves its origin and tells the host`() = runTest {
        assertEquals(Json.parseToJsonElement("false"), call("permissions.contains", """{"origin":"$PATTERN"}"""))
        assertEquals(Json.parseToJsonElement("true"), call("permissions.request", """{"origin":"$PATTERN"}"""))
        assertEquals(Json.parseToJsonElement("true"), call("permissions.contains", """{"origin":"$PATTERN"}"""))
        assertEquals(setOf(SERVER), host.changes.last().origins)
        assertEquals(setOf(SERVER), NativeState.load(tmp.root.resolve("native.json")).origins)
    }

    @Test
    fun `never saves the app's origin or foundryvtt as a server`() = runTest {
        assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking { call("permissions.request", """{"origin":"https://appassets.androidplatform.net/*"}""") }
        }
        assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking { call("permissions.request", """{"origin":"https://www.foundryvtt.com/*"}""") }
        }
    }

    @Test
    fun `Release history is its own switch`() = runTest {
        assertEquals(Json.parseToJsonElement("false"), call("permissions.contains", """{"origin":"$FOUNDRY_PATTERN"}"""))
        call("permissions.request", """{"origin":"$FOUNDRY_PATTERN"}""")
        assertTrue(handlers.state.releaseHistory)
        call("permissions.remove", """{"origin":"$FOUNDRY_PATTERN"}""")
        assertFalse(handlers.state.releaseHistory)
    }

    @Test
    fun `scripts only for a saved origin, remembered by id`() = runTest {
        val err = runCatching { call("scripts.register", """{"server":"$SERVER","ids":["a"]}""") }
        assertTrue(err.isFailure)
        call("permissions.request", """{"origin":"$PATTERN"}""")
        call("scripts.register", """{"server":"$SERVER","ids":["a","b"]}""")
        assertEquals(Json.parseToJsonElement("""["a"]"""), call("scripts.registered", """{"ids":["a","z"]}"""))
        assertEquals(setOf(SERVER), host.changes.last().activeServers())
        call("scripts.unregister", """{"ids":["a","b"]}""")
        assertEquals(emptySet<String>(), host.changes.last().activeServers())
    }

    @Test
    fun `removing a server's origin drops its scripts`() = runTest {
        call("permissions.request", """{"origin":"$PATTERN"}""")
        call("scripts.register", """{"server":"$SERVER","ids":["a"]}""")
        assertEquals(Json.parseToJsonElement("true"), call("permissions.remove", """{"origin":"$PATTERN"}"""))
        assertEquals(emptyMap<String, String>(), handlers.state.scripts)
        assertEquals(Json.parseToJsonElement("false"), call("permissions.remove", """{"origin":"$PATTERN"}"""))
    }

    @Test
    fun `fetch follows the rule and Release history`() = runTest {
        assertEquals(obj("""{"text":"body"}"""), call("fetch", """{"url":"$REMOTE_CONFIG_URL","purpose":"config"}"""))
        assertTrue(runCatching { call("fetch", """{"url":"${RELEASES_URL}14.370","purpose":"release"}""") }.isFailure)
        call("permissions.request", """{"origin":"$FOUNDRY_PATTERN"}""")
        call("fetch", """{"url":"${RELEASES_URL}14.370","purpose":"release"}""")
        assertEquals(listOf(REMOTE_CONFIG_URL, "${RELEASES_URL}14.370"), fetched)
    }

    @Test
    fun `files go through the picker`() = runTest {
        assertNull(call("files.save", """{"fileName":"lib.json","text":"{}"}""", SETUP))
        assertEquals(listOf("lib.json" to "{}"), ui.saved)
        assertEquals(obj("{}"), call("files.open", "{}", SETUP))
        ui.toOpen = "[1]"
        assertEquals(obj("""{"text":"[1]"}"""), call("files.open", "{}", SETUP))
    }

    @Test
    fun `one confirm at a time, with the server's name`() = runTest {
        ui.answer = CompletableDeferred()
        val first = async { call("confirm", """{"text":"Delete?"}""", SETUP) }
        runCurrent()
        assertEquals(obj("""{"yes":false}"""), call("confirm", """{"text":"Again?"}""", SETUP))
        ui.answer.complete(true)
        assertEquals(obj("""{"yes":true}"""), first.await())
        assertEquals(listOf("Delete?" to "localhost:30000"), ui.questions)
    }

    @Test
    fun `outside links - the rule, and at most one a second`() = runTest {
        call("permissions.request", """{"origin":"$PATTERN"}""")
        assertTrue(runCatching { call("openExternal", """{"url":"$SERVER/x"}""", SETUP) }.isFailure)
        assertTrue(runCatching { call("openExternal", """{"url":"javascript:1"}""", SETUP) }.isFailure)
        call("openExternal", """{"url":"https://foundryvtt.com/"}""", SETUP)
        now += 500
        assertTrue(runCatching { call("openExternal", """{"url":"https://example.com/"}""", SETUP) }.isFailure)
        now += 600
        call("openExternal", """{"url":"https://example.com/"}""", SETUP)
        assertEquals(listOf("https://foundryvtt.com/", "https://example.com/"), ui.links)
    }

    @Test
    fun `outside links need a recent tap on the page`() = runTest {
        tapped = false
        assertTrue(runCatching { call("openExternal", """{"url":"https://example.com/"}""", SETUP) }.isFailure)
        tapped = true
        call("openExternal", """{"url":"https://example.com/"}""", SETUP)
        assertEquals(listOf("https://example.com/"), ui.links)
    }

    @Test
    fun `home opens the home screen`() = runTest {
        call("home.open", "{}")
        assertEquals(1, ui.homes)
    }

    @Test
    fun `remembers the last server opened`() = runTest {
        handlers.serverOpened(SERVER)
        assertEquals(SERVER, NativeState.load(tmp.root.resolve("native.json")).lastServer)
    }
}
