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

/**
 * Native's answers to the pages' requests (native-api.ts), after the relay
 * has checked who asked and the payload: storage, saved servers and their
 * scripts, Release history, NativeFetch, files, dialogs, links, home.
 */
class NativeHandlers(
    private val store: KeyValueStore,
    private val stateFile: File,
    private val fetcher: Fetcher,
    private val scripts: ScriptHost,
    private val ui: NativeUi,
    /** A clock that never runs back (SystemClock.elapsedRealtime on Android). */
    private val clock: () -> Long = { System.nanoTime() / 1_000_000 },
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    /** Read by the WebView wiring; changed on the main thread only. */
    @Volatile
    var state: NativeState = NativeState.load(stateFile)
        private set
    private var confirming = false
    private var lastLinkAt = Long.MIN_VALUE / 2

    private suspend fun change(next: NativeState, scriptsChanged: Boolean) {
        withContext(io) { next.save(stateFile) }
        state = next
        if (scriptsChanged) scripts.serversChanged(next)
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

    private fun openExternal(url: String) {
        require(externalAllowed(url, state.origins)) { "Not a link the app opens outside" }
        val now = clock()
        require(now - lastLinkAt >= LINK_GAP_MS) { "One link a second" }
        lastLinkAt = now
        ui.openExternal(url)
    }
}

private fun JsonObject.text(key: String): String = getValue(key).jsonPrimitive.content

private fun JsonObject.ids(): List<String> = getValue("ids").jsonArray.map { it.jsonPrimitive.content }
