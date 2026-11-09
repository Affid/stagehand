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
        val asks = mutableListOf<Pair<PasswordAsk, String>>()
        var password = CompletableDeferred<String?>("pw")
        val applies = mutableListOf<String>()
        override fun applyStarted(server: String, title: String, changes: Int) {
            applies += "start $server $title $changes"
        }
        override fun applyDone(server: String, ok: Boolean) {
            applies += "done $server $ok"
        }
        override suspend fun askPassword(ask: PasswordAsk, origin: String): String? {
            asks += ask to origin
            return password.await()
        }
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
    private val statusAsked = mutableListOf<String>()
    private var statusBody = """{"active":false,"version":"14.370","world":"secret"}"""
    private val handlers by lazy {
        NativeHandlers(
            store = KeyValueStore(tmp.root),
            stateFile = tmp.root.resolve("native.json"),
            fetcher = Fetcher { url -> fetched += url; "body" },
            statusFetcher = Fetcher { url -> statusAsked += url; statusBody },
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
    fun `a server check answers only Foundry's version, for any address`() = runTest {
        assertEquals(obj("""{"version":"14.370"}"""), call("server.check", """{"server":"http://10.0.2.2:30000/vtt"}""", HOME_PAGE))
        assertEquals(listOf("http://10.0.2.2:30000/vtt/api/status"), statusAsked)
        assertEquals(emptyList<String>(), fetched)
    }

    @Test
    fun `a server check refuses what isn't Foundry, and never reads foundryvtt`() = runTest {
        statusBody = "<html>router login</html>"
        val notFoundry = runCatching { call("server.check", """{"server":"$SERVER"}""", HOME_PAGE) }
        assertEquals("Not a Foundry server", notFoundry.exceptionOrNull()?.message)
        val ours = runCatching { call("server.check", """{"server":"https://foundryvtt.com"}""", HOME_PAGE) }
        assertTrue(ours.exceptionOrNull() is IllegalArgumentException)
        assertEquals(listOf("$SERVER/api/status"), statusAsked)
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
    fun `a server's name as home saved it, for our login`() = runTest {
        assertNull(handlers.serverName(SERVER))
        call("kv.set", """{"key":"servers","value":{"$SERVER":{"id":"$SERVER","name":"Home server"},"x":{"name":7}}}""")
        assertEquals("Home server", handlers.serverName(SERVER))
        assertNull(handlers.serverName("x"))
        call("kv.set", """{"key":"servers","value":[1]}""")
        assertNull(handlers.serverName(SERVER))
    }

    @Test
    fun `a password, asked natively with the server's name, one at a time`() = runTest {
        ui.password = CompletableDeferred()
        val payload = """{"purpose":"close","world":"Strahd","people":2,"wrong":false}"""
        val first = async { call("password.ask", payload, "$SERVER/join") }
        runCurrent()
        assertEquals(obj("{}"), call("password.ask", payload, "$SERVER/join"))
        ui.password.complete("secret")
        assertEquals(obj("""{"password":"secret"}"""), first.await())
        assertEquals(
            listOf(PasswordAsk(PasswordPurpose.CLOSE, "Strahd", null, 2, false) to SERVER),
            ui.asks,
        )
    }

    @Test
    fun `applying out of sight needs the launch our Setup recorded, used once (security review)`() = runTest {
        call("permissions.request", """{"origin":"$PATTERN"}""")
        call("scripts.register", """{"server":"$SERVER","ids":["x"]}""")
        val allowed = """{"world":"w1"}"""
        assertEquals(obj("""{"allowed":false}"""), call("apply.allowed", allowed, "$SERVER/join"))
        assertTrue(runCatching { call("apply.start", """{"world":"w1","title":"Strahd","changes":2}""", "$SERVER/join") }.isFailure)
        call("launch.mark", """{"world":"w1","changes":2}""", SETUP)
        assertEquals(obj("""{"allowed":true}"""), call("apply.allowed", allowed, "$SERVER/join"))
        assertEquals(obj("""{"allowed":false}"""), call("apply.allowed", """{"world":"w2"}""", "$SERVER/join"))
        call("apply.start", """{"world":"w1","title":"Strahd","changes":2}""", "$SERVER/join")
        assertEquals(listOf("start $SERVER Strahd 2"), ui.applies)
        // Used up.
        assertEquals(obj("""{"allowed":false}"""), call("apply.allowed", allowed, "$SERVER/join"))
        call("apply.done", """{"ok":true}""", "$SERVER/game")
        assertEquals("done $SERVER true", ui.applies.last())
    }

    @Test
    fun `a launch is recorded only from Setup, and done only from the game page`() = runTest {
        call("permissions.request", """{"origin":"$PATTERN"}""")
        call("scripts.register", """{"server":"$SERVER","ids":["x"]}""")
        assertTrue(runCatching { call("launch.mark", """{"world":"w1","changes":2}""", "$SERVER/game") }.isFailure)
        assertTrue(runCatching { call("apply.done", """{"ok":true}""", SETUP) }.isFailure)
        call("launch.mark", """{"world":"w1","changes":2}""", SETUP)
        now += 11 * 60_000
        assertEquals(obj("""{"allowed":false}"""), call("apply.allowed", """{"world":"w1"}""", "$SERVER/join"))
    }

    @Test
    fun `a cancelled password answers nothing`() = runTest {
        ui.password = CompletableDeferred<String?>().apply { complete(null) }
        val payload = """{"purpose":"join","world":"Strahd","user":"Gamemaster","people":0,"wrong":false}"""
        assertEquals(obj("{}"), call("password.ask", payload, "$SERVER/join"))
        assertEquals("Gamemaster", ui.asks.single().first.user)
    }

    @Test
    fun `a password is asked on a tap, or as one retry just after a typed answer (security review)`() = runTest {
        val payload = """{"purpose":"close","world":"Strahd","people":0,"wrong":false}"""
        val retry = """{"purpose":"close","world":"Strahd","people":0,"wrong":true}"""
        tapped = false
        assertTrue(runCatching { call("password.ask", payload, "$SERVER/join") }.isFailure)
        tapped = true
        call("password.ask", payload, "$SERVER/join")
        tapped = false
        now += 5_000
        assertEquals(obj("""{"password":"pw"}"""), call("password.ask", retry, "$SERVER/join"))
        // A cancelled sheet gives no retry.
        ui.password = CompletableDeferred<String?>().apply { complete(null) }
        now += 1_000
        assertEquals(obj("{}"), call("password.ask", retry, "$SERVER/join"))
        assertTrue(runCatching { call("password.ask", retry, "$SERVER/join") }.isFailure)
    }

    @Test
    fun `a retry is good for a moment only`() = runTest {
        val payload = """{"purpose":"close","world":"Strahd","people":0,"wrong":false}"""
        val retry = """{"purpose":"close","world":"Strahd","people":0,"wrong":true}"""
        call("password.ask", payload, "$SERVER/join")
        tapped = false
        now += 11_000
        assertTrue(runCatching { call("password.ask", retry, "$SERVER/join") }.isFailure)
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
