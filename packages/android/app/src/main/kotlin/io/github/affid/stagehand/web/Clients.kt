package io.github.affid.stagehand.web

import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import io.github.affid.stagehand.core.APP_HOST
import io.github.affid.stagehand.core.HOME_PAGE
import io.github.affid.stagehand.core.WebUrl
import io.github.affid.stagehand.core.externalAllowed
import io.github.affid.stagehand.core.loginServerOf
import io.github.affid.stagehand.core.mayAskAsServer
import io.github.affid.stagehand.core.runningInsteadOf
import java.io.ByteArrayInputStream

/** What the WebView clients ask of the app. */
interface AppHost {
    /** Saved server origins. */
    fun origins(): Set<String>

    /** Saved servers with registered scripts. */
    fun activeServers(): Set<String>

    fun openServer(url: String)

    /** The server list, asked for by a tapped link to the app's home page. */
    fun openHome()

    fun openOutside(url: String)

    /** Whether the user touched the server WebView a moment ago (native's own listener). */
    fun touchedServerLately(): Boolean

    fun certificateRefused(url: String)

    fun rendererGone()

    fun backgroundStarting()

    fun serverPageFinished()

    /** A saved server's Foundry login was reached: ours shows instead (phase 7). */
    fun showLogin(server: String)

    /** The game page the app is applying a launch's changes on, out of sight: it may load. */
    fun gameAllowed(url: String): Boolean
}

private fun blocked() = WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))

/** Whether an outside link may open: http(s), tapped, by the rule. */
private fun tappedOutside(request: WebResourceRequest, host: AppHost): String? {
    val url = request.url.toString()
    if (!request.hasGesture() || WebUrl.parse(url)?.host == APP_HOST) return null
    return url.takeIf { externalAllowed(it, host.origins()) }
}

/**
 * The home screen's and the background's WebViews: only the app's own
 * pages (WebViewAssetLoader), nothing else loads, and they never navigate.
 * On home, a tap on a saved server opens it in the server WebView; a tap
 * on an outside link opens a Custom Tab.
 */
class AssetPageClient(
    private val isBackground: Boolean,
    private val page: PageState,
    private val host: AppHost,
    private val loader: WebViewAssetLoader,
) : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        if (request.url.host != APP_HOST || request.url.scheme != "https") return blocked()
        return loader.shouldInterceptRequest(request.url) ?: blocked()
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (isBackground || !request.isForMainFrame) return true
        val url = request.url.toString()
        when {
            request.hasGesture() && mayAskAsServer(url, host.activeServers()) -> host.openServer(url)
            else -> tappedOutside(request, host)?.let(host::openOutside)
        }
        return true
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        page.commit(url)
        if (isBackground) host.backgroundStarting()
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        host.rendererGone()
        return true
    }
}

/**
 * The server WebView: the saved servers' pages stay in it; a tapped link
 * elsewhere opens a Custom Tab; anything else is dropped. A certificate
 * error is refused (v1: no self-signed servers).
 */
class ServerPageClient(private val page: PageState, private val host: AppHost) : WebViewClient() {
    /**
     * Foundry's game and login never show (owner, phase 7): the server's
     * /join, our running page, or our native login instead.
     */
    private fun ourInstead(view: WebView, url: String): Boolean {
        val servers = host.activeServers()
        loginServerOf(url, servers)?.let {
            host.showLogin(it)
            return true
        }
        val instead = runningInsteadOf(url, servers) ?: return false
        if (host.gameAllowed(url)) return false
        view.loadUrl(instead)
        return true
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        if (ourInstead(view, request.url.toString())) return true
        val url = WebUrl.parse(request.url.toString())
        if (url != null && url.host != APP_HOST && url.origin in host.origins()) return false
        // Our login bar and running screen link to the server list (owner,
        // 2026-11-09): a tap there shows home; it gives the page nothing.
        if (request.url.toString() == HOME_PAGE) {
            // A real tap only, as for outside links (review).
            if (request.hasGesture() && host.touchedServerLately()) host.openHome()
            return true
        }
        // WebView's gesture flag is set by input that never touched the
        // screen too (checked on the emulator): a real touch is required.
        if (host.touchedServerLately()) tappedOutside(request, host)?.let(host::openOutside)
        return true
    }

    /**
     * Main-frame loads only to saved servers: shouldOverrideUrlLoading
     * isn't asked for a form's POST or a redirect, so a page could
     * otherwise load another site full-screen here (security review).
     */
    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        if (!request.isForMainFrame) return null
        val url = WebUrl.parse(request.url.toString())
        return if (url != null && url.host != APP_HOST && url.origin in host.origins()) null else blocked()
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        // A redirect (after a form's POST too) isn't always asked about above.
        val servers = host.activeServers()
        val game = runningInsteadOf(url, servers) != null && !host.gameAllowed(url)
        if (loginServerOf(url, servers) != null || game) {
            view.stopLoading()
            ourInstead(view, url)
            return
        }
        // The committed address, after redirects (checked on the emulator).
        page.commit(url)
    }

    override fun onPageFinished(view: WebView, url: String) {
        host.serverPageFinished()
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.cancel()
        // Said only for a saved server: another site's resource can't put
        // its name in the app's dialog (security review).
        val origin = WebUrl.parse(error.url)?.origin
        if (origin != null && origin in host.origins()) host.certificateRefused(origin)
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        host.rendererGone()
        return true
    }
}
