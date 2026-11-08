package dev.modulelibrary.app.web

import android.content.res.AssetManager
import android.webkit.WebView
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import dev.modulelibrary.app.core.NativeState
import dev.modulelibrary.app.core.WebUrl
import dev.modulelibrary.app.core.wrapForServer

/**
 * The server WebView's document-start scripts: for each saved server with
 * registered scripts, app-setup.js then app-game.js, each wrapped with its
 * server and limited to its origin. All app-setup scripts come before all
 * app-game scripts: app-game takes the bridge away on every page that
 * isn't its server's game page, so it must run after app-setup has had it
 * (plan, "Native rules").
 */
class Injection(private val view: WebView, assets: AssetManager) {
    private val setup = assets.open("app-setup.js").bufferedReader().use { it.readText() }
    private val game = assets.open("app-game.js").bufferedReader().use { it.readText() }
    private var servers: List<String> = emptyList()
    private val handlers = mutableListOf<ScriptHandler>()

    /**
     * Brings the scripts in line with `state`. Pages already open keep what
     * they started with; the next load gets the change.
     */
    fun sync(state: NativeState) {
        val wanted = state.activeServers().sorted()
        if (wanted == servers) return
        handlers.forEach { it.remove() }
        handlers.clear()
        for (script in listOf(setup, game)) {
            for (server in wanted) {
                val origin = WebUrl.parse(server)?.origin ?: continue
                // A rule WebView refuses skips that server (security review).
                runCatching { WebViewCompat.addDocumentStartJavaScript(view, wrapForServer(script, server), setOf(origin)) }
                    .onSuccess { handlers += it }
            }
        }
        servers = wanted
    }
}
