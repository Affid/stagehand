package dev.modulelibrary.app.core

/** What native asks of the screen: pickers, dialogs, links, the home screen. */
interface NativeUi {
    /** Saves through the system file picker; returns once saved (or cancelled). */
    suspend fun saveFile(fileName: String, text: String)

    /** The text of the file the user picked, or null. */
    suspend fun openFile(): String?

    /** A native yes or no; `server` names the server asking. */
    suspend fun confirm(question: String, server: String): Boolean

    /**
     * A password in a native field that password managers fill for `origin`
     * (the asking page's server), or null when cancelled.
     */
    suspend fun askPassword(ask: PasswordAsk, origin: String): String?

    /** The app applies a launch's changes out of sight on `server` (its cover shows, its /game may load). */
    fun applyStarted(server: String, title: String, changes: Int)

    /** `server`'s game page says the changes are applied (or not): the cover goes, /join again. */
    fun applyDone(server: String, ok: Boolean)

    fun openExternal(url: String)

    fun showHome()
}

/** The server WebView's injection: told whenever saved origins or scripts change. */
fun interface ScriptHost {
    fun serversChanged(state: NativeState)
}

/** NativeFetch: a URL's body, or an error. */
fun interface Fetcher {
    suspend fun fetch(url: String): String
}

/** Why a page wants a password; native writes the words, never the page. */
enum class PasswordPurpose { CLOSE, JOIN }

/** A page's password question: its purpose, the world, the user to join as, who is in, a retry. */
data class PasswordAsk(
    val purpose: PasswordPurpose,
    val world: String,
    val user: String?,
    val people: Int,
    val wrong: Boolean,
)
