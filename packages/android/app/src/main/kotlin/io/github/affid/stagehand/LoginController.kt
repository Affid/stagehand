package io.github.affid.stagehand

import android.app.Activity
import android.view.WindowManager
import android.view.autofill.AutofillManager
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.widget.FrameLayout
import io.github.affid.stagehand.core.AdminLogin
import io.github.affid.stagehand.core.LoginPage
import io.github.affid.stagehand.core.LoginResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

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
 * WebView, and opens Setup. Main thread only. The form's read and the
 * login are separate jobs, and Log in waits for the form (review).
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
    private var reading: Job? = null
    private var submitting: Job? = null

    /** From the moment our login is asked for, so Back is ours meanwhile (review). */
    val showing: Boolean get() = server != null

    fun show(server: String) {
        if (this.server == server) return
        hide()
        this.server = server
        usernameRequired = false
        reading = scope.launch {
            val name = host.serverName(server)
            if (this@LoginController.server != server) return@launch
            val shown = LoginScreen(activity, LoginTarget(server, name), onBack = ::back, onSubmit = ::submit)
            screen = shown
            root.addView(shown.view, FrameLayout.LayoutParams(-1, -1))
            // The typed password stays out of screenshots and the recents view
            // (release builds: the device suite's screenshots need debug's).
            if (!BuildConfig.DEBUG) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            host.serverAutofill(false)
            shown.busy(true)
            readForm(server, shown)
        }
    }

    fun hide() {
        val wasShowing = showing
        reading?.cancel()
        submitting?.cancel()
        reading = null
        submitting = null
        // The password's keyboard goes with the screen: left open, it would
        // take the next Back for itself (seen on the emulator).
        screen?.let { closeKeyboard(it.view) }
        screen?.let { root.removeView(it.view) }
        screen = null
        server = null
        if (wasShowing) {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            host.serverAutofill(true)
        }
    }

    /** ‹ or Android's Back: the server list. */
    fun back() {
        hide()
        host.home()
    }

    private suspend fun readForm(server: String, shown: LoginScreen) {
        val page = try {
            login.page(server, CookieManager.getInstance().getCookie(server))
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            shown.busy(false)
            shown.form(usernameRequired = false)
            shown.error(activity.getString(R.string.login_failed))
            return
        }
        when (page) {
            is LoginPage.Form -> {
                usernameRequired = page.usernameRequired
                shown.busy(false)
                shown.form(page.usernameRequired)
            }
            is LoginPage.Elsewhere -> leaveFor(page.url)
        }
    }

    private fun submit(password: String, username: String?) {
        val server = server ?: return
        val shown = screen ?: return
        if (password.isEmpty() || submitting?.isActive == true) return
        shown.busy(true)
        shown.error(null)
        submitting = scope.launch {
            val cookies = CookieManager.getInstance()
            val answer = login.logIn(server, cookies.getCookie(server), password, username)
            // As the server's own /auth answer would set them (route prefix: review).
            answer.cookies.forEach { cookies.setCookie("$server/auth", it) }
            cookies.flush()
            shown.busy(false)
            settle(server, shown, answer.result)
        }
    }

    private fun settle(server: String, shown: LoginScreen, result: LoginResult) {
        when (result) {
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

    private fun closeKeyboard(view: android.view.View) {
        activity.getSystemService(InputMethodManager::class.java)?.hideSoftInputFromWindow(view.windowToken, 0)
    }

    private fun leaveFor(url: String) {
        hide()
        host.loadInServer(url)
    }
}
