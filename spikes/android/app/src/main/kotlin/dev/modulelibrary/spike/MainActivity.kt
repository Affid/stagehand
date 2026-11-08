package dev.modulelibrary.spike

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Phase 0 spike (docs/ANDROID-APP-PLAN.md): loads one Foundry server, adds
 * probe.js before the page's own scripts, and logs what the probe reports
 * under the tag MLSPIKE (`adb logcat -s MLSPIKE`). Throwaway code.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra("url") ?: DEFAULT_URL
        status = TextView(this).apply { setPadding(16, 8, 16, 8); textSize = 11f }
        web = WebView(this)
        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(status)
                addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
            },
        )
        report("webview ${WebViewCompat.getCurrentWebViewPackage(this)?.versionName}")
        configure(web)
        val origin = originOf(url)
        val docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        val listener = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
        report("features docStart=$docStart listener=$listener origin=$origin")
        // Phase 3 preview (spikes/android/preview): the new Setup page with
        // native played inside the page; else the phase 0 probe.
        val preview = assets.list("")?.contains("preview.js") == true
        if (listener && !preview) addListener(origin)
        if (docStart) {
            val script = if (preview) "preview.js" else "probe.js"
            val code = assets.open(script).bufferedReader().use { it.readText() }
            WebViewCompat.addDocumentStartJavaScript(web, code, setOf(origin))
        }
        if (preview) status.visibility = android.view.View.GONE
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (web.canGoBack()) web.goBack() else finish()
                }
            },
        )
        web.loadUrl(url)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(view: WebView) {
        WebView.setWebContentsDebuggingEnabled(true)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        CookieManager.getInstance().setAcceptCookie(true)
        // The page's confirm and alert dialogs (the preview's stand-ins).
        view.webChromeClient = android.webkit.WebChromeClient()
        view.webViewClient = object : WebViewClient() {
            override fun onPageFinished(v: WebView, u: String) = report("finished $u")
        }
    }

    private fun addListener(origin: String) {
        WebViewCompat.addWebMessageListener(web, "mlApp", setOf(origin)) { _, message, source, isMainFrame, reply ->
            val data = message.data ?: ""
            report("msg main=$isMainFrame from=$source $data")
            if (data.contains("\"kind\":\"start\"")) reply.postMessage("ack")
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    private fun report(line: String) {
        Log.i(TAG, line)
        runOnUiThread { status.text = line }
    }

    private fun originOf(url: String): String {
        val u = Uri.parse(url)
        val port = if (u.port == -1) "" else ":${u.port}"
        return "${u.scheme}://${u.host}$port"
    }

    private companion object {
        const val TAG = "MLSPIKE"
        const val DEFAULT_URL = "http://10.0.2.2:30000/setup"
    }
}
