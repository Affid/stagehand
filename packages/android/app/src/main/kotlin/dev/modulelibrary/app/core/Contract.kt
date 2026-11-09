package dev.modulelibrary.app.core

// The contract with the app's pages (packages/extension/src/app/native-api.ts,
// native-requests.ts and bridge.ts): names, limits and who may ask what.

/** The app's own pages, served by WebViewAssetLoader. */
const val APP_HOST = "appassets.androidplatform.net"
const val APP_ORIGIN = "https://$APP_HOST"
const val APP_URL = "$APP_ORIGIN/"
/** Attached to every message native relays (RouterDeps.extensionId). */
const val APP_ID = "module-library-app"
const val BACKGROUND_PAGE = "${APP_URL}background.html"
const val HOME_PAGE = "${APP_URL}home.html"

/** The name WebView gives the bridge object. */
const val BRIDGE_NAME = "mlApp"
const val WIRE_VERSION = 1
const val MAX_MESSAGE_CHARS = 8_000_000

/** Native's request to a server's Setup page: Android's Back, answered {handled}. */
const val BACK = "back"
const val READY = "background.ready"
const val ROUTE = "route"
/** How long native waits for the background's answer to `route`. */
const val ROUTE_TIMEOUT_MS = 120_000L

/** NativeFetch's limits. */
const val FETCH_MAX_CHARS = 2_000_000
const val FETCH_TIMEOUT_MS = 15_000
/** server.check's limits: a status answer is a few dozen characters. */
const val STATUS_MAX_CHARS = 64_000
const val STATUS_TIMEOUT_MS = 5_000
/** Longer than any Foundry version. */
const val MAX_VERSION = 40

const val RELEASES_URL = "https://foundryvtt.com/releases/"
const val REMOTE_CONFIG_URL =
    "https://raw.githubusercontent.com/Affid/module-library/main/config/setup-config.json"
/** Release history's switch, as a match pattern. */
const val FOUNDRY_PATTERN = "https://foundryvtt.com/*"

/** Which of the app's WebViews a message came from. */
enum class Caller { SERVER, RUNNING, HOME, BACKGROUND }

/** Requests to native and who may make them (CALLER_REQUESTS). */
val CALLER_REQUESTS: Map<Caller, Set<String>> = mapOf(
    Caller.SERVER to setOf("runtime.send", "files.save", "files.open", "confirm", "openExternal", "password.ask"),
    // Our running page on a server's /join (phase 7): a password, nothing else.
    Caller.RUNNING to setOf("password.ask"),
    Caller.HOME to setOf(
        "runtime.send", "permissions.contains", "permissions.request", "permissions.remove", "server.check",
    ),
    Caller.BACKGROUND to setOf(
        "kv.get", "kv.set", "scripts.registered", "scripts.register", "scripts.unregister",
        "permissions.contains", "permissions.remove", "fetch", "home.open", READY,
    ),
)

enum class FetchPurpose(val wire: String) {
    RELEASE("release"),
    CONFIG("config"),
    ;

    companion object {
        fun of(wire: String): FetchPurpose? = entries.firstOrNull { it.wire == wire }
    }
}
