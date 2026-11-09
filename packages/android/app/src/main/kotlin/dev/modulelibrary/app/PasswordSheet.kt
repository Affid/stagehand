package dev.modulelibrary.app

import android.app.Activity
import android.app.Dialog
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.widget.TextView
import dev.modulelibrary.app.core.PasswordAsk
import dev.modulelibrary.app.core.PasswordPurpose
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/** A sheet's words, written natively from the page's purpose (never the page's text). */
private data class SheetWords(val title: String, val text: String, val label: String, val go: String, val wrong: String, val hint: String?)

private fun words(activity: Activity, ask: PasswordAsk): SheetWords = when (ask.purpose) {
    PasswordPurpose.CLOSE -> SheetWords(
        title = activity.getString(R.string.pw_close_title, ask.world),
        text = if (ask.people > 0) {
            activity.resources.getQuantityString(R.plurals.pw_close_people, ask.people, ask.people)
        } else {
            activity.getString(R.string.pw_close_text)
        },
        label = activity.getString(R.string.pw_close_label),
        go = activity.getString(R.string.pw_close_go),
        wrong = activity.getString(R.string.pw_close_wrong),
        hint = null,
    )
    PasswordPurpose.JOIN -> {
        val user = ask.user ?: "Gamemaster"
        SheetWords(
            title = activity.getString(R.string.pw_join_title, user),
            text = activity.getString(R.string.pw_join_text, user, ask.world),
            label = activity.getString(R.string.pw_join_label, user),
            go = activity.getString(R.string.pw_join_go),
            wrong = activity.getString(R.string.pw_join_wrong, user),
            hint = activity.getString(R.string.pw_join_hint),
        )
    }
}

/**
 * A page's password question as a native sheet from the bottom (Android
 * plan, phase 7; mockup design/app-screens, Running's Close sheet): its
 * field is a ServerField, so password managers fill it for the server.
 * Answers the password, or null when cancelled.
 */
class PasswordSheet(private val activity: Activity, private val origin: String, private val serverLabel: String) {
    suspend fun ask(ask: PasswordAsk): String? = suspendCancellableCoroutine { cont ->
        if (activity.isFinishing || activity.isDestroyed) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        var answered = false
        val answer = { value: String? ->
            if (!answered) {
                answered = true
                cont.resume(value)
            }
        }
        val dialog = Dialog(activity)
        val field = ServerField(activity, origin, password = true)
        dialog.setContentView(content(words(activity, ask), ask.wrong, field, dialog, answer))
        dialog.setOnDismissListener { answer(null) }
        place(dialog)
        dialog.show()
        field.requestFocus()
        cont.invokeOnCancellation { activity.runOnUiThread { dialog.dismiss() } }
    }

    private fun place(dialog: Dialog) {
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(0))
            setGravity(Gravity.BOTTOM)
            setLayout(MATCH_PARENT, WRAP_CONTENT)
            setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    private fun content(
        w: SheetWords,
        wrong: Boolean,
        field: ServerField,
        dialog: Dialog,
        answer: (String?) -> Unit,
    ): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
        val radius = Look.dp(activity, 16f).toFloat()
        background = GradientDrawable().apply {
            setColor(Look.PANEL)
            cornerRadii = floatArrayOf(radius, radius, radius, radius, 0f, 0f, 0f, 0f)
        }
        val pad = Look.dp(activity, 16f)
        setPadding(pad, Look.dp(activity, 18f), pad, pad)
        val submit = { answer(field.text.toString()).also { dialog.dismiss() } }
        addView(Look.text(activity, 12f, Look.QUIET).apply { text = serverLabel })
        addView(Look.heading(activity, 21f).apply { text = w.title }, spaced(top = 4f))
        addView(Look.text(activity, 13.5f, Look.DIM).apply { text = w.text }, spaced(top = 10f))
        addView(label(w.label, field), spaced(top = 14f))
        field.hint = w.hint ?: w.label
        field.imeOptions = EditorInfo.IME_ACTION_DONE
        field.setOnEditorActionListener { _, action, _ -> (action == EditorInfo.IME_ACTION_DONE).also { if (it) submit() } }
        addView(field, spaced(top = 6f))
        if (wrong) addView(Look.error(activity).apply { text = w.wrong; visibility = View.VISIBLE }, spaced(top = 10f))
        addView(Look.bright(activity, w.go).apply { setOnClickListener { submit() } }, spaced(top = 14f))
        val cancel = Look.plain(activity, activity.getString(R.string.pw_cancel)).apply {
            background = null
            setOnClickListener { dialog.dismiss() }
        }
        addView(cancel, spaced(top = 6f))
    }

    private fun label(text: String, field: ServerField): TextView = Look.text(activity, 12.5f, Look.DIM, bold = true).apply {
        this.text = text
        labelFor = field.id
    }

    private fun spaced(top: Float) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
        topMargin = Look.dp(activity, top)
    }
}
