package dev.modulelibrary.app.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Each request's payload and its limits (native-requests.ts). An object;
// fields not named are ignored, as zod's objects do.

private const val MAX_KEY = 200
private const val MAX_URL = 4096
private const val MAX_FILE_NAME = 200
private const val MAX_QUESTION = 2000
private const val MAX_IDS = 50
private const val MAX_ID = 300
private const val MAX_WORLD = 200
private const val MAX_USER = 100
private const val MAX_PEOPLE = 10_000

private val FILE_NAME = Regex("""[^/\\\u0000]+""")

/** One field's check; `null` when the field is missing. */
private typealias Field = (JsonElement?) -> Boolean

private fun stringOf(value: JsonElement?): String? =
    (value as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun text(min: Int = 0, max: Int, pattern: Regex? = null): Field = { value ->
    val s = stringOf(value)
    s != null && s.length in min..max && (pattern == null || pattern.matches(s))
}

/** Any value, but present (zod 4's z.unknown() in an object needs the key). */
private val anything: Field = { it != null }

private val ids: Field = { value ->
    value is JsonArray && value.size <= MAX_IDS && value.all { text(1, MAX_ID)(it) }
}

private fun oneOf(vararg options: String): Field = { stringOf(it) in options }

private fun int(max: Int, min: Int = 0): Field = { value ->
    val p = value as? JsonPrimitive
    val n = p?.takeIf { !it.isString }?.content?.toIntOrNull()
    n != null && n in min..max
}

private val bool: Field = { value -> (value as? JsonPrimitive)?.takeIf { !it.isString }?.content in setOf("true", "false") }

/** Missing is fine; present, it must pass. */
private fun optional(check: Field): Field = { it == null || check(it) }

private val pattern = text(max = MAX_URL, pattern = SERVER_PATTERN)

private val SCHEMAS: Map<String, Map<String, Field>> = mapOf(
    "runtime.send" to mapOf("message" to anything),
    "files.save" to mapOf(
        "fileName" to text(1, MAX_FILE_NAME, FILE_NAME),
        "text" to text(max = MAX_MESSAGE_CHARS),
    ),
    "files.open" to emptyMap(),
    "confirm" to mapOf("text" to text(1, MAX_QUESTION)),
    "openExternal" to mapOf("url" to text(max = MAX_URL)),
    "kv.get" to mapOf("key" to text(1, MAX_KEY)),
    "kv.set" to mapOf("key" to text(1, MAX_KEY), "value" to anything),
    "scripts.registered" to mapOf("ids" to ids),
    "scripts.register" to mapOf("server" to text(max = MAX_URL, pattern = SERVER_ID), "ids" to ids),
    "scripts.unregister" to mapOf("ids" to ids),
    "permissions.contains" to mapOf("origin" to pattern),
    "permissions.request" to mapOf("origin" to pattern),
    "permissions.remove" to mapOf("origin" to pattern),
    "fetch" to mapOf("url" to text(max = MAX_URL), "purpose" to oneOf("release", "config")),
    "server.check" to mapOf("server" to text(max = MAX_URL, pattern = SERVER_ID)),
    "home.open" to emptyMap(),
    "password.ask" to mapOf(
        "purpose" to oneOf("close", "join"),
        "world" to text(1, MAX_WORLD),
        "user" to optional(text(1, MAX_USER)),
        "people" to int(MAX_PEOPLE),
        "wrong" to bool,
    ),
    "apply.start" to mapOf("world" to text(1, MAX_WORLD), "changes" to int(MAX_PEOPLE, min = 1)),
    "apply.done" to mapOf("ok" to bool),
    READY to emptyMap(),
)

/** Every request type native knows. */
val REQUEST_TYPES: Set<String> = SCHEMAS.keys

/** Whether `payload` is a valid payload for `type`. */
fun payloadValid(type: String, payload: JsonElement?): Boolean {
    val fields = SCHEMAS[type] ?: return false
    if (payload !is JsonObject) return false
    return fields.all { (name, check) -> check(payload[name]) }
}
