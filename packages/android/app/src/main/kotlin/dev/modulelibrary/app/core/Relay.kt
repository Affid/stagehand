package dev.modulelibrary.app.core

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** A request native turned down (the page sees the message). */
class RequestRefused(message: String) : Exception(message)

/** A page's error answer to native's request, or no answer in time. */
class PageError(message: String) : Exception(message)

/** Native's handler for a checked request: its result, or it throws. */
typealias Handle = suspend (caller: Caller, type: String, payload: JsonObject, url: String) -> JsonElement?

/** Requests one page (server or home) may have waiting at once. */
const val MAX_IN_FLIGHT = 16
/** Characters the server and home pages may have waiting in all. */
const val MAX_IN_FLIGHT_CHARS = 16_000_000
/** Messages longer than this are read off the main thread. */
private const val PARSE_INLINE_CHARS = 64_000
/** What a page sees when native fails in a way it didn't foresee. */
const val NATIVE_FAILED = "Native failed"

/** Errors whose message is native's own and safe to show a page. */
private fun pageMessage(e: Exception): String? = when (e) {
    is RequestRefused, is PageError, is FetchFailed, is IllegalArgumentException -> e.message
    else -> null
}

private class Box(val value: JsonElement?)

/**
 * The bridge's switchboard (the app harness's relay.ts, in Kotlin): checks
 * every page message by the WebView it came from, runs native's requests,
 * carries runtime messages to the background as `route` with the sender
 * attached (held until the background says it is ready), and asks pages
 * questions of its own.
 *
 * Confined to one thread: `scope` must run on the main thread (WebView's
 * callbacks), and fromPage, ask and backgroundReloading are called there.
 * The server and home pages may have MAX_IN_FLIGHT requests and
 * MAX_IN_FLIGHT_CHARS waiting; more are dropped (security review). The
 * background is the app's own page and isn't limited.
 */
class Relay(
    private val scope: CoroutineScope,
    /** Whether a server page at this committed URL may make "server" requests. */
    private val serverAllowed: (String) -> Boolean,
    private val handle: Handle,
    private val routeTimeoutMs: Long = ROUTE_TIMEOUT_MS,
    private val parser: CoroutineDispatcher = Dispatchers.Default,
    private val log: (String, Throwable) -> Unit = { _, _ -> },
) {
    private class Pending(val target: Caller, val reply: CompletableDeferred<WireReply>)

    private var ready = CompletableDeferred<Unit>()
    private var backgroundPost: ((String) -> Unit)? = null
    private val pending = mutableMapOf<String, Pending>()
    private val inFlight = mutableMapOf<Caller, Int>()
    private var inFlightChars = 0L
    private var next = 0

    /**
     * A message from `source`'s WebView whose last committed page is `url`
     * (already checked by acceptMessage); `reply` answers that page.
     */
    fun fromPage(source: Caller, url: String, text: String, reply: (String) -> Unit) {
        if (source == Caller.BACKGROUND) backgroundPost = reply
        if (text.length > MAX_MESSAGE_CHARS) return
        val limited = source != Caller.BACKGROUND
        if (limited && !admit(source, text.length)) return
        scope.launch {
            try {
                val m = if (text.length > PARSE_INLINE_CHARS) withContext(parser) { Wire.parse(text) } else Wire.parse(text)
                when (m) {
                    null -> Unit
                    is WireReply -> settle(source, url, m)
                    is WireRequest -> deliver(reply, answer(source, url, m))
                }
            } finally {
                if (limited) release(source, text.length)
            }
        }
    }

    private fun admit(source: Caller, chars: Int): Boolean {
        val count = inFlight[source] ?: 0
        if (count >= MAX_IN_FLIGHT || inFlightChars + chars > MAX_IN_FLIGHT_CHARS) return false
        inFlight[source] = count + 1
        inFlightChars += chars
        return true
    }

    private fun release(source: Caller, chars: Int) {
        inFlight[source] = (inFlight[source] ?: 1) - 1
        inFlightChars -= chars
    }

    /** A reply to a page that is gone (its WebView destroyed) is dropped. */
    private fun deliver(reply: (String) -> Unit, text: String) {
        try {
            reply(text)
        } catch (e: RuntimeException) {
            log("reply not delivered", e)
        }
    }

    /** The background page is loading again: it must say it is ready again. */
    fun backgroundReloading() {
        if (ready.isCompleted) ready = CompletableDeferred()
        backgroundPost = null
        pending.values.filter { it.target == Caller.BACKGROUND }.forEach {
            it.reply.completeExceptionally(PageError("The background reloaded"))
        }
    }

    /** Asks a page (`post` reaches it) and returns its result, or throws. */
    suspend fun ask(target: Caller, post: (String) -> Unit, type: String, payload: JsonElement, timeoutMs: Long): JsonElement? {
        val box = withTimeoutOrNull(timeoutMs) { Box(exchange(target, post, type, payload)) }
        return (box ?: throw PageError("The page did not answer $type in time")).value
    }

    private suspend fun exchange(target: Caller, post: (String) -> Unit, type: String, payload: JsonElement): JsonElement? {
        next += 1
        val id = "native-$next"
        val reply = CompletableDeferred<WireReply>()
        pending[id] = Pending(target, reply)
        try {
            post(Wire.request(id, type, payload))
            val r = reply.await()
            if (!r.ok) throw PageError(r.error ?: "Error")
            return r.result
        } finally {
            pending.remove(id)
        }
    }

    /** A reply counts only from the page native asked, with that page's rights. */
    private fun settle(source: Caller, url: String, reply: WireReply) {
        val p = pending[reply.re] ?: return
        if (callerOf(source, url) != p.target) return
        pending.remove(reply.re)
        p.reply.complete(reply)
    }

    private fun callerOf(source: Caller, url: String): Caller? = when (source) {
        Caller.SERVER -> if (serverAllowed(url)) Caller.SERVER else null
        else -> source
    }

    private suspend fun answer(source: Caller, url: String, m: WireRequest): String = try {
        Wire.ok(m.id, run(source, url, m))
    } catch (e: CancellationException) {
        // A time limit inside native (not this coroutine's end) still answers.
        currentCoroutineContext().ensureActive()
        log("request ${m.type} cut short", e)
        Wire.error(m.id, NATIVE_FAILED)
    } catch (e: Exception) {
        val shown = pageMessage(e)
        if (shown == null) log("request ${m.type} failed", e)
        Wire.error(m.id, shown ?: NATIVE_FAILED)
    }

    private suspend fun run(source: Caller, url: String, m: WireRequest): JsonElement? {
        val caller = callerOf(source, url)
        if (caller == null || m.type !in CALLER_REQUESTS.getValue(caller)) {
            throw RequestRefused("${m.type} isn't allowed from this page")
        }
        if (!payloadValid(m.type, m.payload)) throw RequestRefused("Bad payload for ${m.type}")
        val payload = m.payload as JsonObject
        return when (m.type) {
            READY -> {
                ready.complete(Unit)
                null
            }
            "runtime.send" -> route(payload.getValue("message"), sender(caller, url))
            else -> handle(caller, m.type, payload, url)
        }
    }

    private fun sender(caller: Caller, url: String): JsonObject = buildJsonObject {
        put("id", APP_ID)
        put("url", url)
        put("fromTab", caller == Caller.SERVER)
    }

    private suspend fun route(message: JsonElement, sender: JsonObject): JsonElement? {
        val payload = buildJsonObject {
            put("message", message)
            put("sender", sender)
        }
        val box = withTimeoutOrNull(routeTimeoutMs) {
            awaitReady()
            val post = backgroundPost ?: throw PageError("No background page")
            Box(exchange(Caller.BACKGROUND, post, ROUTE, payload))
        }
        return (box ?: throw PageError("The background did not answer in time")).value
    }

    /** Until the background is ready (again, after a reload). */
    private suspend fun awaitReady() {
        while (true) {
            val r = ready
            r.await()
            if (r === ready) return
        }
    }
}
