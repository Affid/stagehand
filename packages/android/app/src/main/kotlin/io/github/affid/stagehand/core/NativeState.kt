package io.github.affid.stagehand.core

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

/**
 * What native itself keeps (not the background's data): the servers' saved
 * origins (adding a server is the consent), the registered script ids and
 * their server, Release history's switch, and the server last opened.
 */
data class NativeState(
    val origins: Set<String> = emptySet(),
    val scripts: Map<String, String> = emptyMap(),
    val releaseHistory: Boolean = false,
    val lastServer: String? = null,
) {
    /** Servers whose scripts are injected: registered, on a saved origin. */
    fun activeServers(): Set<String> =
        scripts.values.filter { s -> WebUrl.parse(s)?.origin in origins }.toSet()

    fun save(file: File) {
        val json = buildJsonObject {
            put("origins", JsonArray(origins.sorted().map(::JsonPrimitive)))
            put("scripts", JsonObject(scripts.toSortedMap().mapValues { JsonPrimitive(it.value) }))
            put("releaseHistory", releaseHistory)
            put("lastServer", lastServer?.let(::JsonPrimitive) ?: JsonNull)
        }
        writeAtomically(file, json.toString())
    }

    companion object {
        /** The saved state; empty when there is none or it can't be read. */
        fun load(file: File): NativeState {
            if (!file.isFile) return NativeState()
            return try {
                read(Json.parseToJsonElement(file.readText(Charsets.UTF_8)) as JsonObject)
            } catch (_: SerializationException) {
                NativeState()
            } catch (_: RuntimeException) {
                // Any other shape (a missing or mistyped field): start empty
                // rather than fail at every start (review).
                NativeState()
            }
        }

        private fun string(value: Any?): String {
            val p = value as JsonPrimitive
            require(p.isString)
            return p.content
        }

        private fun read(obj: JsonObject): NativeState {
            val history = obj["releaseHistory"] as JsonPrimitive
            require(!history.isString)
            return NativeState(
                origins = (obj["origins"] as JsonArray).map(::string).toSet(),
                scripts = (obj["scripts"] as JsonObject).mapValues { string(it.value) },
                releaseHistory = history.content.toBooleanStrict(),
                lastServer = obj["lastServer"]?.takeIf { it != JsonNull }?.let(::string),
            )
        }
    }
}
