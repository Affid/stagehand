package dev.modulelibrary.app.core

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

enum class BackAction { NONE, HISTORY, HOME, EXIT }

/** Android's Back: Setup's own Back first, then the history, then home, then out. */
fun backStep(showing: Screen, pageHandled: Boolean, canGoBack: Boolean): BackAction = when {
    showing == Screen.HOME -> BackAction.EXIT
    pageHandled -> BackAction.NONE
    canGoBack -> BackAction.HISTORY
    else -> BackAction.HOME
}

/** A server's name in native dialogs: its host and port. */
fun serverLabel(url: String): String {
    val parsed = WebUrl.parse(url) ?: return ""
    return parsed.origin.substringAfter("://")
}
