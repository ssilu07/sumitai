import { SpeakerRole } from '../types';
import { ANDROID_STT_KEYWORDS } from './androidKnowledge';
import { normalizeTechnicalTranscript } from './phoneticNormalizer';

export interface DeepgramCallbacks {
  onTranscript: (role: SpeakerRole, text: string, isFinal: boolean, speechFinal: boolean) => void;
  onUtteranceEnd?: (role: SpeakerRole) => void;
  onError?: (role: SpeakerRole, error: any) => void;
  onStatusChange?: (role: SpeakerRole, status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
}

export class DeepgramLiveStreamer {
  private apiKey: string;
  private wsInterviewer: WebSocket | null = null;
  private wsCandidate: WebSocket | null = null;
  private callbacks: DeepgramCallbacks;
  private isInterviewerReady = false;
  private isCandidateReady = false;
  private customKeywords: string[] = ANDROID_STT_KEYWORDS;
  private shouldBeConnected = false;
  private keepAliveTimer: any = null;
  private reconnectTimers: Partial<Record<SpeakerRole, any>> = {};

  // Audio chunk queue while WebSockets are connecting
  private interviewerQueue: ArrayBuffer[] = [];
  private candidateQueue: ArrayBuffer[] = [];

  constructor(apiKey: string, callbacks: DeepgramCallbacks, keywords?: string[]) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
    if (keywords) {
      this.customKeywords = keywords;
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setKeywords(keywords: string[]) {
    this.customKeywords = keywords;
  }

  /**
   * Start STT streaming sockets for both interviewer and candidate
   */
  connect(): void {
    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey === 'your_deepgram_api_key_here') {
      console.warn('[Deepgram] No valid API key provided. Skipping STT connection.');
      return;
    }

    this.shouldBeConnected = true;
    this.connectSocket('interviewer');
    this.connectSocket('candidate');
    this.startKeepAlive();
  }

  private connectSocket(role: SpeakerRole): void {
    if (!this.shouldBeConnected) return;

    try {
      this.callbacks.onStatusChange?.(role, 'connecting');

      // Deepgram Nova-2 streaming parameters:
      // - model=nova-2: Fast, high accuracy for conversational speech
      // - smart_format=true: Punctuation, capitalization, numbers
      // - interim_results=true: Low latency live partial transcripts
      // - endpointing=450: Pauses >= 450ms trigger speech_final without excessive cutoff
      // - vad_events=true: Voice activity detection
      const url = new URL('wss://api.deepgram.com/v1/listen');
      url.searchParams.append('model', 'nova-2');
      url.searchParams.append('smart_format', 'true');
      url.searchParams.append('interim_results', 'true');
      url.searchParams.append('utterance_end_ms', '1000');
      url.searchParams.append('vad_events', 'true');
      url.searchParams.append('endpointing', '450');
      url.searchParams.append('encoding', 'linear16');
      url.searchParams.append('sample_rate', '16000');
      url.searchParams.append('channels', '1');

      // Boost technical Android, Kotlin & Jetpack Compose keywords for accurate recognition
      if (this.customKeywords && this.customKeywords.length > 0) {
        this.customKeywords.forEach((kw) => {
          url.searchParams.append('keywords', kw);
        });
      }

      const ws = new WebSocket(url.toString(), ['token', this.apiKey.trim()]);

      if (role === 'interviewer') {
        this.wsInterviewer = ws;
      } else {
        this.wsCandidate = ws;
      }

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log(`[Deepgram] WebSocket connected for ${role}`);
        if (role === 'interviewer') {
          this.isInterviewerReady = true;
          // Flush any buffered chunks
          while (this.interviewerQueue.length > 0) {
            const chunk = this.interviewerQueue.shift();
            if (chunk && ws.readyState === WebSocket.OPEN) {
              ws.send(chunk);
            }
          }
        }
        if (role === 'candidate') {
          this.isCandidateReady = true;
          // Flush any buffered chunks
          while (this.candidateQueue.length > 0) {
            const chunk = this.candidateQueue.shift();
            if (chunk && ws.readyState === WebSocket.OPEN) {
              ws.send(chunk);
            }
          }
        }
        this.callbacks.onStatusChange?.(role, 'connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'UtteranceEnd') {
            this.callbacks.onUtteranceEnd?.(role);
            return;
          }

          if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
            const alternative = data.channel.alternatives[0];
            const rawTranscript = alternative.transcript?.trim() || '';
            const transcript = normalizeTechnicalTranscript(rawTranscript);
            const isFinal = Boolean(data.is_final);
            const speechFinal = Boolean(data.speech_final);

            if (transcript.length > 0) {
              this.callbacks.onTranscript(role, transcript, isFinal, speechFinal);
            } else if (speechFinal) {
              // Deepgram sends empty transcript with speech_final: true to signal speech endpointing
              this.callbacks.onUtteranceEnd?.(role);
            }
          }
        } catch (err) {
          console.error(`[Deepgram] Message parsing error (${role}):`, err);
        }
      };

      ws.onerror = (event) => {
        console.error(`[Deepgram] WebSocket error (${role}):`, event);
        this.callbacks.onError?.(role, event);
        this.callbacks.onStatusChange?.(role, 'error');
      };

      ws.onclose = (event) => {
        console.log(`[Deepgram] WebSocket closed for ${role}: code=${event.code}`);
        if (role === 'interviewer') this.isInterviewerReady = false;
        if (role === 'candidate') this.isCandidateReady = false;
        this.callbacks.onStatusChange?.(role, 'disconnected');

        // Automatic reconnection if stream was supposed to be running
        if (this.shouldBeConnected) {
          clearTimeout(this.reconnectTimers[role]);
          this.reconnectTimers[role] = setTimeout(() => {
            if (this.shouldBeConnected) {
              console.log(`[Deepgram] Auto-reconnecting socket for ${role}...`);
              this.connectSocket(role);
            }
          }, 1500);
        }
      };
    } catch (err) {
      console.error(`[Deepgram] Connection initialization failed for ${role}:`, err);
      this.callbacks.onError?.(role, err);
      if (this.shouldBeConnected) {
        clearTimeout(this.reconnectTimers[role]);
        this.reconnectTimers[role] = setTimeout(() => {
          if (this.shouldBeConnected) this.connectSocket(role);
        }, 2000);
      }
    }
  }

  /**
   * Keep-Alive ping loop to prevent Deepgram from closing idle connections
   */
  private startKeepAlive(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      if (!this.shouldBeConnected) return;
      try {
        if (this.wsInterviewer?.readyState === WebSocket.OPEN) {
          this.wsInterviewer.send(JSON.stringify({ type: 'KeepAlive' }));
        }
        if (this.wsCandidate?.readyState === WebSocket.OPEN) {
          this.wsCandidate.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      } catch (e) {}
    }, 6000);
  }

  private speakerChunksSent = 0;
  private micChunksSent = 0;

  /**
   * Send linear PCM audio chunk to interviewer STT channel
   */
  sendSpeakerChunk(chunk: ArrayBuffer): void {
    if (this.wsInterviewer && this.isInterviewerReady && this.wsInterviewer.readyState === WebSocket.OPEN) {
      this.wsInterviewer.send(chunk);
      this.speakerChunksSent++;
      if (this.speakerChunksSent === 1 || this.speakerChunksSent % 150 === 0) {
        console.log(`[Deepgram] Transmitting speaker audio: ${this.speakerChunksSent} chunks sent.`);
      }
    } else if (this.shouldBeConnected) {
      // Queue up to 10 chunks (~1 sec) while connecting
      if (this.interviewerQueue.length < 10) {
        this.interviewerQueue.push(chunk);
      }
    }
  }

  /**
   * Send linear PCM audio chunk to candidate STT channel
   */
  sendMicChunk(chunk: ArrayBuffer): void {
    if (this.wsCandidate && this.isCandidateReady && this.wsCandidate.readyState === WebSocket.OPEN) {
      this.wsCandidate.send(chunk);
      this.micChunksSent++;
      if (this.micChunksSent === 1 || this.micChunksSent % 150 === 0) {
        console.log(`[Deepgram] Transmitting mic audio: ${this.micChunksSent} chunks sent.`);
      }
    } else if (this.shouldBeConnected) {
      // Queue up to 10 chunks (~1 sec) while connecting
      if (this.candidateQueue.length < 10) {
        this.candidateQueue.push(chunk);
      }
    }
  }

  /**
   * Disconnect all STT WebSockets cleanly
   */
  disconnect(): void {
    this.shouldBeConnected = false;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    clearTimeout(this.reconnectTimers.interviewer);
    clearTimeout(this.reconnectTimers.candidate);

    this.interviewerQueue = [];
    this.candidateQueue = [];

    if (this.wsInterviewer) {
      try {
        if (this.wsInterviewer.readyState === WebSocket.OPEN) {
          this.wsInterviewer.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this.wsInterviewer.close();
      } catch (e) {}
      this.wsInterviewer = null;
      this.isInterviewerReady = false;
    }

    if (this.wsCandidate) {
      try {
        if (this.wsCandidate.readyState === WebSocket.OPEN) {
          this.wsCandidate.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this.wsCandidate.close();
      } catch (e) {}
      this.wsCandidate = null;
      this.isCandidateReady = false;
    }
  }
}
