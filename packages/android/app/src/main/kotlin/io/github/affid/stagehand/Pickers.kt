package io.github.affid.stagehand

import android.net.Uri
import android.os.SystemClock
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import io.github.affid.stagehand.core.MAX_MESSAGE_CHARS
import io.github.affid.stagehand.core.RequestRefused
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.InputStreamReader

/** The largest file the app opens: its text must still fit a bridge message. */
private const val MAX_FILE_CHARS = MAX_MESSAGE_CHARS * 3 / 4
/** After a picker closes, a page can't open the next one at once. */
private const val PICKER_GAP_MS = 2_000L

/**
 * The system file pickers (Storage Access Framework), one at a time: a
 * library export saves through "Save to", an import opens a file, and
 * Foundry's own file inputs get the system chooser. The page's file name
 * is only a suggestion; the app writes only where the user chose.
 *
 * A picker counts as open until Android returns its result, even when the
 * request that opened it is gone (review): its result then goes nowhere,
 * and no later request can take it. After the activity is made again
 * (rotation is handled without that; process death), a result comes to a
 * new Pickers with nobody waiting and is dropped, which reads as cancelled.
 */
class Pickers(private val activity: ComponentActivity) {
    private var waiting: CompletableDeferred<Uri?>? = null
    private var choosing: ValueCallback<Array<Uri>>? = null
    private var open = false
    private var closedAt = Long.MIN_VALUE / 2

    private fun closed(uri: Uri?) {
        open = false
        closedAt = SystemClock.elapsedRealtime()
        waiting?.complete(uri)
        waiting = null
    }

    private val createDoc = activity.registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) {
        closed(it)
    }
    private val openDoc = activity.registerForActivityResult(ActivityResultContracts.OpenDocument()) { closed(it) }
    private val chooser = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        // Only content the user picked through a provider, never a file path.
        val picked = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            ?.filter { it.scheme == "content" }?.toTypedArray()
        choosing?.onReceiveValue(picked?.takeIf { it.isNotEmpty() })
        choosing = null
        closed(null)
    }

    private fun mayOpen(): Boolean = !open && SystemClock.elapsedRealtime() - closedAt >= PICKER_GAP_MS

    private suspend fun pick(launch: () -> Unit): Uri? {
        if (!mayOpen()) throw RequestRefused("A file picker is open or just closed")
        val wait = CompletableDeferred<Uri?>()
        waiting = wait
        open = true
        try {
            launch()
        } catch (e: android.content.ActivityNotFoundException) {
            closed(null)
            throw RequestRefused("No file picker on this phone")
        }
        return wait.await()
    }

    /** Saves `text` where the user picks; returns once saved or cancelled. */
    suspend fun saveText(fileName: String, text: String) {
        val uri = pick { createDoc.launch(fileName) } ?: return
        withContext(Dispatchers.IO) {
            try {
                val out = activity.contentResolver.openOutputStream(uri, "wt") ?: throw IOException("no stream")
                out.use { it.write(text.toByteArray(Charsets.UTF_8)) }
            } catch (_: IOException) {
                throw RequestRefused("Couldn't save the file")
            } catch (_: SecurityException) {
                throw RequestRefused("Couldn't save the file")
            }
        }
    }

    /** The text of the file the user picks, or null when they pick none. */
    suspend fun openText(): String? {
        val uri = pick { openDoc.launch(arrayOf("application/json", "text/*", "application/octet-stream")) } ?: return null
        return withContext(Dispatchers.IO) {
            try {
                readCapped(uri)
            } catch (_: IOException) {
                throw RequestRefused("Couldn't read the file")
            } catch (_: SecurityException) {
                throw RequestRefused("Couldn't read the file")
            }
        }
    }

    private fun readCapped(uri: Uri): String {
        val input = activity.contentResolver.openInputStream(uri) ?: throw IOException("no stream")
        InputStreamReader(input, Charsets.UTF_8).use { reader ->
            val out = StringBuilder()
            val buf = CharArray(8192)
            while (true) {
                val n = reader.read(buf)
                if (n < 0) return out.toString()
                out.appendRange(buf, 0, n)
                if (out.length > MAX_FILE_CHARS) throw RequestRefused("The file is too large to open")
            }
        }
    }

    /** Foundry's own file input: the system chooser; false (cancelled) if a picker is open. */
    fun choose(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        if (!mayOpen()) return false
        choosing = callback
        open = true
        try {
            chooser.launch(params.createIntent())
        } catch (_: android.content.ActivityNotFoundException) {
            choosing = null
            callback.onReceiveValue(null)
            closed(null)
        }
        return true
    }

    /** The activity is going: a page's file input waiting on a chooser gets "none". */
    fun release() {
        choosing?.onReceiveValue(null)
        choosing = null
    }
}
