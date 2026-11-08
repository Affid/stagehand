package dev.modulelibrary.app

import android.os.Bundle
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import dev.modulelibrary.app.web.showSupportNotice

/** The app's one screen (filled in by the packages that follow). */
class MainActivity : ComponentActivity() {
    private lateinit var root: FrameLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        setContentView(root)
        keepClearOfSystemBars(root)
        showSupportNotice(this) { }
    }
}

/**
 * The app is drawn edge to edge (target SDK 35+): its pages keep clear of
 * the status and navigation bars, the display cutout and the keyboard.
 */
fun keepClearOfSystemBars(view: android.view.View) {
    ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
        val types = WindowInsetsCompat.Type.systemBars() or
            WindowInsetsCompat.Type.displayCutout() or
            WindowInsetsCompat.Type.ime()
        val bars = insets.getInsets(types)
        v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
        WindowInsetsCompat.CONSUMED
    }
}
