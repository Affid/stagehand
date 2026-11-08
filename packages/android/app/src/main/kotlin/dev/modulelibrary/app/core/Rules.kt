package dev.modulelibrary.app.core

// The native rules (docs/ANDROID-APP-PLAN.md, "Native rules"), mirroring
// native-api.ts; ContractVectorsTest checks them against its answers.

/**
 * JavaScript's \s, which Java's differs from (it has U+0085 and lacks
 * U+FEFF): the contract's patterns are JavaScript's.
 */
private const val JS_SPACE = "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"

/** Paths refused before comparing: %, \, .., //, control characters. */
private val ODD_PATH = Regex("""%|\\|\.\.|//|\p{Cc}""")
/** The path of an http(s) URL as written. */
private val RAW_PATH = Regex("""^https?://[^/?#\\]*([^?#]*)""", RegexOption.IGNORE_CASE)
private val RELEASE_REST = Regex("[0-9A-Za-z.-]*")
private val HTTP_START = Regex("^https?://", RegexOption.IGNORE_CASE)

/** A server's match pattern: "http://host:port/" and a star. */
val SERVER_PATTERN = Regex("""https?://[^/*?#\\@$JS_SPACE]+/\*""")
/** A server id: origin and route prefix, no trailing slash. */
val SERVER_ID = Regex("""https?://[^/*?#\\@$JS_SPACE]+(/[^*?#\\$JS_SPACE%]*[^/*?#\\$JS_SPACE%])?""")

const val MAX_EXTERNAL_URL = 4096
private val NEVER_SERVERS = listOf(APP_HOST, "foundryvtt.com")

/** NativeFetch's rule: a release page while Release history is on, or the config. */
fun fetchAllowed(url: String, purpose: FetchPurpose, releaseHistoryAllowed: Boolean): Boolean {
    if (purpose == FetchPurpose.CONFIG) return url == REMOTE_CONFIG_URL
    if (!releaseHistoryAllowed || !url.startsWith(RELEASES_URL)) return false
    val rest = url.substring(RELEASES_URL.length)
    return RELEASE_REST.matches(rest) && !rest.contains("..")
}

/** True for `page` ("/setup") or below it on `server`, route prefix included. */
fun isServerPage(href: String, server: String, page: String): Boolean {
    val url = WebUrl.parse(href) ?: return false
    val serverUrl = WebUrl.parse(server) ?: return false
    val full = url.origin + url.rawPath
    if (full != server && !full.startsWith("$server/")) return false
    if (!server.startsWith(serverUrl.origin)) return false
    val path = url.rawPath.substring(server.length - serverUrl.origin.length)
    return path == page || path.startsWith("$page/")
}

/** A saved server's Setup or game page, with no odd path. */
fun mayAskAsServer(url: String, servers: Collection<String>): Boolean {
    val raw = RAW_PATH.find(url) ?: return false
    if (ODD_PATH.containsMatchIn(raw.groupValues[1])) return false
    val parsed = WebUrl.parse(url) ?: return false
    if (ODD_PATH.containsMatchIn(parsed.rawPath)) return false
    return servers.any { isServerPage(url, it, "/setup") || isServerPage(url, it, "/game") }
}

/** An outside link native opens: http(s), a host, no user info, not a server's. */
fun externalAllowed(url: String, serverOrigins: Collection<String>): Boolean {
    if (url.length > MAX_EXTERNAL_URL || !HTTP_START.containsMatchIn(url)) return false
    val parsed = WebUrl.parse(url) ?: return false
    if (parsed.userInfo != null) return false
    return parsed.origin !in serverOrigins
}

/** The origin a server's pattern allows, or null when it must not be saved. */
fun savableServerOrigin(pattern: String): String? {
    if (!SERVER_PATTERN.matches(pattern)) return null
    val url = WebUrl.parse(pattern.dropLast(1)) ?: return null
    if (url.userInfo != null) return null
    // A trailing dot names the same host (foundryvtt.com.): review.
    val host = url.host.removeSuffix(".")
    if (NEVER_SERVERS.any { host == it || host.endsWith(".$it") }) return null
    return url.origin
}

/** A page script as native adds it for one server (wrapForServer). */
fun wrapForServer(script: String, server: String): String =
    "(function (ML_APP_SERVER) {\n$script\n})(${jsonString(server)});\n"

/** A string as JavaScript's JSON.stringify writes it. */
fun jsonString(value: String): String = buildString {
    append('"')
    var i = 0
    while (i < value.length) {
        val c = value[i]
        when {
            c == '"' -> append("\\\"")
            c == '\\' -> append("\\\\")
            c == '\b' -> append("\\b")
            c == '\u000C' -> append("\\f")
            c == '\n' -> append("\\n")
            c == '\r' -> append("\\r")
            c == '\t' -> append("\\t")
            c < ' ' -> append("\\u%04x".format(c.code))
            c.isHighSurrogate() && i + 1 < value.length && value[i + 1].isLowSurrogate() -> {
                append(c).append(value[i + 1])
                i++
            }
            c.isSurrogate() -> append("\\u%04x".format(c.code))
            else -> append(c)
        }
        i++
    }
    append('"')
}
