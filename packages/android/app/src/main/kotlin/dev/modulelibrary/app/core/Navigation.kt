package dev.modulelibrary.app.core

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
