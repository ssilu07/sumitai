package com.example.prateekremote

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.example.prateekremote.theme.PrateekRemoteTheme
import com.example.prateekremote.ui.CopilotScreen
import com.example.prateekremote.ui.CopilotViewModel
import java.util.Locale

class MainActivity : ComponentActivity() {

    private val viewModel: CopilotViewModel by viewModels()

    private val speechLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val spokenTextList = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val recognizedText = spokenTextList?.firstOrNull()
            if (!recognizedText.isNullOrBlank()) {
                viewModel.onSpeechResult(recognizedText)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            PrateekRemoteTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF060709)
                ) {
                    CopilotScreen(
                        viewModel = viewModel,
                        onStartSpeechRecognition = { launchSpeechRecognition() }
                    )
                }
            }
        }
    }

    private fun launchSpeechRecognition() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak question for PC Copilot...")
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Speech recognition not available on this device", Toast.LENGTH_SHORT).show()
        }
    }
}
