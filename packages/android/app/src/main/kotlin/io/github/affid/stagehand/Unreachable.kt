package io.github.affid.stagehand

import android.app.Activity
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ScrollView
import io.github.affid.stagehand.core.WebUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** What the unreachable screen needs from the activity. */
interface UnreachableHost {
    /** The server's Setup, loaded again in the server WebView. */
    fun tryServerAgain(server: String)

    /** The server list. */
    fun home()

    /** The name home gave the server, or null. */
    suspend fun serverName(server: String): String?
}

/**
 * Our screen in place of Chromium's "Web page not available" (owner,
 * 2026-11-11): a saved server's page didn't load, or Foundry's page gave up
 * reconnecting and left for /no. It covers the server WebView until a page
 * of the server loads again; Try again asks for the server's Setup, ‹ goes
 * to the server list. Main thread only.
 */
class UnreachableController(
    private val activity: Activity,
    private val root: FrameLayout,
    private val scope: CoroutineScope,
    private val host: UnreachableHost,
) {
    private var server: String? = null
    private var screen: UnreachableScreen? = null
    private var naming: Job? = null

    /** From the moment the screen is asked for, so Back is ours meanwhile. */
    val showing: Boolean get() = server != null

    /** Shows the screen for `server`; a try that failed makes it ready for another. */
    fun show(server: String) {
        if (this.server == server) {
            screen?.busy(false)
            return
        }
        hide()
        this.server = server
        naming = scope.launch {
            val name = host.serverName(server)
            if (this@UnreachableController.server != server) return@launch
            val shown = UnreachableScreen(activity, server, name, onBack = ::back, onRetry = ::retry)
            screen = shown
            root.addView(shown.view, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        }
    }

    fun hide() {
        naming?.cancel()
        naming = null
        screen?.let { root.removeView(it.view) }
        screen = null
        server = null
    }

    /** Try again, and the app coming back to the front: the server's Setup once more. */
    fun retry() {
        val server = server ?: return
        val shown = screen ?: return
        if (shown.busy) return
        shown.busy(true)
        host.tryServerAgain(server)
    }

    /** ‹ or Android's Back: the server list. */
    fun back() {
        hide()
        host.home()
    }
}

/** The unreachable screen's views, in the login screen's layout: a top bar and one card. */
private class UnreachableScreen(
    private val activity: Activity,
    server: String,
    name: String?,
    private val onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    private val address = server.removePrefix("${WebUrl.parse(server)?.scheme}://")
    private val label = name ?: address
    private val again = Look.bright(activity, activity.getString(R.string.lost_again)).apply { setOnClickListener { onRetry() } }

    var busy = false
        private set

    val view: View = FrameLayout(activity).apply {
        setBackgroundColor(Look.GROUND)
        isClickable = true
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        addView(column(), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    }

    fun busy(on: Boolean) {
        busy = on
        again.isEnabled = !on
        again.text = activity.getString(if (on) R.string.lost_busy else R.string.lost_again)
    }

    private fun column(): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        addView(topBar(), LinearLayout.LayoutParams(MATCH_PARENT, Look.dp(activity, 56f)))
        addView(ScrollView(activity).apply { addView(body()) }, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
    }

    private fun topBar(): View = LinearLayout(activity).apply {
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(0xE00B0A13.toInt())
        val back = ImageButton(activity).apply {
            setImageResource(R.drawable.ic_back)
            setBackgroundColor(0)
            contentDescription = activity.getString(R.string.login_servers)
            setOnClickListener { onBack() }
        }
        addView(back, LinearLayout.LayoutParams(Look.dp(activity, 48f), Look.dp(activity, 48f)))
        val title = Look.text(activity, 21f, Look.INK, bold = true).apply {
            text = label.uppercase()
            typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
            isSingleLine = true
        }
        addView(title, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
    }

    private fun body(): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        val pad = Look.dp(activity, 12f)
        setPadding(pad, Look.dp(activity, 22f), pad, pad)
        addView(card(), LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private fun card(): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        background = Look.rounded(activity, Look.PANEL, 10f, Look.LINE)
        val pad = Look.dp(activity, 16f)
        setPadding(pad, Look.dp(activity, 22f), pad, Look.dp(activity, 18f))
        val letter = label.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
        addView(Look.letterTile(activity, letter, 56f), LinearLayout.LayoutParams(Look.dp(activity, 56f), Look.dp(activity, 56f)))
        val title = Look.heading(activity, 25f).apply {
            text = activity.getString(R.string.lost_title)
            gravity = Gravity.CENTER
            isAccessibilityHeading = true
        }
        addView(title, spaced(WRAP_CONTENT, top = 14f))
        addView(Look.text(activity, 13f, Look.DIM).apply { text = address }, spaced(WRAP_CONTENT, top = 6f))
        val text = Look.text(activity, 14.5f, Look.DIM).apply {
            text = activity.getString(R.string.lost_body)
            gravity = Gravity.CENTER
        }
        addView(text, spaced(MATCH_PARENT, top = 14f))
        addView(again, spaced(MATCH_PARENT, top = 18f))
    }

    private fun spaced(width: Int, top: Float) =
        LinearLayout.LayoutParams(width, WRAP_CONTENT).apply { topMargin = Look.dp(activity, top) }
}
