package dev.modulelibrary.app.core

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/** A fetch that failed; its message is safe to show a page. */
class FetchFailed(message: String) : IOException(message)

/**
 * The background's two outside reads (the remote config, foundryvtt.com's
 * releases; the rule is checked before, in NativeHandlers): no redirects,
 * no cookies or Referer, 2xx only, and it stops reading past the cap or the
 * time limit. The limit is a whole-request deadline: a watchdog closes the
 * connection, since a blocking read ignores coroutine cancellation and its
 * own timeout counts per read (review).
 */
class NativeFetch(
    private val timeoutMs: Int = FETCH_TIMEOUT_MS,
    private val maxChars: Int = FETCH_MAX_CHARS,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : Fetcher {
    override suspend fun fetch(url: String): String = withContext(io) {
        val conn = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (_: IOException) {
            throw FetchFailed("Couldn't read the address")
        }
        val timedOut = AtomicBoolean(false)
        val watchdog = launch {
            delay(timeoutMs.toLong())
            timedOut.set(true)
            conn.disconnect()
        }
        try {
            read(conn)
        } catch (e: IOException) {
            throw when {
                timedOut.get() -> FetchFailed("Timed out")
                e is FetchFailed -> e
                else -> FetchFailed("Couldn't read the address")
            }
        } finally {
            watchdog.cancel()
            conn.disconnect()
        }
    }

    private fun read(conn: HttpURLConnection): String {
        conn.instanceFollowRedirects = false
        conn.useCaches = false
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.setRequestProperty("Accept", "application/json, text/html")
        val status = conn.responseCode
        if (status !in 200..299) throw FetchFailed("HTTP $status")
        InputStreamReader(conn.inputStream, Charsets.UTF_8).use { reader ->
            val out = StringBuilder()
            val buf = CharArray(8192)
            while (true) {
                val n = reader.read(buf)
                if (n < 0) break
                out.appendRange(buf, 0, n)
                if (out.length > maxChars) throw FetchFailed("Too large")
            }
            return out.toString()
        }
    }
}
