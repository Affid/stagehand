package io.github.affid.stagehand.core

/**
 * Whether native takes a message from a WebView: the main frame only, from
 * the origin of that WebView's last committed navigation (a page script's
 * replaceState doesn't change it), never before a page has committed.
 */
fun acceptMessage(isMainFrame: Boolean, sourceOrigin: String, committedUrl: String?): Boolean {
    if (!isMainFrame || committedUrl == null) return false
    val committed = WebUrl.parse(committedUrl)?.origin ?: return false
    return WebUrl.parse(sourceOrigin)?.origin == committed
}

/** What the app shows. */
enum class Screen { HOME, SERVER }

enum class BackAction { NONE, HISTORY, HOME, SERVER, EXIT }

/**
 * Android's Back: on a server, Setup's own Back first, then the history,
 * then home; on home, its open sheet first, then back to the server when
 * home was opened over it (Stagehand settings), else out of the app.
 * On a server, a second press soon after one the page claimed goes on
 * regardless: a page that claims every press can't keep the user in
 * (security review). Home is the app's own page, so its claims count.
 */
fun backStep(
    showing: Screen,
    pageHandled: Boolean,
    canGoBack: Boolean,
    homeOverServer: Boolean,
    pressedAgainSoon: Boolean = false,
): BackAction = when {
    showing == Screen.HOME -> when {
        pageHandled -> BackAction.NONE
        homeOverServer -> BackAction.SERVER
        else -> BackAction.EXIT
    }
    pageHandled && !pressedAgainSoon -> BackAction.NONE
    canGoBack -> BackAction.HISTORY
    else -> BackAction.HOME
}

/**
 * Whether Back may step to `previous` in the server WebView's history: a
 * page of a saved server, but not its login page (going back there would
 * show the login form to someone logged in).
 */
fun historyBackAllowed(previous: String?, servers: Collection<String>): Boolean {
    val url = previous?.let(WebUrl::parse) ?: return false
    val server = servers.firstOrNull { s ->
        val full = url.origin + url.rawPath
        full == s || full.startsWith("$s/")
    } ?: return false
    return !isServerPage(previous, server, "/auth")
}

/** A server's name in native dialogs: its host and port. */
fun serverLabel(url: String): String {
    val parsed = WebUrl.parse(url) ?: return ""
    return parsed.origin.substringAfter("://")
}
