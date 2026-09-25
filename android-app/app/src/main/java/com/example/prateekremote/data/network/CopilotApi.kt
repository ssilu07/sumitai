package com.example.prateekremote.data.network

import com.example.prateekremote.data.model.SuggestionData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class CopilotApi {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    private val streamClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // SSE requires infinite read timeout
        .build()

    suspend fun sendQuery(baseUrl: String, query: String, role: String = "candidate"): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("query", query)
                put("role", role)
            }
            val cleanUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanUrl/api/query")
                .post(json.toString().toRequestBody(jsonMedia))
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("HTTP ${response.code}: ${response.message}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendAction(baseUrl: String, action: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("action", action)
            }
            val cleanUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanUrl/api/action")
                .post(json.toString().toRequestBody(jsonMedia))
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun checkHealth(baseUrl: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val cleanUrl = baseUrl.trimEnd('/')
            val request = Request.Builder()
                .url("$cleanUrl/api/info")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Connect to SSE stream on the PC Copilot server
     */
    fun startSseStream(
        baseUrl: String,
        onSuggestion: (SuggestionData) -> Unit,
        onClear: () -> Unit,
        onStatusChanged: (Boolean) -> Unit
    ): AutoCloseable {
        val isCancelled = AtomicBoolean(false)
        val cleanUrl = baseUrl.trimEnd('/')

        val thread = Thread {
            while (!isCancelled.get()) {
                var call: okhttp3.Call? = null
                try {
                    val request = Request.Builder()
                        .url("$cleanUrl/api/stream")
                        .header("Accept", "text/event-stream")
                        .build()

                    call = streamClient.newCall(request)
                    val response = call.execute()

                    if (!response.isSuccessful) {
                        onStatusChanged(false)
                        Thread.sleep(3000)
                        continue
                    }

                    onStatusChanged(true)
                    val reader = BufferedReader(InputStreamReader(response.body?.byteStream() ?: break))

                    var currentEvent = ""
                    var line: String? = reader.readLine()

                    while (!isCancelled.get() && line != null) {
                        line = line.trim()
                        if (line.startsWith("event:")) {
                            currentEvent = line.substring(6).trim()
                        } else if (line.startsWith("data:")) {
                            val dataStr = line.substring(5).trim()
                            if (currentEvent == "suggestion" || currentEvent == "token") {
                                val suggestion = parseSuggestion(dataStr)
                                if (suggestion != null) {
                                    onSuggestion(suggestion)
                                }
                            } else if (currentEvent == "clear") {
                                onClear()
                            }
                        } else if (line.isEmpty()) {
                            currentEvent = ""
                        }
                        line = reader.readLine()
                    }
                } catch (e: Exception) {
                    if (!isCancelled.get()) {
                        onStatusChanged(false)
                        try {
                            Thread.sleep(2500)
                        } catch (_: InterruptedException) {
                            break
                        }
                    }
                } finally {
                    try {
                        call?.cancel()
                    } catch (_: Exception) {}
                }
            }
            onStatusChanged(false)
        }.apply {
            name = "Copilot-SSE-Thread"
            isDaemon = true
            start()
        }

        return AutoCloseable {
            isCancelled.set(true)
            thread.interrupt()
        }
    }

    private fun parseSuggestion(jsonStr: String): SuggestionData? {
        return try {
            val json = JSONObject(jsonStr)
            val bulletsArray: JSONArray? = json.optJSONArray("bullets")
            val bulletsList = mutableListOf<String>()
            if (bulletsArray != null) {
                for (i in 0 until bulletsArray.length()) {
                    bulletsList.add(bulletsArray.getString(i))
                }
            }

            SuggestionData(
                id = json.optString("id", System.currentTimeMillis().toString()),
                question = json.optString("question", ""),
                bullets = bulletsList,
                isStreaming = json.optBoolean("isStreaming", false),
                role = json.optString("role", "candidate"),
                timestamp = json.optLong("timestamp", System.currentTimeMillis())
            )
        } catch (e: Exception) {
            null
        }
    }
}
