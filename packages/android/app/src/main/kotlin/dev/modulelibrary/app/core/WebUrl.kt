package dev.modulelibrary.app.core

import java.net.URI
import java.net.URISyntaxException
import java.util.Locale

private const val MAX_PORT = 65_535

/**
 * An http(s) URL's parts as the app compares them. Native reads URLs that
 * WebView has already put in canonical form (its committed navigations), so
 * java.net.URI is enough; whatever it can't read is refused.
 */
data class WebUrl(val scheme: String, val host: String, val port: Int, val rawPath: String, val userInfo: String?) {
    /** scheme://host[:port], the default port left out (as a browser's origin). */
    val origin: String
        get() {
            val default = if (scheme == "https") 443 else 80
            val shownPort = if (port == -1 || port == default) "" else ":$port"
            return "$scheme://$host$shownPort"
        }

    companion object {
        fun parse(text: String): WebUrl? {
            val uri = try {
                URI(text)
            } catch (_: URISyntaxException) {
                return null
            }
            val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return null
            if (scheme != "http" && scheme != "https") return null
            val host = uri.host?.lowercase(Locale.ROOT)?.takeIf { it.isNotEmpty() } ?: return null
            // A browser refuses ports past 65535 (java.net.URI doesn't): review.
            if (uri.port !in -1..MAX_PORT) return null
            val path = uri.rawPath.orEmpty().ifEmpty { "/" }
            return WebUrl(scheme, host, uri.port, path, uri.rawUserInfo)
        }
    }
}
