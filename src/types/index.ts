export type SpeakerRole = 'interviewer' | 'candidate' | 'system';

export interface TranscriptEntry {
  id: string;
  role: SpeakerRole;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface AISuggestion {
  id: string;
  question: string;
  bullets: string[];
  keywords: string[];
  timestamp: number;
  isStreaming: boolean;
  role?: SpeakerRole;
  isPinned?: boolean;
}

export interface QALogEntry {
  id: string;
  timestamp: number;
  timeString: string;
  speaker: SpeakerRole;
  question: string;
  answer: string;
  provider: string;
  model?: string;
  latencyMs?: number;
  source?: 'stt-auto' | 'stt-enter' | 'manual' | 'vision' | 'instant-qa' | 'simulate' | 'clipboard';
}

export type AIProvider = 'gemini' | 'openai' | 'groq';
export type STTProvider = 'assemblyai' | 'deepgram' | 'groq';
export type LanguageMode = 'en' | 'hi' | 'hinglish';

export interface AppSettings {
  language?: LanguageMode;
  sttProvider?: STTProvider;
  assemblyaiApiKey?: string;
  groqApiKey: string;
  deepgramApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  aiProvider: AIProvider;
  modelName: string;
  systemPrompt: string;
  opacity: number;
  fontSize: 'sm' | 'base' | 'lg';
  autoExpandWindow?: boolean;
  autoGenerateAnswer: boolean;
  autoTriggerSpeaker?: 'both' | 'interviewer' | 'candidate';
  contentProtection: boolean;
  selectedMicId: string;
  selectedLoopbackId: string;
  audioGainBoost?: number;
  candidateProfileName?: string;
  androidKeywordsBoost?: boolean;
  enableInstantQABank?: boolean;
  hideFromTaskbar?: boolean;
  showSystemTray?: boolean;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface AudioLevels {
  micLevel: number; // 0 - 100
  speakerLevel: number; // 0 - 100
  isMicActive: boolean;
  isSpeakerActive: boolean;
}
