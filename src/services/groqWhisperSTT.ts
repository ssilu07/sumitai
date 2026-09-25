import { LanguageMode, SpeakerRole } from '../types';
import { normalizeTechnicalTranscript } from './phoneticNormalizer';

export interface STTCallbacks {
  onTranscript: (role: SpeakerRole, text: string, isFinal: boolean, speechFinal: boolean) => void;
  onUtteranceEnd?: (role: SpeakerRole) => void;
  onError?: (role: SpeakerRole, error: any) => void;
  onStatusChange?: (role: SpeakerRole, status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
}

interface ChannelState {
  chunks: ArrayBuffer[];
  totalBytes: number;
  inFlight: boolean;
  lastSpeechTime: number;
  hasSpeech: boolean;
  silenceTimer: any;
}

const ENGLISH_TECHNICAL_PROMPT =
  'Kotlin, Android, coroutines, ViewModel, StateFlow, SharedFlow, Room DB, Retrofit, Jetpack Compose, Koin, Hilt, MVVM, Clean Architecture, suspend function, by lazy, const val, data class, sealed class, typealias, reified, inline, Dispatchers, SupervisorJob, lifecycleScope, WorkManager, Paging 3, difference between, explain how, pros and cons';

const HINDI_TECHNICAL_PROMPT =
  'Kotlin, Android, coroutines, क्या होता है, कैसे काम करता है, क्या अंतर है, कैसे use करते हैं, lateinit, val vs var, StateFlow, SharedFlow, ViewModel, Room DB, Retrofit, Jetpack Compose, Koin, Hilt, MVVM, Clean Architecture, suspend function, by lazy, data class, sealed class';

const HINGLISH_TECHNICAL_PROMPT =
  'Kotlin, Android, coroutines kya hota hai, kaise kaam karta hai, difference kya hai, kaise use karte hain, lateinit, val vs var, StateFlow, SharedFlow, ViewModel, Room DB, Retrofit, Jetpack Compose, Koin, Hilt, MVVM, Clean Architecture, suspend function, by lazy, const val, data class, sealed class, typealias, reified, inline, Dispatchers, SupervisorJob';

/**
 * Groq Whisper STT Service
 * Uses ultra-fast Groq LPU Whisper-large-v3-turbo (~150ms latency)
 * with extreme accuracy for Kotlin / Android technical vocabulary and configurable language.
 */
export class GroqWhisperSTT {
  private apiKey: string;
  private callbacks: STTCallbacks;
  private language: LanguageMode = 'en';
  private shouldBeConnected = false;
  private processInterval: any = null;

  // Channels for Candidate (Mic) and Interviewer (Speaker / Desktop Video)
  private channels: Record<SpeakerRole, ChannelState> = {
    interviewer: { chunks: [], totalBytes: 0, inFlight: false, lastSpeechTime: 0, hasSpeech: false, silenceTimer: null },
    candidate: { chunks: [], totalBytes: 0, inFlight: false, lastSpeechTime: 0, hasSpeech: false, silenceTimer: null },
    system: { chunks: [], totalBytes: 0, inFlight: false, lastSpeechTime: 0, hasSpeech: false, silenceTimer: null },
  };

  constructor(apiKey: string, callbacks: STTCallbacks, language: LanguageMode = 'en') {
    this.apiKey = apiKey.trim();
    this.callbacks = callbacks;
    this.language = language;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  setLanguage(language: LanguageMode) {
    this.language = language;
  }

  connect(): void {
    if (!this.apiKey) {
      const err = new Error('Groq API Key is missing. Please enter your Groq API key in Settings.');
      console.warn('[GroqWhisper]', err.message);
      this.callbacks.onError?.('interviewer', err);
      this.callbacks.onStatusChange?.('interviewer', 'error');
      return;
    }

    this.shouldBeConnected = true;
    this.callbacks.onStatusChange?.('interviewer', 'connected');
    this.callbacks.onStatusChange?.('candidate', 'connected');

    // Periodic processor to evaluate buffers every 250ms
    if (this.processInterval) clearInterval(this.processInterval);
    this.processInterval = setInterval(() => {
      if (!this.shouldBeConnected) return;
      this.checkAndProcess('interviewer');
      this.checkAndProcess('candidate');
    }, 250);

    console.log('[GroqWhisper] Connected and active.');
  }

  disconnect(): void {
    this.shouldBeConnected = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    for (const role of ['interviewer', 'candidate', 'system'] as SpeakerRole[]) {
      const ch = this.channels[role];
      ch.chunks = [];
      ch.totalBytes = 0;
      ch.inFlight = false;
      if (ch.silenceTimer) clearTimeout(ch.silenceTimer);
    }

    this.callbacks.onStatusChange?.('interviewer', 'disconnected');
    this.callbacks.onStatusChange?.('candidate', 'disconnected');
  }

  sendMicChunk(chunk: ArrayBuffer): void {
    this.pushChunk('candidate', chunk);
  }

  sendSpeakerChunk(chunk: ArrayBuffer): void {
    this.pushChunk('interviewer', chunk);
  }

  private pushChunk(role: SpeakerRole, chunk: ArrayBuffer): void {
    if (!this.shouldBeConnected) return;

    const ch = this.channels[role];
    ch.chunks.push(chunk);
    ch.totalBytes += chunk.byteLength;

    // Fast voice activity check (RMS energy of 16-bit PCM samples)
    const rms = this.calculateRMS(chunk);
    const isSpeech = rms > 300; // Voice threshold for 16-bit linear PCM

    if (isSpeech) {
      ch.hasSpeech = true;
      ch.lastSpeechTime = Date.now();
    } else if (ch.hasSpeech && Date.now() - ch.lastSpeechTime > 600) {
      // 600ms pause after speech -> trigger immediate flush
      this.flushChannel(role);
    }
  }

  private checkAndProcess(role: SpeakerRole): void {
    const ch = this.channels[role];
    if (ch.inFlight || ch.chunks.length === 0) return;

    // 16kHz 16-bit mono = 32,000 bytes per second
    // Flush if we have >= 1.8 seconds of audio (~57,600 bytes)
    // or if we have at least 0.8s of audio with speech followed by silence
    const durationSeconds = ch.totalBytes / 32000;

    if (durationSeconds >= 2.0) {
      this.flushChannel(role);
    } else if (ch.hasSpeech && durationSeconds >= 0.8 && Date.now() - ch.lastSpeechTime > 500) {
      this.flushChannel(role);
    }
  }

  private async flushChannel(role: SpeakerRole): Promise<void> {
    const ch = this.channels[role];
    if (ch.inFlight || ch.chunks.length === 0) return;

    // Skip if too short (< 0.4s) and no speech detected
    if (ch.totalBytes < 12800 && !ch.hasSpeech) {
      ch.chunks = [];
      ch.totalBytes = 0;
      return;
    }

    ch.inFlight = true;
    ch.hasSpeech = false;

    // Extract current buffer chunks
    const chunksToProcess = ch.chunks;
    const totalBytesToProcess = ch.totalBytes;
    ch.chunks = [];
    ch.totalBytes = 0;

    // Merge chunks into contiguous PCM buffer
    const mergedPcm = new Uint8Array(totalBytesToProcess);
    let offset = 0;
    for (const c of chunksToProcess) {
      mergedPcm.set(new Uint8Array(c), offset);
      offset += c.byteLength;
    }

    try {
      const wavBlob = this.pcmToWav(mergedPcm, 16000);
      const text = await this.transcribeWithGroq(wavBlob);

      if (text && text.trim().length > 0) {
        const normalized = normalizeTechnicalTranscript(text.trim(), this.language);
        console.log(`[GroqWhisper] ${role} (${this.language}): "${normalized}"`);
        this.callbacks.onTranscript(role, normalized, true, true);
      }
    } catch (err: any) {
      console.warn(`[GroqWhisper] Transcription error on ${role}:`, err);
      this.callbacks.onError?.(role, err);
    } finally {
      ch.inFlight = false;
      // If new chunks accumulated while in flight, check if ready
      if (ch.chunks.length > 0 && ch.totalBytes >= 32000) {
        this.flushChannel(role);
      }
    }
  }

  private async transcribeWithGroq(wavBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    if (this.language === 'en') {
      formData.append('language', 'en');
      formData.append('prompt', ENGLISH_TECHNICAL_PROMPT);
    } else if (this.language === 'hi') {
      formData.append('language', 'hi');
      formData.append('prompt', HINDI_TECHNICAL_PROMPT);
    } else {
      // Hinglish / Multilingual
      formData.append('prompt', HINGLISH_TECHNICAL_PROMPT);
    }

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    return data.text || '';
  }

  private calculateRMS(chunk: ArrayBuffer): number {
    const view = new Int16Array(chunk);
    if (view.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < view.length; i++) {
      sum += view[i] * view[i];
    }
    return Math.sqrt(sum / view.length);
  }

  private pcmToWav(pcmData: Uint8Array, sampleRate = 16000): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Linear PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // PCM samples
    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  setKeywords(_keywords: string[]): void {}
}
