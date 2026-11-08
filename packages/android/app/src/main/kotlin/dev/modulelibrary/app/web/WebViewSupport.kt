package dev.modulelibrary.app.web

/** Foundry 14's pages need Chromium 146 or newer (Android spike, finding 1). */
const val FOUNDRY_MIN_CHROMIUM = 146

/** Whether this phone's Android System WebView can run the app. */
sealed interface Support {
    /** Everything the app needs. */
    data object Ok : Support

    /** The page runs, but Foundry wants a newer WebView; `major` if known. */
    data class Old(val major: Int?) : Support

    /** No document-start scripts or message listener: our page can't run. */
    data object Missing : Support
}

/** The number before the first dot of a WebView version name, if any. */
fun majorVersion(version: String): Int? = version.substringBefore('.').toIntOrNull()

fun webViewSupport(docStart: Boolean, listener: Boolean, version: String?): Support {
    if (!docStart || !listener) return Support.Missing
    val major = version?.let(::majorVersion)
    return if (major != null && major >= FOUNDRY_MIN_CHROMIUM) Support.Ok else Support.Old(major)
}
