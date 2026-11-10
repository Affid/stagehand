package io.github.affid.stagehand.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The native rules give the TypeScript's answers on the cases it wrote
 * (packages/extension/test/app/contract-vectors.ts).
 */
class ContractVectorsTest {
    private val vectors: JsonObject = run {
        val text = javaClass.classLoader!!.getResource("contract-vectors.json")!!.readText()
        Json.parseToJsonElement(text).jsonObject
    }

    private fun cases(name: String): List<JsonObject> = vectors[name]!!.jsonArray.map { it.jsonObject }

    private fun JsonObject.str(key: String): String = this[key]!!.jsonPrimitive.content
    private fun JsonObject.flag(key: String): Boolean = this[key]!!.jsonPrimitive.boolean
    private fun JsonObject.strings(key: String): List<String> = this[key]!!.jsonArray.map { it.jsonPrimitive.content }

    @Test
    fun `message cap matches`() {
        assertEquals(vectors["maxMessageChars"]!!.jsonPrimitive.int, MAX_MESSAGE_CHARS)
    }

    @Test
    fun fetchAllowed() = cases("fetchAllowed").forEach { c ->
        val purpose = FetchPurpose.of(c.str("purpose"))!!
        assertEquals(c.toString(), c.flag("allowed"), fetchAllowed(c.str("url"), purpose, c.flag("releaseHistory")))
    }

    @Test
    fun isServerPage() = cases("isServerPage").forEach { c ->
        assertEquals(c.toString(), c.flag("result"), isServerPage(c.str("href"), c.str("server"), c.str("page")))
    }

    @Test
    fun mayAskAsServer() = cases("mayAskAsServer").forEach { c ->
        assertEquals(c.toString(), c.flag("result"), mayAskAsServer(c.str("url"), c.strings("servers")))
    }

    @Test
    fun externalAllowed() = cases("externalAllowed").forEach { c ->
        assertEquals(c.toString(), c.flag("allowed"), externalAllowed(c.str("url"), c.strings("origins")))
    }

    @Test
    fun savableServerOrigin() = cases("savableServerOrigin").forEach { c ->
        assertEquals(c.toString(), c["origin"]!!.jsonPrimitive.contentOrNull, savableServerOrigin(c.str("pattern")))
    }

    @Test
    fun payloads() = cases("payloads").forEach { c ->
        val payload: JsonElement? = c["payload"]
        assertEquals(c.toString(), c.flag("valid"), payloadValid(c.str("type"), payload))
    }

    @Test
    fun statusUrl() = cases("statusUrl").forEach { c ->
        assertEquals(c.toString(), c["url"]!!.jsonPrimitive.contentOrNull, statusUrl(c.str("server")))
    }

    @Test
    fun foundryVersion() = cases("foundryVersion").forEach { c ->
        assertEquals(c.toString(), c["version"]!!.jsonPrimitive.contentOrNull, foundryVersion(c.str("body")))
    }

    @Test
    fun wrapForServer() = cases("wrapForServer").forEach { c ->
        assertEquals(c.toString(), c.str("out"), wrapForServer(c.str("script"), c.str("server")))
    }

    @Test
    fun `every request type has a case`() {
        val covered = cases("payloads").map { it.str("type") }.toSet()
        assertEquals(REQUEST_TYPES, covered)
        assertEquals(JsonArray::class, vectors["payloads"]!!::class)
    }
}
