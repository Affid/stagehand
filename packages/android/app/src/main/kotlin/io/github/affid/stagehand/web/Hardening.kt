package io.github.affid.stagehand.web

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView

/**
 * Every WebView of the app (plan, "Security"): JavaScript and DOM storage
 * on; file and content access off; no mixed content; one window (a new-tab
 * link becomes a navigation the client decides on); Safe Browsing; no
 * geolocation; no third-party cookies. No addJavascriptInterface anywhere.
 */
@SuppressLint("SetJavaScriptEnabled")
fun harden(view: WebView) {
    view.settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        allowFileAccess = false
        allowContentAccess = false
        mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        setSupportMultipleWindows(false)
        javaScriptCanOpenWindowsAutomatically = false
        setGeolocationEnabled(false)
        safeBrowsingEnabled = true
    }
    CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
}
