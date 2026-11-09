package dev.modulelibrary.app.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

private const val LINK_GAP_MS = 1_000L

/** Home keeps names this short (MAX_SERVER_NAME). */
private const val MAX_NAME = 80

/** A wrong password's retry comes from the page, not a tap: allowed this long after an answer. */
private const val PASSWORD_RETRY_MS = 10_000L

/**
 * Native's answers to the pages' requests (native-api.ts), after the relay
 * has checked who asked and the payload: storage, saved servers and their
 * scripts, Release history, NativeFetch, files, dialogs, links, home.
 */
class NativeHandlers(
    private val store: KeyValueStore,
    private val stateFile: File,
    private val fetcher: Fetcher,
    /** server.check's reads: NativeFetch with STATUS_TIMEOUT_MS and STATUS_MAX_CHARS. */
    private val statusFetcher: Fetcher,
    private val scripts: ScriptHost,
    private val ui: NativeUi,
    /** A clock that never runs back (SystemClock.elapsedRealtime on Android). */
    private val clock: () -> Long = { System.nanoTime() / 1_000_000 },
    private val io: CoroutineDispatcher = Dispatchers.IO,
    /**
     * Whether the user touched the server page a moment ago: a message
     * carries no tap, native's touch listener does (plan, "Native rules").
     */
    private val tappedLately: () -> Boolean = { false },
) {
    /** Read by the WebView wiring; changed on the main thread only. */
    @Volatile
    var state: NativeState = NativeState.load(stateFile)
        private set
    private var confirming = false
    private var askingPassword = false
    /** When a typed password was last handed to a page: one retry may follow it (security review). */
    private var retryUntil = Long.MIN_VALUE / 2
    private var lastLinkAt = Long.MIN_VALUE / 2

    private suspend fun change(next: NativeState, scriptsChanged: Boolean) {
        withContext(io) { next.save(stateFile) }
        state = next
        if (scriptsChanged) scripts.serversChanged(next)
    }

    /** The name home gave `server` (the background's "servers" record), for our login's title. */
    suspend fun serverName(server: String): String? {
        val record = store.get("servers") as? JsonObject ?: return null
        val name = ((record[server] as? JsonObject)?.get("name") as? JsonPrimitive)?.takeIf { it.isString }?.content
        return name?.trim()?.takeIf { it.isNotEmpty() }?.take(MAX_NAME)
    }

    /** The server the app shows now: it opens first next time. */
    suspend fun serverOpened(server: String) {
        if (state.lastServer != server) change(state.copy(lastServer = server), scriptsChanged = false)
    }

    suspend fun handle(type: String, payload: JsonObject, url: String): JsonElement? = when (type) {
        "kv.get" -> kvGet(payload.text("key"))
        "kv.set" -> {
            store.set(payload.text("key"), payload.getValue("value"))
            null
        }
        "scripts.registered" -> JsonArray(payload.ids().filter { it in state.scripts }.map(::JsonPrimitive))
        "scripts.register" -> register(payload.text("server"), payload.ids())
        "scripts.unregister" -> {
            change(state.copy(scripts = state.scripts - payload.ids().toSet()), true)
            null
        }
        "permissions.contains" -> JsonPrimitive(contains(payload.text("origin")))
        "permissions.request" -> JsonPrimitive(request(payload.text("origin")))
        "permissions.remove" -> JsonPrimitive(remove(payload.text("origin")))
        "fetch" -> fetch(payload.text("url"), payload.text("purpose"))
        "server.check" -> check(payload.text("server"))
        "home.open" -> {
            ui.showHome()
            null
        }
        // The file name is only the picker's suggestion: never a path here.
        "files.save" -> {
            ui.saveFile(payload.text("fileName"), payload.text("text"))
            null
        }
        "files.open" -> ui.openFile()?.let { t -> buildJsonObject { put("text", t) } } ?: JsonObject(emptyMap())
        "confirm" -> buildJsonObject { put("yes", confirm(payload.text("text"), url)) }
        "password.ask" -> askPassword(passwordAsk(payload), url)
            ?.let { pw -> buildJsonObject { put("password", pw) } } ?: JsonObject(emptyMap())
        "apply.start" -> {
            ui.applyStarted(originOf(url), payload.text("world"), payload.text("changes").toInt())
            null
        }
        "apply.done" -> {
            ui.applyDone(originOf(url), payload.text("ok").toBoolean())
            null
        }
        "openExternal" -> {
            openExternal(payload.text("url"))
            null
        }
        else -> throw RequestRefused("Native doesn't know $type")
    }

    private suspend fun kvGet(key: String): JsonElement =
        store.get(key)?.let { v -> buildJsonObject { put("value", v) } } ?: JsonObject(emptyMap())

    private suspend fun register(server: String, ids: List<String>): JsonElement? {
        val origin = WebUrl.parse(server)?.origin
        require(origin != null && origin in state.origins) { "Not a saved server" }
        change(state.copy(scripts = state.scripts + ids.associateWith { server }), true)
        return null
    }

    private fun contains(pattern: String): Boolean {
        if (pattern == FOUNDRY_PATTERN) return state.releaseHistory
        return savableServerOrigin(pattern)?.let { it in state.origins } ?: false
    }

    private suspend fun request(pattern: String): Boolean {
        if (pattern == FOUNDRY_PATTERN) {
            change(state.copy(releaseHistory = true), false)
            return true
        }
        val origin = requireNotNull(savableServerOrigin(pattern)) { "Not a server the app saves" }
        change(state.copy(origins = state.origins + origin), true)
        return true
    }

    /** A server's origin goes with its scripts: only saved origins get them. */
    private suspend fun remove(pattern: String): Boolean {
        if (pattern == FOUNDRY_PATTERN) {
            change(state.copy(releaseHistory = false), false)
            return true
        }
        val origin = savableServerOrigin(pattern) ?: return false
        if (origin !in state.origins) return false
        val kept = state.scripts.filterValues { WebUrl.parse(it)?.origin != origin }
        change(state.copy(origins = state.origins - origin, scripts = kept), true)
        return true
    }

    private suspend fun fetch(url: String, purposeName: String): JsonElement {
        val purpose = requireNotNull(FetchPurpose.of(purposeName)) { "Unknown purpose $purposeName" }
        require(fetchAllowed(url, purpose, state.releaseHistory)) { "Not an address the app reads" }
        val text = fetcher.fetch(url)
        return buildJsonObject { put("text", text) }
    }

    /** Only the version goes back to the page: nothing else the server said. */
    private suspend fun check(server: String): JsonElement {
        val url = requireNotNull(statusUrl(server)) { "Not a server the app saves" }
        val version = foundryVersion(statusFetcher.fetch(url)) ?: throw FetchFailed("Not a Foundry server")
        return buildJsonObject { put("version", version) }
    }

    /** One dialog at a time: a second while one is open is a no. */
    private suspend fun confirm(question: String, url: String): Boolean {
        if (confirming) return false
        confirming = true
        try {
            return ui.confirm(question, serverLabel(url))
        } finally {
            confirming = false
        }
    }

    /**
     * One at a time; on a tap on the page, or as the page's retry right after
     * an answer (a wrong password). Null when cancelled or already asking.
     */
    private suspend fun askPassword(ask: PasswordAsk, url: String): String? {
        if (askingPassword) return null
        // A retry only right after a password was typed and handed over, once;
        // a cancel gives none, so a page can't keep the sheet coming back.
        val retry = ask.wrong && clock() < retryUntil
        retryUntil = Long.MIN_VALUE / 2
        require(tappedLately() || retry) { "A password is asked on a tap" }
        askingPassword = true
        try {
            val answer = ui.askPassword(ask, originOf(url))
            if (answer != null) retryUntil = clock() + PASSWORD_RETRY_MS
            return answer
        } finally {
            askingPassword = false
        }
    }

    private fun openExternal(url: String) {
        require(externalAllowed(url, state.origins)) { "Not a link the app opens outside" }
        require(tappedLately()) { "Outside links open on a tap" }
        val now = clock()
        require(now - lastLinkAt >= LINK_GAP_MS) { "One link a second" }
        lastLinkAt = now
        ui.openExternal(url)
    }
}

private fun JsonObject.text(key: String): String = getValue(key).jsonPrimitive.content

private fun JsonObject.ids(): List<String> = getValue("ids").jsonArray.map { it.jsonPrimitive.content }

private fun passwordAsk(payload: JsonObject) = PasswordAsk(
    purpose = if (payload.text("purpose") == "join") PasswordPurpose.JOIN else PasswordPurpose.CLOSE,
    world = payload.text("world"),
    user = payload["user"]?.jsonPrimitive?.content,
    people = payload.getValue("people").jsonPrimitive.content.toInt(),
    wrong = payload.getValue("wrong").jsonPrimitive.content.toBoolean(),
)

private fun originOf(url: String): String = requireNotNull(WebUrl.parse(url)?.origin) { "No server" }
