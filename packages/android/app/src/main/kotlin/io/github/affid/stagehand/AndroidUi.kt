package io.github.affid.stagehand

import android.app.AlertDialog
import io.github.affid.stagehand.core.NativeUi
import io.github.affid.stagehand.core.PasswordAsk
import io.github.affid.stagehand.core.plainQuestion
import io.github.affid.stagehand.core.safeFileName
import io.github.affid.stagehand.core.serverLabel
import io.github.affid.stagehand.core.shortLabel
import io.github.affid.stagehand.web.openInBrowser
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Native's screen work for the pages' requests: the system file pickers,
 * a native yes-or-no naming the app and the server, Custom Tabs, home.
 * The handlers have already checked the rules (one dialog at a time, the
 * link rule and a recent tap).
 */
class AndroidUi(private val activity: MainActivity, private val pickers: Pickers) : NativeUi {
    override suspend fun saveFile(fileName: String, text: String) = pickers.saveText(safeFileName(fileName), text)

    override suspend fun openFile(): String? = pickers.openText()

    override suspend fun confirm(question: String, server: String): Boolean = suspendCancellableCoroutine { cont ->
        if (activity.isFinishing || activity.isDestroyed) {
            cont.resume(false)
            return@suspendCancellableCoroutine
        }
        val title = activity.getString(R.string.confirm_title, shortLabel(server))
        var answered = false
        val answer = { yes: Boolean ->
            if (!answered) {
                answered = true
                cont.resume(yes)
            }
        }
        val dialog = AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(plainQuestion(question))
            .setPositiveButton(android.R.string.ok) { _, _ -> answer(true) }
            .setNegativeButton(android.R.string.cancel) { _, _ -> answer(false) }
            .setOnDismissListener { answer(false) }
            .show()
        // Cancellation can come from another thread; the dialog is the UI's.
        cont.invokeOnCancellation { activity.runOnUiThread { dialog.dismiss() } }
    }

    override fun applyStarted(server: String, title: String, changes: Int) = activity.applyStarted(server, title, changes)

    override fun applyDone(server: String, ok: Boolean) = activity.applyDone(server)

    override suspend fun askPassword(ask: PasswordAsk, origin: String): String? =
        PasswordSheet(activity, origin, shortLabel(serverLabel(origin))).ask(ask)

    override fun openExternal(url: String) = openInBrowser(activity, url)

    override fun showHome() = activity.showSettings()
}
