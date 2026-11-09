package dev.modulelibrary.app

import android.content.Context
import android.text.InputType
import android.util.TypedValue
import android.view.View
import android.view.ViewStructure
import android.widget.EditText

/**
 * A native field that tells password managers which server it belongs to
 * (Android plan, phase 7: Bitwarden didn't fill Foundry's web login in the
 * app). The autofill framework gets the server's address as the field's web
 * domain, so a login saved for that address matches, as in a browser.
 */
class ServerField(
    context: Context,
    /** The server's origin, e.g. http://192.168.1.20:30000. */
    private val webDomain: String,
    password: Boolean,
) : EditText(context) {
    init {
        id = View.generateViewId()
        inputType = InputType.TYPE_CLASS_TEXT or
            if (password) InputType.TYPE_TEXT_VARIATION_PASSWORD else InputType.TYPE_TEXT_VARIATION_NORMAL
        setAutofillHints(if (password) View.AUTOFILL_HINT_PASSWORD else View.AUTOFILL_HINT_USERNAME)
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
        isSingleLine = true
        setTextColor(Look.INK)
        setHintTextColor(0xFF6D6679.toInt())
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        background = Look.rounded(context, Look.FIELD, 7f, Look.FIELD_LINE)
        val padX = Look.dp(context, 12f)
        setPadding(padX, 0, padX, 0)
        minHeight = Look.dp(context, 50f)
        setOnFocusChangeListener { _, focused ->
            background = Look.rounded(context, Look.FIELD, 7f, if (focused) Look.WARM else Look.FIELD_LINE)
        }
    }

    override fun onProvideAutofillStructure(structure: ViewStructure, flags: Int) {
        super.onProvideAutofillStructure(structure, flags)
        structure.setWebDomain(webDomain)
    }
}
