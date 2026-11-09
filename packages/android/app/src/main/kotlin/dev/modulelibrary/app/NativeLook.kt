package dev.modulelibrary.app

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.TextView

/**
 * The app's native screens in the look of our Setup page (design/app-screens):
 * Foundry's dark Setup palette, the warm button, rounded panels.
 */
internal object Look {
    const val GROUND = 0xFF100E18.toInt()
    const val PANEL = 0xFF1A1724.toInt()
    const val LINE = 0xFF353042.toInt()
    const val FIELD = 0xFF0F0D16.toInt()
    const val FIELD_LINE = 0xFF4A4358.toInt()
    const val INK = 0xFFEFE9DD.toInt()
    const val DIM = 0xFFB5AEC2.toInt()
    const val QUIET = 0xFF8E869C.toInt()
    const val WARM = 0xFFEE9B3A.toInt()
    const val WARM_LIGHT = 0xFFFFBF6B.toInt()
    const val PLAIN = 0xFFE88A6A.toInt()
    const val ERROR_BG = 0xFF2C1D16.toInt()
    const val ERROR_INK = 0xFFF3C7B5.toInt()
    const val BRIGHT_TOP = 0xFFF4A845.toInt()
    const val BRIGHT_BOTTOM = 0xFFD9832A.toInt()
    const val BRIGHT_INK = 0xFF1A1206.toInt()
    const val TILE_TOP = 0xFF3B2A52.toInt()
    const val TILE_BOTTOM = 0xFF1E1A2C.toInt()

    fun dp(context: Context, value: Float): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.resources.displayMetrics).toInt()

    fun rounded(context: Context, fill: Int, radiusDp: Float, stroke: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = dp(context, radiusDp).toFloat()
            if (stroke != null) setStroke(dp(context, 1f), stroke)
        }

    fun text(context: Context, sizeSp: Float, color: Int, bold: Boolean = false): TextView =
        TextView(context).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
        }

    /** A heading in a serif, as the Setup page's Amiri. */
    fun heading(context: Context, sizeSp: Float): TextView =
        text(context, sizeSp, INK).apply { typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD) }

    /** The main action: the warm gradient button. */
    fun bright(context: Context, label: String): Button = Button(context).apply {
        text = label
        isAllCaps = false
        setTextColor(BRIGHT_INK)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setTypeface(typeface, Typeface.BOLD)
        background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(BRIGHT_TOP, BRIGHT_BOTTOM))
            .apply { cornerRadius = dp(context, 6f).toFloat() }
        minHeight = dp(context, 48f)
        stateListAnimator = null
    }

    /** A quiet action: no fill, the panel's line. */
    fun plain(context: Context, label: String): Button = Button(context).apply {
        text = label
        isAllCaps = false
        setTextColor(INK)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        background = rounded(context, 0x00000000, 6f, LINE)
        minHeight = dp(context, 48f)
        stateListAnimator = null
    }

    /** An error line in our words, said to screen readers as it appears. */
    fun error(context: Context): TextView = text(context, 14f, ERROR_INK).apply {
        background = rounded(context, ERROR_BG, 7f, 0x59E88A6A)
        val pad = dp(context, 10f)
        setPadding(pad, pad, pad, pad)
        visibility = View.GONE
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }

    /** The server's letter on a tile, as its card on home. */
    fun letterTile(context: Context, letter: String, sizeDp: Float): TextView = text(context, sizeDp / 2.3f, WARM_LIGHT, bold = true).apply {
        text = letter
        gravity = Gravity.CENTER
        background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(TILE_TOP, TILE_BOTTOM))
            .apply { cornerRadius = dp(context, sizeDp / 4.6f).toFloat() }
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
}
