package dev.modulelibrary.app.core

/** What native asks of the screen: pickers, dialogs, links, the home screen. */
interface NativeUi {
    /** Saves through the system file picker; returns once saved (or cancelled). */
    suspend fun saveFile(fileName: String, text: String)

    /** The text of the file the user picked, or null. */
    suspend fun openFile(): String?

    /** A native yes or no; `server` names the server asking. */
    suspend fun confirm(question: String, server: String): Boolean

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
