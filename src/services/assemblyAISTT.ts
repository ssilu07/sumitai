import { LanguageMode, SpeakerRole } from '../types';
import { normalizeTechnicalTranscript } from './phoneticNormalizer';

export interface STTCallbacks {
  onTranscript: (role: SpeakerRole, text: string, isFinal: boolean, speechFinal: boolean) => void;
  onUtteranceEnd?: (role: SpeakerRole) => void;
  onError?: (role: SpeakerRole, error: any) => void;
  onStatusChange?: (role: SpeakerRole, status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
}

/**
 * AssemblyAI Streaming WebSocket API (v3 Universal-3.5 Pro)
 * Native real-time streaming with server-side VAD, no hallucinations on silence,
 * and high accuracy on technical/coding vocabulary.
 */
export class AssemblyAILiveStreamer {
  private apiKey: string;
  private callbacks: STTCallbacks;
  private language: LanguageMode = 'en';
  private wsInterviewer: WebSocket | null = null;
  private wsCandidate: WebSocket | null = null;
  private shouldBeConnected = false;
  private isInterviewerReady = false;
  private isCandidateReady = false;

  private interviewerQueue: ArrayBuffer[] = [];
  private candidateQueue: ArrayBuffer[] = [];

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

  async connect(): Promise<void> {
    if (!this.apiKey) {
      const err = new Error('AssemblyAI API Key is missing. Please enter your AssemblyAI key in Settings.');
      console.warn('[AssemblyAI]', err.message);
      this.callbacks.onError?.('interviewer', err);
      this.callbacks.onStatusChange?.('interviewer', 'error');
      return;
    }

    this.shouldBeConnected = true;
    this.connectSocket('interviewer');
    this.connectSocket('candidate');
  }

  private async connectSocket(role: SpeakerRole): Promise<void> {
    if (!this.shouldBeConnected) return;

    this.callbacks.onStatusChange?.(role, 'connecting');

    try {
      // 1. Fetch temporary authentication token from AssemblyAI v3
      const tokenRes = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=600', {
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`AssemblyAI token failed (${tokenRes.status}): ${errText}`);
      }

      const { token } = await tokenRes.json();
      if (!token) {
        throw new Error('No streaming token returned by AssemblyAI.');
      }

      // 2. Connect to AssemblyAI v3 Streaming WebSocket with custom vocabulary boost
      const customVocab = [
        'coroutines', 'coroutine', 'Kotlin', 'Jetpack', 'Compose', 'Recomposition',
        'ViewModel', 'StateFlow', 'SharedFlow', 'Koin', 'Hilt', 'Dagger', 'Retrofit',
        'Room', 'DataStore', 'WorkManager', 'Paging', 'MVVM', 'MVI',
        'lifecycleScope', 'viewModelScope', 'repeatOnLifecycle', 'withContext',
        'SupervisorJob', 'lateinit', 'reified', 'typealias', 'suspend',
        'LiveData', 'sealed', 'companion', 'inline', 'lambda', 'Flow',
        'Clean Architecture', 'Dependency Injection', 'Navigation',
      ].map(w => encodeURIComponent(w)).join(',');
      const langCodes = this.language === 'en' ? ['en'] : this.language === 'hi' ? ['hi'] : ['en', 'hi'];
      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&token=${encodeURIComponent(token)}&format_turns=true&word_boost=${customVocab}&boost_param=high&language_codes=${encodeURIComponent(JSON.stringify(langCodes))}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      if (role === 'interviewer') {
        this.wsInterviewer = ws;
      } else {
        this.wsCandidate = ws;
      }

      ws.onopen = () => {
        console.log(`[AssemblyAI] WebSocket connected for ${role} (lang: ${this.language})`);
        if (role === 'interviewer') {
          this.isInterviewerReady = true;
          while (this.interviewerQueue.length > 0) {
            const chunk = this.interviewerQueue.shift();
            if (chunk && ws.readyState === WebSocket.OPEN) ws.send(chunk);
          }
        } else {
          this.isCandidateReady = true;
          while (this.candidateQueue.length > 0) {
            const chunk = this.candidateQueue.shift();
            if (chunk && ws.readyState === WebSocket.OPEN) ws.send(chunk);
          }
        }
        this.callbacks.onStatusChange?.(role, 'connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'Turn') {
            const rawTranscript = data.transcript?.trim() || '';
            const isFinal = Boolean(data.end_of_turn);

            if (rawTranscript.length > 0) {
              const cleanText = normalizeTechnicalTranscript(rawTranscript, this.language);
              this.callbacks.onTranscript(role, cleanText, isFinal, isFinal);
            }
          }
        } catch (err) {
          console.error(`[AssemblyAI] Message parse error (${role}):`, err);
        }
      };

      ws.onerror = (event) => {
        console.warn(`[AssemblyAI] WebSocket error (${role}):`, event);
        this.callbacks.onError?.(role, event);
        this.callbacks.onStatusChange?.(role, 'error');
      };

      ws.onclose = (event) => {
        console.log(`[AssemblyAI] WebSocket closed (${role}): code=${event.code}`);
        if (role === 'interviewer') this.isInterviewerReady = false;
        if (role === 'candidate') this.isCandidateReady = false;

        if (this.shouldBeConnected && event.code !== 1000) {
          // Reconnect after brief delay if unexpected drop
          setTimeout(() => {
            if (this.shouldBeConnected) this.connectSocket(role);
          }, 2000);
        } else {
          this.callbacks.onStatusChange?.(role, 'disconnected');
        }
      };
    } catch (err: any) {
      console.error(`[AssemblyAI] Failed to connect (${role}):`, err);
      this.callbacks.onError?.(role, err);
      this.callbacks.onStatusChange?.(role, 'error');
    }
  }

  sendMicChunk(chunk: ArrayBuffer): void {
    if (!this.shouldBeConnected) return;

    if (this.isCandidateReady && this.wsCandidate?.readyState === WebSocket.OPEN) {
      this.wsCandidate.send(chunk);
    } else {
      if (this.candidateQueue.length < 50) {
        this.candidateQueue.push(chunk);
      }
    }
  }

  sendSpeakerChunk(chunk: ArrayBuffer): void {
    if (!this.shouldBeConnected) return;

    if (this.isInterviewerReady && this.wsInterviewer?.readyState === WebSocket.OPEN) {
      this.wsInterviewer.send(chunk);
    } else {
      if (this.interviewerQueue.length < 50) {
        this.interviewerQueue.push(chunk);
      }
    }
  }

  disconnect(): void {
    this.shouldBeConnected = false;
    this.isInterviewerReady = false;
    this.isCandidateReady = false;
    this.interviewerQueue = [];
    this.candidateQueue = [];

    if (this.wsInterviewer) {
      try {
        if (this.wsInterviewer.readyState === WebSocket.OPEN) {
          this.wsInterviewer.send(JSON.stringify({ type: 'Terminate' }));
        }
        this.wsInterviewer.close(1000, 'Normal Closure');
      } catch (_) {}
      this.wsInterviewer = null;
    }

    if (this.wsCandidate) {
      try {
        if (this.wsCandidate.readyState === WebSocket.OPEN) {
          this.wsCandidate.send(JSON.stringify({ type: 'Terminate' }));
        }
        this.wsCandidate.close(1000, 'Normal Closure');
      } catch (_) {}
      this.wsCandidate = null;
    }

    this.callbacks.onStatusChange?.('interviewer', 'disconnected');
    this.callbacks.onStatusChange?.('candidate', 'disconnected');
  }

  setKeywords(_keywords: string[]): void {}
}
