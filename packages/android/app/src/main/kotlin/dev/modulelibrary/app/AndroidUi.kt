package dev.modulelibrary.app

import dev.modulelibrary.app.core.NativeUi
import dev.modulelibrary.app.core.RequestRefused

/**
 * Native's screen work for the pages' requests. Files and dialogs come in
 * phase 4 package 4; until then they refuse plainly.
 */
class AndroidUi(private val activity: MainActivity) : NativeUi {
    override suspend fun saveFile(fileName: String, text: String) {
        throw RequestRefused("Saving files isn't in the app yet")
    }

    override suspend fun openFile(): String? = throw RequestRefused("Opening files isn't in the app yet")

    override suspend fun confirm(question: String, server: String): Boolean =
        throw RequestRefused("Questions aren't in the app yet")

    override fun openExternal(url: String) {
        throw RequestRefused("Outside links aren't in the app yet")
    }

    override fun showHome() = activity.showSettings()
}
