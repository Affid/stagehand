package dev.modulelibrary.app

import android.app.Activity
import android.view.autofill.AutofillManager
import android.webkit.CookieManager
import android.widget.FrameLayout
import dev.modulelibrary.app.core.AdminLogin
import dev.modulelibrary.app.core.LoginPage
import dev.modulelibrary.app.core.LoginResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.IOException

/** What our login needs from the activity. */
interface LoginHost {
    /** The server WebView goes to `url` (its Setup once logged in, or where Foundry sent us). */
    fun loadInServer(url: String)

    /** The server list. */
    fun home()

    /** The server WebView offered to password managers or not (our field is, while it shows). */
    fun serverAutofill(on: Boolean)

    /** The name home gave the server, or null. */
    suspend fun serverName(server: String): String?
}

/**
 * Our login in place of Foundry's /auth (Android plan, phase 7): shows the
 * native screen over the server WebView, reads Foundry's form, posts the
 * password natively (AdminLogin), hands Foundry's session cookie to the
 * WebView, and opens Setup. Main thread only.
 */
class LoginController(
    private val activity: Activity,
    private val root: FrameLayout,
    private val scope: CoroutineScope,
    private val host: LoginHost,
    private val login: AdminLogin = AdminLogin(),
) {
    private var screen: LoginScreen? = null
    private var server: String? = null
    private var usernameRequired = false
    private var work: Job? = null

    val showing: Boolean get() = screen != null

    fun show(server: String) {
        if (this.server == server && screen != null) return
        hide()
        this.server = server
        work = scope.launch {
            val name = host.serverName(server)
            if (this@LoginController.server != server) return@launch
            val shown = LoginScreen(activity, LoginTarget(server, name), onBack = ::back, onSubmit = ::submit)
            screen = shown
            root.addView(shown.view, FrameLayout.LayoutParams(-1, -1))
            host.serverAutofill(false)
            readForm(server, shown)
        }
    }

    fun hide() {
        work?.cancel()
        work = null
        screen?.let { root.removeView(it.view) }
        screen = null
        server = null
        host.serverAutofill(true)
    }

    /** ‹ or Android's Back: the server list. */
    fun back() {
        hide()
        host.home()
    }

    private suspend fun readForm(server: String, shown: LoginScreen) {
        val page = try {
            login.page(server, CookieManager.getInstance().getCookie(server))
        } catch (_: IOException) {
            shown.form(usernameRequired = false)
            shown.error(activity.getString(R.string.login_failed))
            return
        }
        when (page) {
            is LoginPage.Form -> {
                usernameRequired = page.usernameRequired
                shown.form(page.usernameRequired)
            }
            is LoginPage.Elsewhere -> leaveFor(page.url)
        }
    }

    private fun submit(password: String, username: String?) {
        val server = server ?: return
        val shown = screen ?: return
        shown.busy(true)
        shown.error(null)
        work = scope.launch {
            val cookies = CookieManager.getInstance()
            val answer = login.logIn(server, cookies.getCookie(server), password, username)
            answer.cookies.forEach { cookies.setCookie(server, it) }
            cookies.flush()
            shown.busy(false)
            when (val result = answer.result) {
                LoginResult.Setup -> {
                    // Password managers offer to save what was typed.
                    activity.getSystemService(AutofillManager::class.java)?.commit()
                    leaveFor("$server/setup")
                }
                LoginResult.Wrong -> shown.error(
                    activity.getString(if (usernameRequired) R.string.login_wrong_user else R.string.login_wrong),
                )
                is LoginResult.Elsewhere -> leaveFor(result.url)
                is LoginResult.Failed -> shown.error(activity.getString(R.string.login_failed))
            }
        }
    }

    private fun leaveFor(url: String) {
        hide()
        host.loadInServer(url)
    }
}
