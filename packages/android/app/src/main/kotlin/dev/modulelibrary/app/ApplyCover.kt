package dev.modulelibrary.app

import android.app.Activity
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import dev.modulelibrary.app.core.WebUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** The longest the app applies out of sight (APPLY_MAX_MS in native-api.ts). */
private const val APPLY_MAX_MS = 4 * 60_000L
private const val BAR_PCT = 90

/** What applying out of sight needs from the activity. */
interface ApplyHost {
    /** The server WebView goes to `url`: the server's /join once done. */
    fun loadInServer(url: String)

    fun home()

    /** The saved server id whose origin this is. */
    fun serverOf(origin: String): String?
}

/**
 * Applying a launch's changes out of sight (Android plan, phase 7): our
 * running page has joined as the Gamemaster; this covers the server WebView
 * with the launching screen's look while /game loads behind it and the
 * companion applies the changes, until the game page says done or the time
 * runs out; then /join, our running page, again. Main thread only.
 */
class ApplyController(
    private val activity: Activity,
    private val root: FrameLayout,
    private val scope: CoroutineScope,
    private val host: ApplyHost,
) {
    private var origin: String? = null
    private var cover: View? = null
    private var timeout: Job? = null

    val showing: Boolean get() = origin != null

    /** Whether `url` is the game page the app is applying on: it may load. */
    fun allowsGame(url: String): Boolean = origin != null && WebUrl.parse(url)?.origin == origin

    fun start(origin: String, world: String, changes: Int) {
        finishQuietly()
        this.origin = origin
        val shown = coverView(world, changes)
        cover = shown
        root.addView(shown, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        timeout = scope.launch {
            delay(APPLY_MAX_MS)
            done(origin)
        }
    }

    /** The game page said done (or the time ran out, or Back): /join again. */
    fun done(origin: String) {
        if (origin != this.origin) return
        finishQuietly()
        host.serverOf(origin)?.let { host.loadInServer("$it/join") }
    }

    /** Back while applying: our running page, which says what happened. */
    fun back() {
        origin?.let(::done)
    }

    private fun finishQuietly() {
        timeout?.cancel()
        timeout = null
        cover?.let { root.removeView(it) }
        cover = null
        origin = null
    }

    private fun coverView(world: String, changes: Int): View = FrameLayout(activity).apply {
        setBackgroundColor(Look.GROUND)
        isClickable = true
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        addView(column(world, changes), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    }

    private fun column(world: String, changes: Int): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        val pad = Look.dp(activity, 18f)
        setPadding(pad, Look.dp(activity, 56f), pad, Look.dp(activity, 12f))
        val chip = Look.text(activity, 12f, 0xFFFFD9A6.toInt(), bold = true).apply {
            text = activity.getString(R.string.apply_chip).uppercase()
            letterSpacing = 0.06f
            background = Look.rounded(activity, 0xB3462C0C.toInt(), 999f)
            setPadding(Look.dp(activity, 10f), Look.dp(activity, 4f), Look.dp(activity, 10f), Look.dp(activity, 4f))
        }
        addView(chip, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        val title = Look.text(activity, 34f, Look.INK, bold = true).apply {
            text = world.uppercase()
            typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
            isAccessibilityHeading = true
        }
        addView(title, spaced(top = 18f))
        addView(bar(), LinearLayout.LayoutParams(MATCH_PARENT, Look.dp(activity, 8f)).apply { topMargin = Look.dp(activity, 18f) })
        addView(steps(changes), spaced(top = 18f))
        addView(View(activity), LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
        val servers = Look.plain(activity, activity.getString(R.string.apply_servers)).apply { setOnClickListener { host.home() } }
        addView(servers, spaced(top = 8f))
    }

    private fun bar(): ProgressBar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
        max = 100
        progress = BAR_PCT
        progressTintList = android.content.res.ColorStateList.valueOf(Look.WARM)
        progressBackgroundTintList = android.content.res.ColorStateList.valueOf(0xFF2B2538.toInt())
    }

    private fun steps(changes: Int): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        listOf(R.string.apply_step_ask, R.string.apply_step_load, R.string.apply_step_join).forEach {
            addView(step(activity.getString(it), done = true), spaced(top = 10f))
        }
        val applying = activity.resources.getQuantityString(R.plurals.apply_step_apply, changes, changes)
        addView(step(applying, done = false), spaced(top = 10f))
        val sub = Look.text(activity, 13f, Look.DIM).apply {
            text = activity.getString(R.string.apply_sub)
            setPadding(Look.dp(activity, 32f), 0, 0, 0)
        }
        addView(sub, spaced(top = 4f))
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }

    private fun step(label: String, done: Boolean): View = LinearLayout(activity).apply {
        gravity = Gravity.CENTER_VERTICAL
        val dot = Look.text(activity, 12f, if (done) 0xFF6FDC8C.toInt() else Look.WARM, bold = true).apply {
            text = if (done) "✓" else "●"
            gravity = Gravity.CENTER
            background = Look.rounded(activity, if (done) 0xFF1F3A28.toInt() else 0, 999f, if (done) 0x996FDC8C.toInt() else Look.WARM)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        addView(dot, LinearLayout.LayoutParams(Look.dp(activity, 22f), Look.dp(activity, 22f)))
        val text = Look.text(activity, 15f, if (done) Look.INK else Look.WARM_LIGHT, bold = !done).apply { this.text = label }
        addView(text, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginStart = Look.dp(activity, 10f) })
    }

    private fun spaced(top: Float) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
        topMargin = Look.dp(activity, top)
    }
}
