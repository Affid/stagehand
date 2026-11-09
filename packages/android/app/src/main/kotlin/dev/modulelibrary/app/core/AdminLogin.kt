package dev.modulelibrary.app.core

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder

/** Foundry's login page, read before ours shows. */
sealed interface LoginPage {
    /** Foundry wants the password, and a username when its options set one. */
    data class Form(val usernameRequired: Boolean) : LoginPage

    /** No login now (a world runs, no admin password): go to `url` instead. */
    data class Elsewhere(val url: String) : LoginPage
}

/** What Foundry said to a login. */
sealed interface LoginResult {
    data object Setup : LoginResult
    data object Wrong : LoginResult
    data class Elsewhere(val url: String) : LoginResult
    data class Failed(val reason: String) : LoginResult
}

/** A login's result and Foundry's Set-Cookie headers, for the WebView's cookies. */
data class LoginAnswer(val result: LoginResult, val cookies: List<String>)

private const val LOGIN_TIMEOUT_MS = 10_000
private const val MAX_PAGE_CHARS = 512_000
private const val HTTP_UNAUTHORIZED = 401
private val REDIRECTS = setOf(301, 302, 303, 307, 308)
private val USERNAME_FIELD = Regex("""name\s*=\s*["']adminUsername["']""")
private const val ODD_ANSWER = "Foundry didn't answer as expected"
private const val NO_ANSWER = "Foundry didn't answer"

/**
 * A redirect's target on this server only, as a full URL; null for anywhere
 * else, and for its login page itself, which would loop (review).
 */
private fun onServer(location: String?, server: String): String? {
    val origin = WebUrl.parse(server)?.origin ?: return null
    val target = try {
        URI("$origin/").resolve(location ?: return null).toString()
    } catch (_: IllegalArgumentException) {
        return null
    }
    if (target != server && !target.startsWith("$server/")) return null
    return target.takeIf { loginServerOf(it, listOf(server)) == null }
}

/** Foundry's answer to a login POST: Setup, a wrong password, another page, or a failure. */
fun outcome(status: Int, location: String?, server: String): LoginResult {
    if (status == HTTP_UNAUTHORIZED) return LoginResult.Wrong
    val target = if (status in REDIRECTS) onServer(location, server) else null
    return when {
        target == null -> LoginResult.Failed(ODD_ANSWER)
        target == "$server/setup" -> LoginResult.Setup
        else -> LoginResult.Elsewhere(target)
    }
}

/**
 * Our login (Android plan, phase 7): native reads Foundry's /auth and posts
 * the administrator password itself, from the app's own field, with the
 * WebView's session cookie and the server's own Origin (Foundry's
 * same-origin check for a POST). The password goes only to the server, and
 * nowhere is it kept or logged.
 */
class AdminLogin(
    private val timeoutMs: Int = LOGIN_TIMEOUT_MS,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    suspend fun page(server: String, cookie: String?): LoginPage = withContext(io) {
        val conn = open("$server/auth", cookie)
        try {
            val status = conn.responseCode
            if (status in REDIRECTS) {
                val target = onServer(conn.getHeaderField("Location"), server) ?: throw IOException(ODD_ANSWER)
                return@withContext LoginPage.Elsewhere(target)
            }
            LoginPage.Form(usernameRequired = USERNAME_FIELD.containsMatchIn(readCapped(conn)))
        } finally {
            conn.disconnect()
        }
    }

    suspend fun logIn(server: String, cookie: String?, password: String, username: String?): LoginAnswer =
        withContext(io) {
            try {
                post(server, cookie, form(password, username))
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // A broken address or answer as much as no answer (review).
                LoginAnswer(LoginResult.Failed(NO_ANSWER), emptyList())
            }
        }

    private fun post(server: String, cookie: String?, body: String): LoginAnswer {
        val conn = open("$server/auth", cookie)
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            // Foundry's same-origin check for a POST reads either header.
            conn.setRequestProperty("Origin", WebUrl.parse(server)?.origin ?: server)
            conn.setRequestProperty("Sec-Fetch-Site", "same-origin")
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = conn.responseCode
            val cookies = conn.headerFields.entries
                .filter { (name, _) -> name.equals("Set-Cookie", ignoreCase = true) }
                .flatMap { it.value }
            return LoginAnswer(outcome(status, conn.getHeaderField("Location"), server), cookies)
        } finally {
            conn.disconnect()
        }
    }

    private fun open(url: String, cookie: String?): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = false
        conn.useCaches = false
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        if (!cookie.isNullOrEmpty()) conn.setRequestProperty("Cookie", cookie)
        return conn
    }
}

private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())

/** The form Foundry's login posts: the username only when its options want one. */
private fun form(password: String, username: String?): String =
    "adminPassword=${encode(password)}" + (username?.let { "&adminUsername=${encode(it)}" } ?: "")

/** At most MAX_PAGE_CHARS of the page, without reading the rest (review). */
private fun readCapped(conn: HttpURLConnection): String = conn.inputStream.bufferedReader().use { reader ->
    val out = StringBuilder()
    val buf = CharArray(8192)
    while (out.length < MAX_PAGE_CHARS) {
        val n = reader.read(buf)
        if (n < 0) break
        out.appendRange(buf, 0, n)
    }
    out.toString()
}
