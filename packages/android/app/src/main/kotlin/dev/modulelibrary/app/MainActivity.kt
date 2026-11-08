package dev.modulelibrary.app

import android.app.AlertDialog
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import dev.modulelibrary.app.core.APP_ORIGIN
import dev.modulelibrary.app.core.BACKGROUND_PAGE
import dev.modulelibrary.app.core.BACK
import dev.modulelibrary.app.core.BackAction
import dev.modulelibrary.app.core.Caller
import dev.modulelibrary.app.core.HOME_PAGE
import dev.modulelibrary.app.core.KeyValueStore
import dev.modulelibrary.app.core.NativeFetch
import dev.modulelibrary.app.core.NativeHandlers
import dev.modulelibrary.app.core.NativeState
import dev.modulelibrary.app.core.PageTimeout
import dev.modulelibrary.app.core.Relay
import dev.modulelibrary.app.core.Screen
import dev.modulelibrary.app.core.TapRule
import dev.modulelibrary.app.core.WebUrl
import dev.modulelibrary.app.core.backStep
import dev.modulelibrary.app.core.historyBackAllowed
import dev.modulelibrary.app.core.isServerPage
import dev.modulelibrary.app.core.BRIDGE_NAME
import androidx.webkit.WebViewCompat
import dev.modulelibrary.app.core.mayAskAsServer
import dev.modulelibrary.app.core.serverLabel
import dev.modulelibrary.app.web.AppHost
import dev.modulelibrary.app.web.AssetPageClient
import dev.modulelibrary.app.web.Injection
import dev.modulelibrary.app.web.PageState
import dev.modulelibrary.app.web.ServerPageClient
import dev.modulelibrary.app.web.harden
import dev.modulelibrary.app.web.listen
import dev.modulelibrary.app.web.openInBrowser
import dev.modulelibrary.app.web.showSupportNotice
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

private const val TAG = "ModuleLibrary"
/** How long Setup has to say whether it used Android's Back. */
private const val BACK_ANSWER_MS = 1_500L
/** An outside link opens only this soon after a tap on the server page. */
private const val TAP_WINDOW_MS = 1_000L
/** A second Back within this goes on even if the page claimed the first. */
private const val BACK_AGAIN_MS = 2_000L
/** After a renderer crash within this, the app starts on home. */
private const val CRASH_WINDOW_MS = 60_000L

/** Details only in debug builds: release logs carry no addresses or payloads. */
private fun debugLog(message: String, error: Throwable? = null) {
    if (BuildConfig.DEBUG) Log.d(TAG, message, error)
}

/** A renderer crash, remembered for the process (it outlives the activity). */
private object Crash {
    var at: Long = Long.MIN_VALUE / 2
}

/**
 * The app's one screen: three WebViews (docs/ANDROID-APP-PLAN.md, "How the
 * pieces fit"). The background runs the router on the app's own origin,
 * hidden; home shows the server list; the server WebView shows the user's
 * Foundry with our scripts on its Setup and game pages. Native's work is in
 * core/ (plain Kotlin); this class wires it to the WebViews.
 */
class MainActivity : ComponentActivity(), AppHost {
    private lateinit var root: FrameLayout
    private lateinit var handlers: NativeHandlers
    private lateinit var relay: Relay
    private lateinit var injection: Injection
    private lateinit var background: WebView
    private lateinit var home: WebView
    private lateinit var server: WebView
    private val backgroundPage = PageState()
    private val homePage = PageState()
    private val serverPage = PageState()
    private var showing = Screen.HOME
    private var started = false
    private var clearHistoryOnFinish = false
    private var backBusy = false
    /** Home opened over a server (Module Library settings): Back returns there. */
    private var homeOverServer = false
    private var lastBackClaimedAt = Long.MIN_VALUE / 2
    /** Back pressed again while Setup was being asked: it goes on once asked. */
    private var backAgain = false
    private var recreating = false
    private var certDialog: AlertDialog? = null
    private var activeOrigins: Set<String> = emptySet()
    /** Registered at construction, as the Activity Result API requires. */
    private val pickers = Pickers(this)
    /** The user's last tap on the server page: an outside link needs one, each tap opens one. */
    private val taps by lazy {
        val config = android.view.ViewConfiguration.get(this)
        TapRule(
            slopPx = config.scaledTouchSlop.toFloat(),
            maxPressMs = android.view.ViewConfiguration.getLongPressTimeout().toLong(),
            windowMs = TAP_WINDOW_MS,
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        setContentView(root)
        keepClearOfSystemBars(root)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        showSupportNotice(this) { canRun -> if (canRun) start() else finish() }
    }

    private fun start() {
        // The WebView notice can outlive the activity it was shown for.
        if (isFinishing || isDestroyed) return
        handlers = NativeHandlers(
            store = KeyValueStore(filesDir),
            stateFile = File(filesDir, "native.json"),
            fetcher = NativeFetch(),
            scripts = { state -> serversChanged(state) },
            ui = AndroidUi(this, pickers),
            clock = SystemClock::elapsedRealtime,
            tappedLately = ::touchedServerLately,
        )
        relay = Relay(
            scope = lifecycleScope,
            serverAllowed = { url -> mayAskAsServer(url, handlers.state.activeServers()) },
            handle = { _, type, payload, url -> handlers.handle(type, payload, url) },
            log = { message, error ->
                if (BuildConfig.DEBUG) Log.w(TAG, message, error) else Log.w(TAG, "$message: ${error.javaClass.simpleName}")
            },
        )
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        background = webView(AssetPageClient(true, backgroundPage, this, loader))
        home = webView(AssetPageClient(false, homePage, this, loader))
        server = webView(ServerPageClient(serverPage, this)).apply {
            webChromeClient = ServerChromeClient(pickers)
            // Taps reach native here, never through a page's message.
            setOnTouchListener { _, event ->
                val now = SystemClock.elapsedRealtime()
                when (event.actionMasked) {
                    android.view.MotionEvent.ACTION_DOWN -> taps.down(event.x, event.y, now, event.pointerCount)
                    android.view.MotionEvent.ACTION_POINTER_DOWN, android.view.MotionEvent.ACTION_CANCEL -> taps.morePointers()
                    android.view.MotionEvent.ACTION_UP -> taps.up(event.x, event.y, now)
                }
                false
            }
        }
        // The background stays attached (a page hidden from the window
        // gets its timers slowed), one pixel, under the others.
        root.addView(background, FrameLayout.LayoutParams(1, 1))
        root.addView(server, FrameLayout.LayoutParams(-1, -1))
        root.addView(home, FrameLayout.LayoutParams(-1, -1))
        listen(background, setOf(APP_ORIGIN), Caller.BACKGROUND, backgroundPage, relay)
        listen(home, setOf(APP_ORIGIN), Caller.HOME, homePage, relay)
        injection = Injection(server, assets)
        serversChanged(handlers.state)
        onBackPressedDispatcher.addCallback(this, backCallback)
        started = true
        background.loadUrl(BACKGROUND_PAGE)
        // Just after a renderer crash, home: a server page that crashes it
        // can't lock the user out (security review).
        val crashedLately = SystemClock.elapsedRealtime() - Crash.at < CRASH_WINDOW_MS
        val last = handlers.state.lastServer?.takeIf { it in handlers.state.activeServers() && !crashedLately }
        if (last != null) openServer("$last/setup") else showHome()
    }

    private fun webView(client: android.webkit.WebViewClient): WebView = WebView(this).apply {
        harden(this)
        webViewClient = client
        setBackgroundColor(getColor(R.color.ground))
    }

    /**
     * Saved origins or scripts changed: injection, and the bridge only for
     * servers with scripts (security review). Pages already open keep what
     * they started with.
     */
    private fun serversChanged(state: NativeState) {
        injection.sync(state)
        val wanted = state.activeServers().mapNotNull { WebUrl.parse(it)?.origin }.toSet()
        if (wanted != activeOrigins) {
            activeOrigins = wanted
            listen(server, wanted, Caller.SERVER, serverPage, relay)
        }
    }

    private fun show(screen: Screen) {
        showing = screen
        if (screen == Screen.SERVER) homeOverServer = false
        home.visibility = if (screen == Screen.HOME) View.VISIBLE else View.INVISIBLE
        server.visibility = if (screen == Screen.SERVER) View.VISIBLE else View.INVISIBLE
    }

    /** Home as Module Library settings, from a server's Setup (home.open). */
    fun showSettings() {
        if (!started) return
        showHome()
        homeOverServer = serverPage.committed != null
    }

    fun showHome() {
        if (!started) return
        homeOverServer = false
        // Loaded again each time: the list is read when the page starts.
        home.loadUrl(HOME_PAGE)
        show(Screen.HOME)
    }

    override fun origins(): Set<String> = handlers.state.origins

    override fun activeServers(): Set<String> = handlers.state.activeServers()

    override fun openServer(url: String) {
        val full = WebUrl.parse(url)?.let { it.origin + it.rawPath } ?: return
        val id = activeServers().firstOrNull { full == it || full.startsWith("$it/") } ?: return
        clearHistoryOnFinish = true
        server.loadUrl(url)
        show(Screen.SERVER)
        lifecycleScope.launch { handlers.serverOpened(id) }
    }

    override fun openOutside(url: String) = openInBrowser(this, url)

    /** Main thread only (WebView callbacks and the relay's handlers). */
    override fun touchedServerLately(): Boolean = taps.take(SystemClock.elapsedRealtime())

    /** One dialog however many resources fail, and none once closing. */
    override fun certificateRefused(url: String) {
        if (isFinishing || isDestroyed || certDialog?.isShowing == true) return
        certDialog = AlertDialog.Builder(this)
            .setTitle(R.string.cert_title)
            .setMessage(getString(R.string.cert_body, serverLabel(url)))
            .setPositiveButton(android.R.string.ok) { _, _ -> showHome() }
            .setCancelable(false)
            .show()
    }

    /** The three WebViews share a renderer: each says so; start again once. */
    override fun rendererGone() {
        if (recreating) return
        recreating = true
        Crash.at = SystemClock.elapsedRealtime()
        Log.w(TAG, "WebView renderer gone; starting again on home")
        recreate()
    }

    override fun backgroundStarting() = relay.backgroundReloading()

    override fun serverPageFinished() {
        // A server opened from home starts its own history.
        if (clearHistoryOnFinish) {
            clearHistoryOnFinish = false
            server.clearHistory()
        }
    }

    private val backCallback = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            if (backBusy) {
                backAgain = true
                return
            }
            backBusy = true
            lifecycleScope.launch {
                try {
                    back()
                } finally {
                    backBusy = false
                }
            }
        }
    }

    private suspend fun back() {
        val pressedAt = SystemClock.elapsedRealtime()
        backAgain = false
        val handled = showing == Screen.SERVER && setupUsedBack()
        // A press while Setup was asked, or soon after the last claimed one
        // (counted from when that claim came, not from its press), goes on:
        // a page that claims or ignores every Back can't keep the user in.
        val again = backAgain || pressedAt - lastBackClaimedAt < BACK_AGAIN_MS
        // The history as it is after Setup's answer (review).
        val list = server.copyBackForwardList()
        val previous = list.getItemAtIndex(list.currentIndex - 1)?.url
        val action = backStep(
            showing = showing,
            pageHandled = handled,
            canGoBack = historyBackAllowed(previous, activeServers()),
            homeOverServer = homeOverServer,
            pressedAgainSoon = again,
        )
        lastBackClaimedAt = if (action == BackAction.NONE) SystemClock.elapsedRealtime() else Long.MIN_VALUE / 2
        debugLog("Back on $showing: Setup used it $handled, again $again, previous $previous, so $action")
        when (action) {
            BackAction.NONE -> Unit
            BackAction.HISTORY -> server.goBack()
            BackAction.HOME -> showHome()
            BackAction.SERVER -> show(Screen.SERVER)
            BackAction.EXIT -> finish()
        }
    }

    /**
     * Asks our Setup page whether it used Back (only on a saved server's
     * Setup that has written to native). A page that doesn't answer in time
     * counts as having used it: going home would lose the user's place
     * (seen on the emulator, a busy page answered late), and a second Back
     * soon after goes on anyway.
     */
    private suspend fun setupUsedBack(): Boolean {
        val url = serverPage.committed ?: return false
        val servers = activeServers()
        if (!mayAskAsServer(url, servers) || servers.none { isServerPage(url, it, "/setup") }) return false
        if (!serverPage.canPost()) return false
        return try {
            val answer = relay.ask(Caller.SERVER, { serverPage.postToCurrent(it) }, BACK, JsonObject(emptyMap()), BACK_ANSWER_MS)
            debugLog("Setup answered Back with $answer")
            answer?.jsonObject?.get("handled")?.jsonPrimitive?.booleanOrNull == true
        } catch (e: PageTimeout) {
            debugLog("Setup didn't answer Back", e)
            true
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            debugLog("Setup's answer to Back failed", e)
            false
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        certDialog?.dismiss()
        pickers.release()
        if (started) {
            // Replies still on their way find their documents gone (review).
            listOf(serverPage, homePage, backgroundPage).forEach { it.close() }
            listOf(server, home, background).forEach {
                WebViewCompat.removeWebMessageListener(it, BRIDGE_NAME)
                it.stopLoading()
                root.removeView(it)
                it.destroy()
            }
        }
        super.onDestroy()
    }
}

/** The server WebView's file inputs get the system chooser. */
private class ServerChromeClient(private val pickers: Pickers) : android.webkit.WebChromeClient() {
    override fun onShowFileChooser(
        view: WebView,
        callback: android.webkit.ValueCallback<Array<android.net.Uri>>,
        params: FileChooserParams,
    ): Boolean = pickers.choose(callback, params)
}

/**
 * The app is drawn edge to edge (target SDK 35+): its pages keep clear of
 * the status and navigation bars, the display cutout and the keyboard.
 */
fun keepClearOfSystemBars(view: View) {
    ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
        val types = WindowInsetsCompat.Type.systemBars() or
            WindowInsetsCompat.Type.displayCutout() or
            WindowInsetsCompat.Type.ime()
        val bars = insets.getInsets(types)
        v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
        WindowInsetsCompat.CONSUMED
    }
}
