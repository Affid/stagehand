package io.github.affid.stagehand.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WebViewSupportTest {
    @Test
    fun `missing document-start scripts means the page can't run`() {
        assertEquals(Support.Missing, webViewSupport(docStart = false, listener = true, version = "146.0.1"))
    }

    @Test
    fun `missing message listener means the page can't run`() {
        assertEquals(Support.Missing, webViewSupport(docStart = true, listener = false, version = "150.0"))
    }

    @Test
    fun `a WebView older than Foundry 14 needs is a warning`() {
        assertEquals(Support.Old(145), webViewSupport(docStart = true, listener = true, version = "145.0.7632.218"))
    }

    @Test
    fun `an unknown version is a warning, not a stop`() {
        assertEquals(Support.Old(null), webViewSupport(docStart = true, listener = true, version = null))
        assertEquals(Support.Old(null), webViewSupport(docStart = true, listener = true, version = "beta"))
    }

    @Test
    fun `version 146 and newer is fine`() {
        assertEquals(Support.Ok, webViewSupport(docStart = true, listener = true, version = "146.0.0.1"))
        assertEquals(Support.Ok, webViewSupport(docStart = true, listener = true, version = "151.2"))
    }

    @Test
    fun `major version is the number before the first dot`() {
        assertEquals(146, majorVersion("146.0.7632.218"))
        assertEquals(99, majorVersion("99"))
        assertNull(majorVersion(""))
        assertNull(majorVersion("x.1"))
    }
}
