package dev.modulelibrary.app.web

import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import dev.modulelibrary.app.core.BRIDGE_NAME
import dev.modulelibrary.app.core.Caller
import dev.modulelibrary.app.core.Relay
import dev.modulelibrary.app.core.acceptMessage

/** A throwaway listener name for checking an origin rule. */
private const val PROBE_NAME = "mlAppProbe"

/**
 * One WebView's page as native knows it: its last committed navigation
 * (onPageStarted, not getUrl(): a page's replaceState doesn't change it),
 * a counter of documents, and the reply proxy of the current document.
 */
class PageState {
    var committed: String? = null
        private set
    var generation = 0
        private set
    private var proxy: JavaScriptReplyProxy? = null
    private var proxyGeneration = -1

    fun commit(url: String) {
        committed = url
        generation += 1
        proxy = null
    }

    /** The WebView is going: nothing more reaches its documents. */
    fun close() {
        committed = null
        generation += 1
        proxy = null
    }

    fun keepProxy(p: JavaScriptReplyProxy, gen: Int) {
        proxy = p
        proxyGeneration = gen
    }

    /** Posts to the current document, if it has written to native. */
    fun postToCurrent(text: String): Boolean {
        val p = proxy ?: return false
        if (proxyGeneration != generation) return false
        p.postMessage(text)
        return true
    }
}

/**
 * Gives `view` the bridge object for `origins` (WebView injects it only
 * there) and hands its messages to the relay: main frame only, from the
 * committed page's origin; replies go only to the document that asked.
 */
fun listen(view: WebView, origins: Set<String>, source: Caller, page: PageState, relay: Relay) {
    WebViewCompat.removeWebMessageListener(view, BRIDGE_NAME)
    // An origin WebView refuses as a rule is left out, not a crash at
    // every start (security review).
    val accepted = origins.filter { origin ->
        runCatching { WebViewCompat.addWebMessageListener(view, PROBE_NAME, setOf(origin)) { _, _, _, _, _ -> } }
            .also { WebViewCompat.removeWebMessageListener(view, PROBE_NAME) }
            .isSuccess
    }.toSet()
    if (accepted.isEmpty()) return
    WebViewCompat.addWebMessageListener(view, BRIDGE_NAME, accepted) { _, message, sourceOrigin, isMainFrame, proxy ->
        val url = page.committed
        val text = message.data
        if (text == null || url == null || !acceptMessage(isMainFrame, sourceOrigin.toString(), url)) {
            return@addWebMessageListener
        }
        val gen = page.generation
        page.keepProxy(proxy, gen)
        relay.fromPage(source, url, text) { reply ->
            if (page.generation == gen) proxy.postMessage(reply)
        }
    }
}
