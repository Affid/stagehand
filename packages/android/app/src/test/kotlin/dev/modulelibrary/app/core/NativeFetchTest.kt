package dev.modulelibrary.app.core

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress

class NativeFetchTest {
    private lateinit var server: HttpServer
    private val seen = mutableListOf<Map<String, List<String>>>()
    private val base get() = "http://127.0.0.1:${server.address.port}"

    @Before
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { ex ->
            seen += ex.requestHeaders.toMap()
            val (status, body) = when (ex.requestURI.path) {
                "/ok" -> 200 to "héllo"
                "/big" -> 200 to "x".repeat(101)
                "/missing" -> 404 to "no"
                "/moved" -> {
                    ex.responseHeaders.add("Location", "$base/ok")
                    302 to ""
                }
                "/drip" -> {
                    ex.sendResponseHeaders(200, 0)
                    ex.responseBody.use { out ->
                        repeat(30) {
                            out.write('x'.code)
                            out.flush()
                            Thread.sleep(100)
                        }
                    }
                    return@createContext
                }
                "/slow" -> {
                    Thread.sleep(1_500)
                    200 to "late"
                }
                else -> 500 to ""
            }
            val bytes = body.toByteArray(Charsets.UTF_8)
            ex.sendResponseHeaders(status, if (bytes.isEmpty()) -1 else bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        server.start()
    }

    @After
    fun stop() = server.stop(0)

    private val fetch = NativeFetch(timeoutMs = 1_000, maxChars = 100)

    private fun failure(path: String): String? =
        runCatching { runBlocking { fetch.fetch("$base$path") } }.exceptionOrNull()?.message

    @Test
    fun `reads a 2xx body as UTF-8`() = runBlocking {
        assertEquals("héllo", fetch.fetch("$base/ok"))
    }

    @Test
    fun `sends no cookies or referer`() = runBlocking {
        fetch.fetch("$base/ok")
        val headers = seen.single().keys.map { it.lowercase() }
        assertTrue(headers.toString(), "cookie" !in headers && "referer" !in headers)
    }

    @Test
    fun `refuses other statuses and redirects`() {
        assertEquals("HTTP 404", failure("/missing"))
        assertEquals("HTTP 302", failure("/moved"))
        // One request each: the redirect to /ok is never followed.
        assertEquals(2, seen.size)
    }

    @Test
    fun `stops past the cap`() {
        assertEquals("Too large", failure("/big"))
    }

    @Test
    fun `gives up after the time limit`() {
        assertEquals("Timed out", failure("/slow"))
    }

    @Test
    fun `a body trickling in still stops at the time limit`() {
        val started = System.nanoTime()
        assertEquals("Timed out", failure("/drip"))
        assertTrue((System.nanoTime() - started) / 1_000_000 < 2_500)
    }

    @Test
    fun `an unreachable host says little`() {
        val e = runCatching { runBlocking { fetch.fetch("http://no-such-host.invalid/x") } }.exceptionOrNull()
        assertEquals("Couldn't read the address", e?.message)
    }
}
