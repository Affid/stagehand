package dev.modulelibrary.app.core

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put

// The bridge's wire format (bridge.ts): JSON strings, version 1.
//   request  {"v":1,"id":"…","type":"…","payload":…}
//   reply    {"v":1,"re":"…","ok":true,"result":…} or {…,"ok":false,"error":"…"}

private const val MAX_ID = 64
private const val MAX_ERROR = 2000

sealed interface WireMessage

data class WireRequest(val id: String, val type: String, val payload: JsonElement?) : WireMessage

data class WireReply(val re: String, val ok: Boolean, val result: JsonElement?, val error: String?) : WireMessage

object Wire {
    /** A request or reply, or null for anything else (too large, not JSON, wrong shape). */
    fun parse(text: String): WireMessage? {
        if (text.length > MAX_MESSAGE_CHARS) return null
        val obj = try {
            Json.parseToJsonElement(text) as? JsonObject
        } catch (_: SerializationException) {
            null
        } ?: return null
        val v = obj["v"] as? JsonPrimitive
        if (v == null || v.isString || v.intOrNull != WIRE_VERSION) return null
        return if ("re" in obj) reply(obj) else request(obj)
    }

    private fun shortString(value: JsonElement?, max: Int = MAX_ID): String? =
        (value as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.length in 1..max }

    private fun reply(obj: JsonObject): WireReply? {
        val re = shortString(obj["re"]) ?: return null
        val ok = (obj["ok"] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull ?: return null
        if (ok) return WireReply(re, true, obj["result"], null)
        val error = (obj["error"] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return null
        return WireReply(re, false, null, error.take(MAX_ERROR))
    }

    private fun request(obj: JsonObject): WireRequest? {
        val id = shortString(obj["id"]) ?: return null
        val type = shortString(obj["type"]) ?: return null
        return WireRequest(id, type, obj["payload"])
    }

    fun request(id: String, type: String, payload: JsonElement): String = buildJsonObject {
        put("v", WIRE_VERSION)
        put("id", id)
        put("type", type)
        put("payload", payload)
    }.toString()

    fun ok(re: String, result: JsonElement?): String = buildJsonObject {
        put("v", WIRE_VERSION)
        put("re", re)
        put("ok", true)
        put("result", result ?: JsonNull)
    }.toString()

    fun error(re: String, message: String): String = buildJsonObject {
        put("v", WIRE_VERSION)
        put("re", re)
        put("ok", false)
        put("error", message.take(MAX_ERROR))
    }.toString()
}
