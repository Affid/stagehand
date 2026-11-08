package dev.modulelibrary.app.web

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import dev.modulelibrary.app.R

private const val WEBVIEW_PACKAGE = "com.google.android.webview"
private const val PREFS = "app"
private const val WARNED_KEY = "webviewWarnedFor"

/** This phone's WebView as webViewSupport() reads it, its version and package. */
data class WebViewState(val support: Support, val version: String?, val packageName: String)

fun currentSupport(context: Context): WebViewState {
    val pkg = WebViewCompat.getCurrentWebViewPackage(context)
    val support = webViewSupport(
        docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT),
        listener = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER),
        version = pkg?.versionName,
    )
    // The phone's own WebView package (not always Google's: review).
    return WebViewState(support, pkg?.versionName, pkg?.packageName ?: WEBVIEW_PACKAGE)
}

/**
 * Says what's wrong with the WebView, if anything, then calls `done(canRun)`.
 * An old WebView is mentioned once per version; a missing feature every time.
 */
fun showSupportNotice(activity: Activity, done: (canRun: Boolean) -> Unit) {
    val (support, version, pkg) = currentSupport(activity)
    val shown = version ?: activity.getString(R.string.webview_unknown)
    when (support) {
        Support.Ok -> done(true)
        Support.Missing -> AlertDialog.Builder(activity)
            .setTitle(R.string.webview_missing_title)
            .setMessage(activity.getString(R.string.webview_missing_body, shown))
            .setPositiveButton(R.string.webview_update) { _, _ -> openStore(activity, pkg) }
            .setNegativeButton(R.string.webview_continue) { _, _ -> done(false) }
            .setCancelable(false)
            .show()
        is Support.Old -> {
            val prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getString(WARNED_KEY, null) == shown) return done(true)
            // Remembered once answered: a phone closed on the notice sees it again.
            val answered = { prefs.edit().putString(WARNED_KEY, shown).apply() }
            AlertDialog.Builder(activity)
                .setTitle(R.string.webview_old_title)
                .setMessage(activity.getString(R.string.webview_old_body, FOUNDRY_MIN_CHROMIUM, shown))
                .setPositiveButton(R.string.webview_update) { _, _ ->
                    answered()
                    openStore(activity, pkg)
                    done(true)
                }
                .setNegativeButton(R.string.webview_continue) { _, _ ->
                    answered()
                    done(true)
                }
                .setCancelable(false)
                .show()
        }
    }
}

private fun openStore(activity: Activity, pkg: String) {
    val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
    try {
        activity.startActivity(market)
    } catch (_: ActivityNotFoundException) {
        val web = Uri.parse("https://play.google.com/store/apps/details?id=$pkg")
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, web))
        } catch (_: ActivityNotFoundException) {
            // No store and no browser: nothing more to offer.
        }
    }
}
