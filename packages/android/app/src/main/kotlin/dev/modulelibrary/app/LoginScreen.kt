package dev.modulelibrary.app

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import dev.modulelibrary.app.core.WebUrl

/** Who the login is for, as the server's card on home shows it. */
data class LoginTarget(
    val server: String,
    /** The name given on home, or null for the address. */
    val name: String?,
)

/**
 * Our login screen (Android plan, phase 7; mockup design/app-screens, Log in),
 * native so that password managers fill it: the server's tile and name, its
 * address (Not encrypted on http), the administrator password, Log in, and
 * ‹ back to the servers. LoginController does the work.
 */
class LoginScreen(
    private val context: Context,
    private val target: LoginTarget,
    private val onBack: () -> Unit,
    private val onSubmit: (password: String, username: String?) -> Unit,
) {
    private val url = WebUrl.parse(target.server)
    private val host = target.server.removePrefix("${url?.scheme}://")
    private val origin = url?.origin ?: target.server
    private val username = ServerField(context, origin, password = false).apply {
        hint = context.getString(R.string.login_user)
        visibility = View.GONE
    }
    private val password = ServerField(context, origin, password = true).apply {
        hint = context.getString(R.string.login_password)
        imeOptions = EditorInfo.IME_ACTION_GO
        setOnEditorActionListener { _, action, _ -> (action == EditorInfo.IME_ACTION_GO).also { if (it) submit() } }
    }
    private val error = Look.error(context)
    private val go = Look.bright(context, context.getString(R.string.login_go)).apply { setOnClickListener { submit() } }

    val view: View = FrameLayout(context).apply {
        setBackgroundColor(Look.GROUND)
        isClickable = true
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
        addView(column(), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    }

    /** Foundry's form is known: a username field only when it wants one. */
    fun form(usernameRequired: Boolean) {
        username.visibility = if (usernameRequired) View.VISIBLE else View.GONE
        (if (usernameRequired) username else password).requestFocus()
    }

    fun busy(on: Boolean) {
        go.isEnabled = !on
        go.text = context.getString(if (on) R.string.login_busy else R.string.login_go)
    }

    fun error(text: String?) {
        error.text = text
        error.visibility = if (text == null) View.GONE else View.VISIBLE
        if (text != null) password.selectAll()
    }

    private fun submit() {
        if (!go.isEnabled) return
        val user = username.text.toString().takeIf { username.visibility == View.VISIBLE }
        onSubmit(password.text.toString(), user)
    }

    private fun column(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        addView(topBar(), LinearLayout.LayoutParams(MATCH_PARENT, Look.dp(context, 56f)))
        addView(ScrollView(context).apply { addView(body()) }, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
    }

    private fun topBar(): View = LinearLayout(context).apply {
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(0xE00B0A13.toInt())
        val back = ImageButton(context).apply {
            setImageResource(R.drawable.ic_back)
            setBackgroundColor(0)
            contentDescription = context.getString(R.string.login_servers)
            setOnClickListener { onBack() }
        }
        addView(back, LinearLayout.LayoutParams(Look.dp(context, 48f), Look.dp(context, 48f)))
        val title = Look.text(context, 21f, Look.INK, bold = true).apply {
            text = (target.name ?: host).uppercase()
            typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
            isSingleLine = true
        }
        addView(title, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
    }

    private fun body(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        val pad = Look.dp(context, 12f)
        setPadding(pad, Look.dp(context, 22f), pad, pad)
        addView(card(), LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        val hint = Look.text(context, 12.5f, Look.QUIET).apply {
            text = context.getString(R.string.login_hint)
            gravity = Gravity.CENTER
        }
        addView(hint, spaced(MATCH_PARENT, top = 14f))
    }

    private fun card(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        background = Look.rounded(context, Look.PANEL, 10f, Look.LINE)
        val pad = Look.dp(context, 16f)
        setPadding(pad, Look.dp(context, 22f), pad, Look.dp(context, 18f))
        val letter = (target.name ?: host).trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
        addView(Look.letterTile(context, letter, 56f), LinearLayout.LayoutParams(Look.dp(context, 56f), Look.dp(context, 56f)))
        addView(Look.heading(context, 25f).apply { text = context.getString(R.string.login_title) }, spaced(WRAP_CONTENT, top = 14f))
        addView(where(), spaced(WRAP_CONTENT, top = 6f))
        addView(username, spaced(MATCH_PARENT, top = 16f))
        addView(label(), spaced(MATCH_PARENT, top = 14f))
        addView(password, spaced(MATCH_PARENT, top = 6f))
        addView(error, spaced(MATCH_PARENT, top = 12f))
        addView(go, spaced(MATCH_PARENT, top = 14f))
    }

    private fun where(): View = LinearLayout(context).apply {
        gravity = Gravity.CENTER_VERTICAL
        addView(Look.text(context, 13f, Look.DIM).apply { text = host })
        if (url?.scheme == "http") {
            val chip = Look.text(context, 11.5f, Look.PLAIN, bold = true).apply {
                text = context.getString(R.string.login_plain)
                background = Look.rounded(context, 0, 999f, 0x73E88A6A)
                setPadding(Look.dp(context, 8f), Look.dp(context, 2f), Look.dp(context, 8f), Look.dp(context, 2f))
            }
            addView(chip, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginStart = Look.dp(context, 10f) })
        }
    }

    private fun label(): TextView = Look.text(context, 12.5f, Look.DIM, bold = true).apply {
        text = context.getString(R.string.login_password)
        labelFor = password.id
    }

    private fun spaced(width: Int, top: Float) =
        LinearLayout.LayoutParams(width, WRAP_CONTENT).apply { topMargin = Look.dp(context, top) }
}
