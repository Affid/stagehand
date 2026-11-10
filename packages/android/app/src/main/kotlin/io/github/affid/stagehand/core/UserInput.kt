package io.github.affid.stagehand.core

import kotlin.math.abs

/**
 * Whether the user just tapped (a short, still, one-finger press), as
 * native sees it on the server WebView: outside links need one, and each
 * tap opens one link at most (security review). A message from a page
 * carries no tap; a scroll's end, a long press or two fingers aren't one.
 */
class TapRule(private val slopPx: Float, private val maxPressMs: Long, private val windowMs: Long) {
    private var downX = 0f
    private var downY = 0f
    private var downAt: Long? = null
    private var spoiled = false
    private var tapAt: Long? = null

    fun down(x: Float, y: Float, at: Long, pointers: Int) {
        downX = x
        downY = y
        downAt = at
        spoiled = pointers > 1
    }

    /** Another finger came down during the press. */
    fun morePointers() {
        spoiled = true
    }

    fun up(x: Float, y: Float, at: Long) {
        val start = downAt ?: return
        downAt = null
        val still = abs(x - downX) <= slopPx && abs(y - downY) <= slopPx
        if (!spoiled && still && at - start <= maxPressMs) tapAt = at
    }

    /** True once for a tap within the window; the tap is used up. */
    fun take(now: Long): Boolean {
        val at = tapAt ?: return false
        tapAt = null
        return now - at <= windowMs
    }
}

/** Hidden characters (bidi controls, zero-width) and control characters but tab and newline. */
private val HIDDEN = Regex("""[\p{Cf}\u0000-\u0008\u000B-\u001F\u007F-\u009F]""")
private val GAPS = Regex("""\n{3,}""")

/**
 * A page's question as a native dialog shows it: plain text without
 * characters that could reorder or hide it, and no long blank runs that
 * push the question out of view (the contract caps it at 2000).
 */
fun plainQuestion(text: String): String = text.replace(HIDDEN, "").replace(GAPS, "\n\n").trim()

const val LABEL_MAX = 60

/** A server's name for a dialog title, cut in the middle when long. */
fun shortLabel(label: String): String {
    if (label.length <= LABEL_MAX) return label
    val head = (LABEL_MAX - 1) / 2
    val tail = LABEL_MAX - 1 - head
    return label.take(head) + "…" + label.takeLast(tail)
}

private const val FILE_NAME_MAX = 100
private val NOT_IN_NAME = Regex("""[\p{Cf}\p{Cc}/\\]""")

/**
 * A page's suggested file name as the save picker gets it: no folders or
 * hidden characters, at most 100 characters, ending in .json (what is
 * written is the library's JSON).
 */
fun safeFileName(suggested: String): String {
    val base = suggested.replace(NOT_IN_NAME, "").trim().removeSuffix(".json").ifBlank { "library" }
    return base.take(FILE_NAME_MAX - ".json".length) + ".json"
}
