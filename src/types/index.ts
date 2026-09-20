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

export type AIProvider = 'gemini' | 'openai';

export interface AppSettings {
  deepgramApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  aiProvider: AIProvider;
  modelName: string;
  systemPrompt: string;
  opacity: number;
  fontSize: 'sm' | 'base' | 'lg';
  autoGenerateAnswer: boolean;
  autoTriggerSpeaker?: 'both' | 'interviewer' | 'candidate';
  contentProtection: boolean;
  selectedMicId: string;
  selectedLoopbackId: string;
  audioGainBoost?: number;
  candidateProfileName?: string;
  androidKeywordsBoost?: boolean;
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
