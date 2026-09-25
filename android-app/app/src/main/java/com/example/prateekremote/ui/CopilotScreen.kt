package com.example.prateekremote.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.input.key.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.prateekremote.data.model.SuggestionData

private val DarkBackground = Color(0xFF060709)
private val CardBackground = Color(0xFF10141D)
private val PrimaryCyan = Color(0xFF38BDF8)
private val AccentBlue = Color(0xFF2563EB)
private val EmeraldGreen = Color(0xFF34D399)
private val RoseRed = Color(0xFFF87171)
private val TextLight = Color(0xFFF1F5F9)
private val TextMuted = Color(0xFF94A3B8)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CopilotScreen(
    viewModel: CopilotViewModel,
    onStartSpeechRecognition: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showIpDialog by remember { mutableStateOf(false) }

    // Toast watcher
    LaunchedEffect(uiState.toastMessage) {
        uiState.toastMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearToast()
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DarkBackground
                ),
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "⚡",
                            fontSize = 18.sp
                        )
                        Text(
                            text = "Prateek Remote",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextLight
                        )
                    }
                },
                actions = {
                    // Status Badge
                    Surface(
                        shape = CircleShape,
                        color = if (uiState.isConnected) EmeraldGreen.copy(alpha = 0.15f) else RoseRed.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (uiState.isConnected) EmeraldGreen.copy(alpha = 0.4f) else RoseRed.copy(alpha = 0.4f)
                        ),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(if (uiState.isConnected) EmeraldGreen else RoseRed)
                            )
                            Text(
                                text = if (uiState.isConnected) "LIVE PC" else if (uiState.isConnecting) "CONNECTING" else "OFFLINE",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (uiState.isConnected) EmeraldGreen else RoseRed
                            )
                        }
                    }

                    // Settings / IP Config Button
                    IconButton(onClick = { showIpDialog = true }) {
                        Text("⚙️", fontSize = 16.sp)
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding(),
                color = DarkBackground
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    StealthButton(
                        modifier = Modifier.weight(1f),
                        icon = "📸",
                        label = "Scan",
                        highlighted = true,
                        onClick = {
                            vibrate(context)
                            viewModel.scanScreen()
                        }
                    )
                    StealthButton(
                        modifier = Modifier.weight(1f),
                        icon = "👁️",
                        label = "Hide",
                        onClick = {
                            vibrate(context)
                            viewModel.sendAction("toggle-stealth")
                        }
                    )
                    StealthButton(
                        modifier = Modifier.weight(1f),
                        icon = "🧹",
                        label = "Clear",
                        onClick = {
                            vibrate(context)
                            viewModel.sendAction("clear")
                        }
                    )
                    StealthButton(
                        modifier = Modifier.weight(1f),
                        icon = "📦",
                        label = "Mini",
                        onClick = {
                            vibrate(context)
                            viewModel.sendAction("toggle-mini")
                        }
                    )
                    StealthButton(
                        modifier = Modifier.weight(1f),
                        icon = "⏹️",
                        label = "Stop",
                        onClick = {
                            vibrate(context)
                            viewModel.sendAction("stop")
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 14.dp, vertical = 6.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // ── 1. Question Input Card ───────────────────────────────────────
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Mode Selector Bar (Kotlin Coding Mode Toggle)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            onClick = {
                                vibrate(context)
                                viewModel.toggleCodingMode()
                            },
                            shape = RoundedCornerShape(8.dp),
                            color = if (uiState.isCodingMode) Color(0xFF0C2A44) else Color.White.copy(alpha = 0.05f),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (uiState.isCodingMode) EmeraldGreen else Color.White.copy(alpha = 0.12f)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = if (uiState.isCodingMode) "💻 Kotlin Code: ON" else "💻 Kotlin Coding Mode",
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (uiState.isCodingMode) EmeraldGreen else TextLight
                                )
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(if (uiState.isCodingMode) EmeraldGreen else Color(0xFF64748B))
                                )
                            }
                        }

                        if (uiState.isCodingMode) {
                            Text(
                                text = "Auto Kotlin Programs & Ext",
                                fontSize = 10.sp,
                                color = EmeraldGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    OutlinedTextField(
                        value = uiState.inputText,
                        onValueChange = { newText ->
                            if (newText.contains("\n")) {
                                val clean = newText.replace("\n", "").trim()
                                if (clean.isNotBlank()) {
                                    viewModel.updateInputText("")
                                    vibrate(context)
                                    viewModel.sendQuery(clean)
                                }
                            } else {
                                viewModel.updateInputText(newText)
                            }
                        },
                        placeholder = {
                            Text(
                                if (uiState.isCodingMode)
                                    "Type topic (e.g. palindrome, extension function)..."
                                else
                                    "Type question & press Enter or Send...",
                                color = if (uiState.isCodingMode) EmeraldGreen.copy(alpha = 0.7f) else Color(0xFF64748B),
                                fontSize = 13.5.sp
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = if (uiState.isCodingMode) EmeraldGreen else PrimaryCyan,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                            focusedTextColor = TextLight,
                            unfocusedTextColor = TextLight,
                            cursorColor = if (uiState.isCodingMode) EmeraldGreen else PrimaryCyan
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 76.dp)
                            .onKeyEvent { event ->
                                if (event.key == Key.Enter && event.type == KeyEventType.KeyUp) {
                                    val clean = uiState.inputText.trim()
                                    if (clean.isNotBlank()) {
                                        viewModel.updateInputText("")
                                        vibrate(context)
                                        viewModel.sendQuery(clean)
                                        true
                                    } else false
                                } else false
                            },
                        singleLine = false,
                        maxLines = 4,
                        keyboardOptions = KeyboardOptions(
                            imeAction = ImeAction.Send,
                            keyboardType = KeyboardType.Text
                        ),
                        keyboardActions = KeyboardActions(onSend = {
                            vibrate(context)
                            viewModel.sendQuery()
                        })
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Button(
                            onClick = {
                                vibrate(context)
                                viewModel.sendQuery()
                            },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            contentPadding = PaddingValues(),
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                                .background(
                                    brush = Brush.horizontalGradient(
                                        if (uiState.isCodingMode) listOf(Color(0xFF0F766E), Color(0xFF0284C7))
                                        else listOf(Color(0xFF0284C7), AccentBlue)
                                    ),
                                    shape = RoundedCornerShape(10.dp)
                                )
                        ) {
                            Text(
                                text = if (uiState.isCodingMode) "💻 Generate Kotlin" else "⚡ Send to PC",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.5.sp,
                                color = Color.White
                            )
                        }

                        OutlinedButton(
                            onClick = {
                                vibrate(context)
                                if (uiState.inputText.isNotBlank()) {
                                    viewModel.sendQuery(forceCoding = true)
                                } else {
                                    viewModel.toggleCodingMode()
                                }
                            },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = if (uiState.isCodingMode) EmeraldGreen else TextLight
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (uiState.isCodingMode) EmeraldGreen.copy(alpha = 0.8f) else Color.White.copy(alpha = 0.2f)
                            ),
                            modifier = Modifier.height(44.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp)
                        ) {
                            Text(
                                text = if (uiState.isCodingMode) "💻 Mode" else "💻 Code",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        OutlinedButton(
                            onClick = {
                                vibrate(context)
                                onStartSpeechRecognition()
                            },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextLight),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                            modifier = Modifier.height(44.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp)
                        ) {
                            Text("🎤 Mic", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            // ── 2. Quick Preset Chips ─────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                PresetChip("💻 Palindrome (Ext)") {
                    vibrate(context)
                    viewModel.sendQuery("Palindrome check program using Kotlin extension function", forceCoding = true)
                }
                PresetChip("🧩 Extension Func") {
                    vibrate(context)
                    viewModel.sendQuery("High-impact idiomatic Kotlin extension functions examples", forceCoding = true)
                }
                PresetChip("⚡ Coroutines Flow") {
                    vibrate(context)
                    viewModel.sendQuery("Coroutine Flow debounce and throttleFirst extension in Kotlin", forceCoding = true)
                }
                PresetChip("🔀 Two Pointers") {
                    vibrate(context)
                    viewModel.sendQuery("Two pointer algorithm program in Kotlin", forceCoding = true)
                }
                PresetChip("📦 LRU Cache") {
                    vibrate(context)
                    viewModel.sendQuery("LRU Cache implementation in Kotlin using LinkedHashMap", forceCoding = true)
                }
                PresetChip("🏗️ Architecture") {
                    vibrate(context)
                    viewModel.quickSendPreset("Explain architecture & trade-offs")
                }
                PresetChip("💻 Code Example") {
                    vibrate(context)
                    viewModel.quickSendPreset("Provide clean code snippet")
                }
                PresetChip("⚖️ Pros vs Cons") {
                    vibrate(context)
                    viewModel.quickSendPreset("Key differences and pros vs cons")
                }
                PresetChip("🎯 3 Bullets") {
                    vibrate(context)
                    viewModel.quickSendPreset("3 high-impact interview bullet points")
                }
                PresetChip("🛡️ Memory/Lifecycle") {
                    vibrate(context)
                    viewModel.quickSendPreset("Memory leak prevention and lifecycle")
                }
            }

            // ── 3. Giant Tactile "Generate Answer" Touchpad (Replaces streaming card) ──
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (uiState.isCodingMode) Color(0xFF07232F) else Color(0xFF0C192E)
                ),
                border = androidx.compose.foundation.BorderStroke(
                    2.dp,
                    if (uiState.currentSuggestion?.isStreaming == true)
                        (if (uiState.isCodingMode) EmeraldGreen else PrimaryCyan)
                    else
                        (if (uiState.isCodingMode) EmeraldGreen.copy(alpha = 0.55f) else PrimaryCyan.copy(alpha = 0.45f))
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 240.dp)
            ) {
                Surface(
                    onClick = {
                        vibrate(context)
                        viewModel.generateAnswer()
                    },
                    color = Color.Transparent,
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 240.dp)
                            .background(
                                brush = Brush.verticalGradient(
                                    if (uiState.isCodingMode) listOf(
                                        Color(0xFF042F2E).copy(alpha = 0.85f),
                                        Color(0xFF0F172A),
                                        Color(0xFF064E3B).copy(alpha = 0.35f)
                                    ) else listOf(
                                        Color(0xFF0F172A),
                                        Color(0xFF1E293B),
                                        Color(0xFF0284C7).copy(alpha = 0.35f)
                                    )
                                )
                            )
                            .padding(20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            // Big Tactile Icon
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(
                                        brush = Brush.linearGradient(
                                            if (uiState.isCodingMode) listOf(EmeraldGreen, Color(0xFF0284C7))
                                            else listOf(PrimaryCyan, AccentBlue)
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (uiState.currentSuggestion?.isStreaming == true) "⏳" else "↵",
                                    fontSize = 38.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Action Title
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = if (uiState.currentSuggestion?.isStreaming == true)
                                        "GENERATING ANSWER..."
                                    else if (uiState.isCodingMode)
                                        "GENERATE KOTLIN CODE"
                                    else
                                        "GENERATE ANSWER",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White,
                                    letterSpacing = 0.5.sp
                                )

                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = if (uiState.isCodingMode) EmeraldGreen.copy(alpha = 0.25f) else PrimaryCyan.copy(alpha = 0.25f),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (uiState.isCodingMode) EmeraldGreen else PrimaryCyan
                                    )
                                ) {
                                    Text(
                                        text = if (uiState.isCodingMode) "KOTLIN" else "ENTER",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (uiState.isCodingMode) EmeraldGreen else PrimaryCyan,
                                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Subtitle description
                            Text(
                                text = if (uiState.currentSuggestion?.isStreaming == true)
                                    "● AI is formulating and streaming answer onto PC HUD..."
                                else if (uiState.inputText.isNotBlank())
                                    "Tap anywhere here to send typed query & generate answer"
                                else if (uiState.isCodingMode)
                                    "Touch anywhere in this box to formulate Kotlin code from audio"
                                else
                                    "Touch anywhere in this box to trigger instant answer (Enter)",
                                fontSize = 12.5.sp,
                                color = if (uiState.currentSuggestion?.isStreaming == true)
                                    EmeraldGreen
                                else
                                    TextLight.copy(alpha = 0.85f),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            // Status Pill
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Color.Black.copy(alpha = 0.4f),
                                border = androidx.compose.foundation.BorderStroke(
                                    1.dp,
                                    if (uiState.currentSuggestion?.isStreaming == true) EmeraldGreen.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.12f)
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (uiState.currentSuggestion?.isStreaming == true) EmeraldGreen
                                                else if (uiState.isConnected) PrimaryCyan
                                                else Color(0xFF64748B)
                                            )
                                    )
                                    Text(
                                        text = if (uiState.currentSuggestion?.isStreaming == true) "STREAMING TO PC HUD"
                                        else if (uiState.isConnected) "PC COPILOT LINKED"
                                        else "OFFLINE (CHECK IP)",
                                        fontSize = 10.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (uiState.currentSuggestion?.isStreaming == true) EmeraldGreen else TextMuted
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // IP Config Dialog
    if (showIpDialog) {
        var ipInput by remember { mutableStateOf(uiState.serverUrl) }
        AlertDialog(
            onDismissRequest = { showIpDialog = false },
            title = {
                Text("Configure PC Server Link", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Enter the URL shown in your PC terminal or HUD screen:",
                        fontSize = 12.sp,
                        color = TextMuted
                    )
                    OutlinedTextField(
                        value = ipInput,
                        onValueChange = { ipInput = it },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("http://192.168.1.35:4899") }
                    )
                    Text(
                        "Tip: Phone & PC must be on the same Wi-Fi or mobile Hotspot.",
                        fontSize = 11.sp,
                        color = Color(0xFF64748B)
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    showIpDialog = false
                    viewModel.updateServerUrl(ipInput)
                }) {
                    Text("Connect")
                }
            },
            dismissButton = {
                TextButton(onClick = { showIpDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun PresetChip(
    label: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        color = Color.White.copy(alpha = 0.05f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            color = TextMuted,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun StealthButton(
    modifier: Modifier = Modifier,
    icon: String,
    label: String,
    highlighted: Boolean = false,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = if (highlighted) Color(0xFF0C2A44).copy(alpha = 0.85f) else Color(0xFF0F172A).copy(alpha = 0.7f),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (highlighted) PrimaryCyan.copy(alpha = 0.6f) else Color.White.copy(alpha = 0.08f)
        ),
        modifier = modifier
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(vertical = 8.dp)
        ) {
            Text(icon, fontSize = 16.sp)
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = if (highlighted) FontWeight.Bold else FontWeight.Medium,
                color = if (highlighted) PrimaryCyan else TextMuted
            )
        }
    }
}

@Composable
private fun BulletItem(text: String) {
    val cleanText = text.removePrefix("- ").removePrefix("• ").removePrefix("* ")
    val isCodeLine = cleanText.startsWith("fun ") ||
            cleanText.startsWith("class ") ||
            cleanText.startsWith("val ") ||
            cleanText.startsWith("var ") ||
            cleanText.startsWith("return ") ||
            cleanText.startsWith("override ") ||
            cleanText.startsWith("private ") ||
            cleanText.startsWith("public ") ||
            cleanText.startsWith("data class") ||
            cleanText.startsWith("sealed class") ||
            cleanText.startsWith("//") ||
            cleanText.startsWith("```")

    if (isCodeLine) {
        val codeText = cleanText.removePrefix("```kotlin").removePrefix("```").trimEnd()
        Surface(
            shape = RoundedCornerShape(6.dp),
            color = Color(0xFF030712).copy(alpha = 0.95f),
            border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryCyan.copy(alpha = 0.25f)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp)
        ) {
            Text(
                text = codeText,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = Color(0xFF6EE7B7),
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
            )
        }
        return
    }

    val annotated = remember(cleanText) {
        buildAnnotatedString {
            val parts = cleanText.split("**")
            parts.forEachIndexed { index, part ->
                if (index % 2 == 1) {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PrimaryCyan)) {
                        append(part)
                    }
                } else {
                    withStyle(SpanStyle(color = Color(0xFFCBD5E1))) {
                        append(part)
                    }
                }
            }
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "▸",
            color = PrimaryCyan,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 20.sp
        )
        Text(
            text = annotated,
            fontSize = 13.5.sp,
            lineHeight = 20.sp,
            modifier = Modifier.weight(1f)
        )
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("Copilot Answer", text))
    Toast.makeText(context, "📋 Copied Answer", Toast.LENGTH_SHORT).show()
}

private fun vibrate(context: Context) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            @Suppress("DEPRECATION")
            vibrator?.vibrate(35)
        }
    } catch (_: Exception) {}
}
