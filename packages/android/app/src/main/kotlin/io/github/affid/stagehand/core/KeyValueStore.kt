package io.github.affid.stagehand.core

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

/**
 * The background's storage (chrome.storage.local in the extension): one
 * file per key in app-private storage, named by the key's SHA-256 so any
 * key is a safe file name. Values are kept as the JSON text they came as.
 * Writes go to a temporary file first and replace the old one in one step.
 */
class KeyValueStore(root: File, private val io: CoroutineDispatcher = Dispatchers.IO) {
    private val dir = root.resolve("kv")
    private val lock = Mutex()

    private fun fileOf(key: String): File {
        val digest = MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
        return dir.resolve(digest.joinToString("") { "%02x".format(it) } + ".json")
    }

    /** The value, or null when unset (or unreadable: a broken file counts as unset). */
    suspend fun get(key: String): JsonElement? = withContext(io) {
        val file = fileOf(key)
        if (!file.isFile) return@withContext null
        try {
            Json.parseToJsonElement(file.readText(Charsets.UTF_8))
        } catch (_: SerializationException) {
            null
        }
    }

    suspend fun set(key: String, value: JsonElement) = lock.withLock {
        withContext(io) {
            writeAtomically(fileOf(key), value.toString())
        }
    }
}

/** Replaces `file` with `text` in one step (a crash leaves the old or the new). */
fun writeAtomically(file: File, text: String) {
    val dir = file.parentFile ?: throw IOException("No folder for $file")
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Can't make $dir")
    val tmp = File.createTempFile(file.name, ".tmp", dir)
    try {
        FileOutputStream(tmp).use { out ->
            out.write(text.toByteArray(Charsets.UTF_8))
            out.fd.sync()
        }
        Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    } finally {
        tmp.delete()
    }
}
