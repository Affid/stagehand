package dev.modulelibrary.app.core

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress
import java.net.URLDecoder

/** A stand-in for Foundry's /auth: GET shows the form, POST checks the password. */
class AdminLoginTest {
    private lateinit var server: HttpServer
    private val base get() = "http://127.0.0.1:${server.address.port}"
    private var running = false
    private var usernameField = false
    private val posts = mutableListOf<Pair<Map<String, List<String>>, String>>()

    @Before
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/auth") { ex ->
            if (running) {
                ex.responseHeaders.add("Location", "/join")
                ex.sendResponseHeaders(302, -1)
                ex.close()
                return@createContext
            }
            if (ex.requestMethod == "GET") {
                val form = if (usernameField) """<input name="adminUsername">""" else ""
                val body = """<form>$form<input type="password" name="adminPassword"></form>""".toByteArray()
                ex.sendResponseHeaders(200, body.size.toLong())
                ex.responseBody.use { it.write(body) }
                return@createContext
            }
            val text = ex.requestBody.readBytes().decodeToString()
            posts += ex.requestHeaders.toMap() to text
            val fields = text.split("&").associate {
                val (k, v) = it.split("=", limit = 2)
                k to URLDecoder.decode(v, Charsets.UTF_8)
            }
            if (fields["adminPassword"] == "right & sure") {
                ex.responseHeaders.add("Set-Cookie", "session=abc; Path=/; HttpOnly")
                ex.responseHeaders.add("Location", "/setup")
                ex.sendResponseHeaders(302, -1)
            } else {
                ex.sendResponseHeaders(401, -1)
            }
            ex.close()
        }
        server.start()
    }

    @After
    fun stop() = server.stop(0)

    private val login = AdminLogin(timeoutMs = 2_000)

    @Test
    fun `the login page says whether Foundry wants a username`() = runBlocking {
        assertEquals(LoginPage.Form(usernameRequired = false), login.page(base, null))
        usernameField = true
        assertEquals(LoginPage.Form(usernameRequired = true), login.page(base, null))
    }

    @Test
    fun `a world running meanwhile sends the app to that page instead`() = runBlocking {
        running = true
        assertEquals(LoginPage.Elsewhere("$base/join"), login.page(base, null))
        assertEquals(LoginResult.Elsewhere("$base/join"), login.logIn(base, null, "x", null).result)
    }

    @Test
    fun `the right password opens Setup and hands back Foundry's cookie`() = runBlocking {
        val answer = login.logIn(base, "session=old", "right & sure", null)
        assertEquals(LoginResult.Setup, answer.result)
        assertEquals(listOf("session=abc; Path=/; HttpOnly"), answer.cookies)
        val (headers, body) = posts.single()
        assertEquals("adminPassword=right+%26+sure", body)
        assertEquals(listOf(base), headers["Origin"])
        assertEquals(listOf("same-origin"), headers["Sec-fetch-site"])
        assertEquals(listOf("session=old"), headers["Cookie"])
    }

    @Test
    fun `a username goes along only when Foundry wants one`() = runBlocking {
        login.logIn(base, null, "nope", "gm")
        assertEquals("adminPassword=nope&adminUsername=gm", posts.single().second)
        assertNull(posts.single().first["Cookie"])
    }

    @Test
    fun `a wrong password is said as such`() = runBlocking {
        assertEquals(LoginResult.Wrong, login.logIn(base, null, "nope", null).result)
    }

    @Test
    fun `no server, or another site in the answer, is a failure`() = runBlocking {
        val gone = AdminLogin(timeoutMs = 500).logIn("http://127.0.0.1:1", null, "x", null).result
        assertTrue(gone is LoginResult.Failed)
        assertEquals(LoginResult.Failed("Foundry didn't answer as expected"), outcome(302, "https://evil.example/setup", base))
        assertEquals(LoginResult.Failed("Foundry didn't answer as expected"), outcome(500, null, base))
        assertEquals(LoginResult.Setup, outcome(302, "/setup", base))
        // Back to the login itself would loop: a failure (review).
        assertEquals(LoginResult.Failed("Foundry didn't answer as expected"), outcome(302, "/auth/", base))
        assertEquals(LoginResult.Setup, outcome(303, "$base/setup", base))
    }
}
