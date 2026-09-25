package com.example.prateekremote.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.prateekremote.data.model.SuggestionData
import com.example.prateekremote.data.network.CopilotApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CopilotUiState(
    val serverUrl: String = "http://192.168.1.35:4899",
    val isConnected: Boolean = false,
    val isConnecting: Boolean = false,
    val inputText: String = "",
    val isCodingMode: Boolean = false,
    val currentSuggestion: SuggestionData? = null,
    val toastMessage: String? = null
)

class CopilotViewModel(application: Application) : AndroidViewModel(application) {
    private val api = CopilotApi()
    private val prefs = application.getSharedPreferences("copilot_remote_prefs", Context.MODE_PRIVATE)

    private val _uiState = MutableStateFlow(
        CopilotUiState(
            serverUrl = prefs.getString("server_url", "http://192.168.1.35:4899") ?: "http://192.168.1.35:4899"
        )
    )
    val uiState: StateFlow<CopilotUiState> = _uiState.asStateFlow()

    private var sseConnection: AutoCloseable? = null

    init {
        connectToCopilot()
    }

    fun updateServerUrl(url: String) {
        val clean = if (!url.startsWith("http://") && !url.startsWith("https://")) {
            "http://$url"
        } else {
            url
        }
        prefs.edit().putString("server_url", clean).apply()
        _uiState.update { it.copy(serverUrl = clean) }
        connectToCopilot()
    }

    fun updateInputText(text: String) {
        _uiState.update { it.copy(inputText = text) }
    }

    fun toggleCodingMode() {
        _uiState.update {
            val next = !it.isCodingMode
            it.copy(
                isCodingMode = next,
                toastMessage = if (next) "💻 Kotlin Coding Mode ON" else "Standard Interview Mode"
            )
        }
    }

    fun connectToCopilot() {
        sseConnection?.close()
        sseConnection = null

        val url = _uiState.value.serverUrl
        _uiState.update { it.copy(isConnecting = true) }

        sseConnection = api.startSseStream(
            baseUrl = url,
            onSuggestion = { suggestion ->
                _uiState.update {
                    it.copy(
                        currentSuggestion = suggestion,
                        isConnected = true,
                        isConnecting = false
                    )
                }
            },
            onClear = {
                _uiState.update { it.copy(currentSuggestion = null) }
            },
            onStatusChanged = { connected ->
                _uiState.update {
                    it.copy(
                        isConnected = connected,
                        isConnecting = false
                    )
                }
            }
        )
    }

    fun sendQuery(customQuery: String? = null, forceCoding: Boolean = false) {
        val raw = customQuery ?: _uiState.value.inputText.trim()
        if (raw.isEmpty()) return

        val shouldCode = forceCoding || _uiState.value.isCodingMode
        val text = if (shouldCode && !raw.startsWith("[Kotlin Coding Mode]")) {
            "[Kotlin Coding Mode] $raw"
        } else {
            raw
        }

        val displayQuestion = if (shouldCode) {
            "💻 Kotlin: $raw"
        } else {
            raw
        }

        val url = _uiState.value.serverUrl
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    inputText = "",
                    currentSuggestion = SuggestionData(
                        id = System.currentTimeMillis().toString(),
                        question = displayQuestion,
                        bullets = listOf(
                            if (shouldCode) "Formulating optimal Kotlin program on PC HUD..."
                            else "Formulating response on PC HUD..."
                        ),
                        isStreaming = true
                    ),
                    toastMessage = if (shouldCode) "💻 Generating Kotlin code on PC!" else "⚡ Question sent to PC!"
                )
            }
            val result = api.sendQuery(url, text, role = "interviewer")
            if (result.isFailure) {
                val err = result.exceptionOrNull()?.message ?: "Network error"
                _uiState.update {
                    it.copy(
                        toastMessage = "❌ Send failed: $err",
                        currentSuggestion = SuggestionData(
                            id = System.currentTimeMillis().toString(),
                            question = displayQuestion,
                            bullets = listOf(
                                "⚠️ Could not connect to PC server at $url",
                                "Error: $err",
                                "Please verify:",
                                "1. PC Copilot app is running",
                                "2. Phone and PC are on the same Wi-Fi / Hotspot",
                                "3. Tap ⚙️ in top bar to configure the exact PC IP"
                            ),
                            isStreaming = false
                        )
                    )
                }
            }
        }
    }

    fun scanScreen() {
        val url = _uiState.value.serverUrl
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    toastMessage = "📸 Scanning PC screen with Vision...",
                    currentSuggestion = SuggestionData(
                        id = System.currentTimeMillis().toString(),
                        question = "📸 Scanning PC Screen & Chat...",
                        bullets = listOf("Capturing PC screen & analyzing with Gemini Vision..."),
                        isStreaming = true
                    )
                )
            }
            val result = api.sendAction(url, "scan-screen")
            if (result.isFailure) {
                val err = result.exceptionOrNull()?.message ?: "Network error"
                _uiState.update {
                    it.copy(
                        toastMessage = "❌ Screen scan failed: $err",
                        currentSuggestion = SuggestionData(
                            id = System.currentTimeMillis().toString(),
                            question = "Screen Scan Failed",
                            bullets = listOf("Could not trigger scan on PC: $err", "Ensure PC Copilot is running"),
                            isStreaming = false
                        )
                    )
                }
            }
        }
    }

    fun quickSendPreset(presetPrompt: String) {
        val currentInput = _uiState.value.inputText.trim()
        val combined = if (currentInput.isNotEmpty()) {
            "$currentInput - $presetPrompt"
        } else {
            presetPrompt
        }
        sendQuery(combined)
    }

    fun generateAnswer() {
        val current = _uiState.value.inputText.trim()
        if (current.isNotEmpty()) {
            sendQuery(current)
        } else {
            val url = _uiState.value.serverUrl
            viewModelScope.launch {
                _uiState.update {
                    it.copy(
                        toastMessage = "⚡ Generating answer on PC...",
                        currentSuggestion = SuggestionData(
                            id = System.currentTimeMillis().toString(),
                            question = "Generating from audio...",
                            bullets = listOf("Formulating answer on PC HUD from audio..."),
                            isStreaming = true
                        )
                    )
                }
                val result = api.sendAction(url, "generate")
                if (result.isFailure) {
                    val err = result.exceptionOrNull()?.message ?: "Network error"
                    _uiState.update {
                        it.copy(
                            toastMessage = "❌ Generate failed: $err",
                            currentSuggestion = SuggestionData(
                                id = System.currentTimeMillis().toString(),
                                question = "Generate Failed",
                                bullets = listOf("Could not connect to PC at $url", "Error: $err"),
                                isStreaming = false
                            )
                        )
                    }
                }
            }
        }
    }

    fun sendAction(action: String) {
        val url = _uiState.value.serverUrl
        viewModelScope.launch {
            _uiState.update { it.copy(toastMessage = "Action: ${action.uppercase()}") }
            val result = api.sendAction(url, action)
            if (result.isFailure) {
                _uiState.update { it.copy(toastMessage = "❌ Action failed: ${result.exceptionOrNull()?.message}") }
            }
            if (action == "clear") {
                _uiState.update { it.copy(currentSuggestion = null) }
            }
        }
    }

    fun onSpeechResult(recognizedText: String) {
        if (recognizedText.isNotBlank()) {
            _uiState.update { it.copy(inputText = recognizedText) }
            sendQuery(recognizedText)
        }
    }

    fun clearToast() {
        _uiState.update { it.copy(toastMessage = null) }
    }

    override fun onCleared() {
        super.onCleared()
        sseConnection?.close()
    }
}
