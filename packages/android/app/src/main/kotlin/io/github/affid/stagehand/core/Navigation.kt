package io.github.affid.stagehand.core

/**
 * Where the server WebView goes instead (Android plan, phase 7): the app
 * shows only our pages, never Foundry's game (owner, 2026-11-09).
 */

/** Foundry's pages that the app never shows. */
private val GAME_PAGES = listOf("/game", "/players")

/** A saved server's game or players page: that server's /join, where our running page is. */
fun runningInsteadOf(url: String, servers: Collection<String>): String? {
    val server = servers.firstOrNull { server -> GAME_PAGES.any { isServerPage(url, server, it) } }
    return server?.let { "$it/join" }
}

/** A saved server's /join, where our running page is: it may ask native only for a password. */
fun isRunningPage(url: String, servers: Collection<String>): Boolean =
    servers.any { isServerPage(url, it, "/join") }

/** The saved server whose Foundry login (/auth) this is: native shows our login instead. */
fun loginServerOf(url: String, servers: Collection<String>): String? =
    servers.firstOrNull { isServerPage(url, it, "/auth") }

/**
 * Foundry's dead end: its page goes to /no once it gives up reconnecting
 * (client/game.mjs, "reconnect_failed"). The saved server whose /no this
 * is: native shows our unreachable screen instead (owner, 2026-11-11).
 */
fun lostServerOf(url: String, servers: Collection<String>): String? =
    servers.firstOrNull { isServerPage(url, it, "/no") }

/**
 * The saved server a page is on: the longest one it is under, else one on
 * its origin (a page beside the route prefix), so a failed load always has
 * a Setup to try again.
 */
fun serverOf(url: String, servers: Collection<String>): String? {
    val parsed = WebUrl.parse(url) ?: return null
    val full = parsed.origin + parsed.rawPath.removeSuffix("/")
    return servers.filter { full == it || full.startsWith("$it/") }.maxByOrNull { it.length }
        ?: servers.firstOrNull { WebUrl.parse(it)?.origin == parsed.origin }
}

/** A reverse proxy's answers when Foundry behind it is down or restarting. */
private val GATEWAY_DOWN = setOf(502, 503, 504)

/** Whether a page's HTTP status says the server isn't there (Foundry's own errors don't). */
fun gatewayDown(status: Int): Boolean = status in GATEWAY_DOWN
