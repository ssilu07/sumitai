package com.example.prateekremote.data.model

data class SuggestionData(
    val id: String = "",
    val question: String = "",
    val bullets: List<String> = emptyList(),
    val isStreaming: Boolean = false,
    val role: String = "candidate",
    val timestamp: Long = System.currentTimeMillis()
)

data class ServerInfo(
    val ip: String = "",
    val port: Int = 4899,
    val url: String = "",
    val activeClients: Int = 0
)

data class ConnectionState(
    val isConnected: Boolean = false,
    val isConnecting: Boolean = false,
    val serverUrl: String = "http://192.168.1.35:4899",
    val statusText: String = "Disconnected"
)
