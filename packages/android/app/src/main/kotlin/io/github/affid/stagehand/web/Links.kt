package io.github.affid.stagehand.web

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

/**
 * Opens an outside http(s) page in a Custom Tab (the user's browser), never
 * in the app's WebViews. Callers check the rule first (externalAllowed);
 * the scheme is checked again here, and no intent is parsed from the URL.
 */
fun openInBrowser(activity: Activity, url: String) {
    val uri = Uri.parse(url)
    if (uri.scheme != "https" && uri.scheme != "http") return
    try {
        CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity, uri)
    } catch (_: ActivityNotFoundException) {
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            // No browser on the phone: nothing to open it with.
        }
    }
}
