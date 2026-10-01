import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HUDOverlay } from './components/HUDOverlay';
import { MiniWidget } from './components/MiniWidget';
import { DualChannelAudioCapture } from './services/audioCapture';
import { DeepgramLiveStreamer } from './services/deepgramSTT';
import { AssemblyAILiveStreamer } from './services/assemblyAISTT';
import { GroqWhisperSTT } from './services/groqWhisperSTT';
import { LLMService, DEFAULT_SYSTEM_PROMPT } from './services/llmService';
import { ANDROID_SYSTEM_PROMPT, ANDROID_STT_KEYWORDS } from './services/androidKnowledge';
import {
  isQuestionOrPrompt,
  isSubstantiveTurn,
  isExplicitQuestion,
  getFullQuestion,
} from './services/questionDetector';
import { findInstantAnswer } from './services/kotlinQABank';
import { normalizeTechnicalTranscript } from './services/phoneticNormalizer';
import { qaLogger } from './services/logger';
import {
  TranscriptEntry,
  AISuggestion,
  AppSettings,
  AudioLevels,
  SpeakerRole,
} from './types';

const USER_GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const USER_ASSEMBLYAI_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY || '';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  sttProvider: 'assemblyai',
  assemblyaiApiKey: USER_ASSEMBLYAI_KEY,
  groqApiKey: USER_GROQ_KEY,
  deepgramApiKey: import.meta.env.VITE_DEEPGRAM_API_KEY || '',
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  aiProvider: 'groq',
  modelName: 'qwen/qwen3.8-27b',
  systemPrompt: ANDROID_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  opacity: 0.92,
  fontSize: 'base',
  autoExpandWindow: true,
  autoGenerateAnswer: true,
  autoTriggerSpeaker: 'both',
  contentProtection: true,
  selectedMicId: '',
  selectedLoopbackId: '',
  audioGainBoost: 2.0,
  candidateProfileName: 'Sumit Singh (Senior Android Developer - 5 YOE)',
  androidKeywordsBoost: true,
  enableInstantQABank: true,
  hideFromTaskbar: true,
  showSystemTray: true,
};

export const App: React.FC = () => {
  // Application Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('prateek_copilot_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Automatically upgrade old prompt — detect by checking for new strict bullet rules
        const isOutdatedPrompt =
          !parsed.systemPrompt ||
          !parsed.systemPrompt.includes('MANDATORY PROGRAM STRUCTURE (MAIN FUNCTION FIRST, METHOD BELOW)') ||
          !parsed.systemPrompt.includes('CRITICAL TOP-PRIORITY RULE — CODING & PROGRAMMING QUESTIONS') ||
          parsed.systemPrompt.includes('Act as an expert technical interview co-pilot.\nYour goal is to provide concise, direct, bullet-pointed answers') ||
          parsed.systemPrompt.includes('Michael Kors') ||
          parsed.systemPrompt.includes('Club Caddie') ||
          parsed.systemPrompt.includes('Experian') ||
          parsed.systemPrompt.includes('Vocab Tricks');

        const cleanPrompt = isOutdatedPrompt ? ANDROID_SYSTEM_PROMPT : parsed.systemPrompt;

        // Upgrade slow or inaccessible models to fastest working model
        const upgradeModel =
          !parsed.modelName ||
          parsed.modelName === 'groq/compound-mini' ||
          parsed.modelName === 'groq/compound' ||
          parsed.modelName === 'llama-3.1-8b-instant' ||
          parsed.modelName === 'llama3-8b-8192';
        const cleanModel = upgradeModel ? 'qwen/qwen3.8-27b' : parsed.modelName;

        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          language: parsed.language || 'en',
          systemPrompt: cleanPrompt,
          modelName: cleanModel,
          sttProvider: parsed.sttProvider || 'assemblyai',
          assemblyaiApiKey: parsed.assemblyaiApiKey || USER_ASSEMBLYAI_KEY,
          groqApiKey: parsed.groqApiKey || USER_GROQ_KEY,
          geminiApiKey: parsed.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
          candidateProfileName: parsed.candidateProfileName || DEFAULT_SETTINGS.candidateProfileName,
          androidKeywordsBoost: parsed.androidKeywordsBoost ?? true,
          enableInstantQABank: parsed.enableInstantQABank ?? true,
          autoTriggerSpeaker: parsed.autoTriggerSpeaker || 'both',
          hideFromTaskbar: parsed.hideFromTaskbar ?? true,
          showSystemTray: parsed.showSystemTray ?? true,
          autoExpandWindow: parsed.autoExpandWindow ?? true,
        };
        if (isOutdatedPrompt || upgradeModel || parsed.sttProvider === 'webspeech' || !parsed.assemblyaiApiKey || !parsed.groqApiKey) {
          localStorage.setItem('prateek_copilot_settings', JSON.stringify(mergedSettings));
        }
        return mergedSettings;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Transcripts & Suggestions State
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState<{ role: SpeakerRole; text: string } | null>(null);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const suggestionRef = useRef<AISuggestion | null>(suggestion);
  suggestionRef.current = suggestion;

  // Audio Levels & Controls
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({
    micLevel: 0,
    speakerLevel: 0,
    isMicActive: false,
    isSpeakerActive: false,
  });
  const [isAudioCapturing, setIsAudioCapturing] = useState<boolean>(false);
  const [sttStatus, setSttStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [isMiniMode, setIsMiniMode] = useState<boolean>(false);

  const isMicMutedRef = useRef<boolean>(isMicMuted);
  isMicMutedRef.current = isMicMuted;
  const isSpeakerMutedRef = useRef<boolean>(isSpeakerMuted);
  isSpeakerMutedRef.current = isSpeakerMuted;

  // Services references
  const audioCaptureRef = useRef<DualChannelAudioCapture | null>(null);
  const deepgramRef = useRef<DeepgramLiveStreamer | AssemblyAILiveStreamer | GroqWhisperSTT | null>(null);
  const llmRef = useRef<LLMService>(new LLMService());

  // Refs to guarantee freshest state inside async event loops and callbacks
  const transcriptsRef = useRef<TranscriptEntry[]>(transcripts);
  transcriptsRef.current = transcripts;

  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const isGeneratingRef = useRef<boolean>(isGenerating);
  isGeneratingRef.current = isGenerating;

  // Turn Buffers & Silence Debounce Timers
  const turnBuffersRef = useRef<Record<SpeakerRole, string>>({
    interviewer: '',
    candidate: '',
    system: '',
  });

  const silenceTimersRef = useRef<Record<SpeakerRole, any>>({
    interviewer: null,
    candidate: null,
    system: null,
  });

  // "Generate on Enter" mode: buffers the last detected question, waits for Enter key
  const [enterModeEnabled, setEnterModeEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('prateek_enter_mode');
    return saved === 'true';
  });
  const enterModeRef = useRef<boolean>(enterModeEnabled);
  enterModeRef.current = enterModeEnabled;
  const lastBufferedQuestionRef = useRef<{ query: string; role: SpeakerRole } | null>(null);



  const triggerAnswerGenerationRef = useRef<
    (questionText?: string, role?: SpeakerRole, forceManual?: boolean) => Promise<void>
  >(() => Promise.resolve());
  const finalizeTurnRef = useRef<(role: SpeakerRole) => void>(() => {});
  const handleCaptureScreenRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Apply Taskbar and System Tray stealth settings to Electron main process
  useEffect(() => {
    if (window.electronAPI?.setSkipTaskbar) {
      window.electronAPI.setSkipTaskbar(settings.hideFromTaskbar ?? true);
    }
    if (window.electronAPI?.setTrayVisible) {
      window.electronAPI.setTrayVisible(settings.showSystemTray ?? true);
    }
  }, [settings.hideFromTaskbar, settings.showSystemTray]);

  // Listen for mini mode changes from Electron (hotkey Ctrl+Shift+M)
  useEffect(() => {
    if (window.electronAPI?.onMiniModeChanged) {
      const cleanup = window.electronAPI.onMiniModeChanged((mini) => {
        setIsMiniMode(mini);
      });
      return cleanup;
    }
  }, []);

  // Listen for Mobile Remote Controller queries (from user phone)
  useEffect(() => {
    if (!window.electronAPI?.onMobileQuery) return;
    const cleanup = window.electronAPI.onMobileQuery((data) => {
      const q = typeof data === 'string' ? data : data?.query;
      if (q && q.trim()) {
        console.log('[App] Received query from Mobile Remote:', q);
        triggerAnswerGenerationRef.current(q.trim(), 'interviewer', true);
      }
    });
    return cleanup;
  }, []);

  // Listen for Mobile Remote Controller actions (clear, stop, scan-screen)
  useEffect(() => {
    if (!window.electronAPI?.onMobileAction) return;
    const cleanup = window.electronAPI.onMobileAction((data) => {
      if (data.action === 'clear') {
        setSuggestion(null);
        setTranscripts([]);
        window.electronAPI?.broadcastMobileClear?.();
      } else if (data.action === 'stop') {
        llmRef.current?.abort();
        setIsGenerating(false);
        isGeneratingRef.current = false;
      } else if (data.action === 'generate' || data.action === 'enter') {
        console.log('[App] Mobile Remote triggered Generate/Enter action');
        if (turnBuffersRef.current.interviewer) finalizeTurnRef.current('interviewer');
        if (turnBuffersRef.current.candidate) finalizeTurnRef.current('candidate');

        const buffered = lastBufferedQuestionRef.current;
        if (buffered) {
          lastBufferedQuestionRef.current = null;
          triggerAnswerGenerationRef.current(buffered.query, buffered.role, true);
        } else {
          triggerAnswerGenerationRef.current(undefined, 'interviewer', true);
        }
      } else if (data.action === 'scan-screen' || data.action === 'scan' || data.action === 'screenshot') {
        console.log('[App] Mobile Remote triggered Scan Screen action');
        handleCaptureScreenRef.current();
      }
    });
    return cleanup;
  }, []);

  const handleToggleMiniMode = () => {
    if (window.electronAPI?.toggleMiniMode) {
      window.electronAPI.toggleMiniMode().then((mini) => {
        setIsMiniMode(mini);
      });
    } else {
      setIsMiniMode((prev) => !prev);
    }
  };

  // Save settings when modified
  const handleUpdateSettings = (newSettings: AppSettings) => {
    const prevProvider = settingsRef.current.sttProvider;
    const prevLanguage = settingsRef.current.language;
    setSettings(newSettings);
    localStorage.setItem('prateek_copilot_settings', JSON.stringify(newSettings));
    if (deepgramRef.current) {
      if ((deepgramRef.current as any).setLanguage) {
        (deepgramRef.current as any).setLanguage(newSettings.language || 'en');
      }
      if ((deepgramRef.current as any).setApiKey) {
        if (newSettings.sttProvider === 'assemblyai') {
          (deepgramRef.current as any).setApiKey(newSettings.assemblyaiApiKey || '');
        } else if (newSettings.sttProvider === 'groq') {
          (deepgramRef.current as any).setApiKey(newSettings.groqApiKey);
        } else {
          (deepgramRef.current as any).setApiKey(newSettings.deepgramApiKey);
          (deepgramRef.current as any).setKeywords(
            newSettings.androidKeywordsBoost !== false ? ANDROID_STT_KEYWORDS : []
          );
        }
      }
    }
    if (audioCaptureRef.current && newSettings.audioGainBoost) {
      audioCaptureRef.current.setGainBoost(newSettings.audioGainBoost);
    }
    if (isAudioCapturing && (prevProvider !== newSettings.sttProvider || prevLanguage !== newSettings.language)) {
      stopAudioPipeline();
      setTimeout(() => {
        startAudioPipeline();
      }, 300);
    }
  };

  /**
   * Append/Group transcript chunks cleanly into visual bubbles
   */
  const appendTranscript = useCallback((role: SpeakerRole, text: string) => {
    const now = Date.now();
    setTranscripts((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        // Merge into existing bubble if same speaker within 4.5 seconds
        if (last.role === role && now - last.timestamp < 4500) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: `${last.text} ${text}`.trim(),
            timestamp: now,
          };
          return updated;
        }
      }

      return [
        ...prev,
        {
          id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          text,
          timestamp: now,
          isFinal: true,
        },
      ];
    });
  }, []);

  /**
   * AI Answer Generation Trigger
   */
  /**
   * AI Answer Generation Trigger
   */
  const triggerAnswerGeneration = useCallback(
    async (questionText?: string, speakerRole: SpeakerRole = 'interviewer', forceManual = false) => {
      // If the current answer is locked/pinned, do not overwrite unless forced manually
      if (suggestionRef.current?.isPinned && !forceManual) {
        console.log('[Copilot] Current answer is pinned/locked. Skipping auto-trigger.');
        return;
      }

      const currentSettings = settingsRef.current;
      const currentTranscripts = transcriptsRef.current;

      // Determine query: explicit arg or search recent history for latest question/substantive prompt
      let query = questionText?.trim();

      if (!query) {
        // 1. Check unfinalized turn buffers first (in case speech just completed before silence timer fired)
        const unfinalizedInterviewer = (turnBuffersRef.current.interviewer || '').trim();
        const unfinalizedCandidate = (turnBuffersRef.current.candidate || '').trim();
        if (unfinalizedInterviewer && unfinalizedInterviewer.length >= 3) {
          query = unfinalizedInterviewer;
          turnBuffersRef.current.interviewer = '';
        } else if (unfinalizedCandidate && unfinalizedCandidate.length >= 3) {
          query = unfinalizedCandidate;
          turnBuffersRef.current.candidate = '';
        }

        // 2. Search transcripts for question or latest turn
        if (!query) {
          const lastQuestion = [...currentTranscripts]
            .reverse()
            .find((t) => isQuestionOrPrompt(t.text, currentSettings.language || 'en'));
          const lastTurn = [...currentTranscripts]
            .reverse()
            .find((t) => isSubstantiveTurn(t.text));
          query = lastQuestion?.text || lastTurn?.text || (currentTranscripts.length > 0 ? currentTranscripts[currentTranscripts.length - 1].text : '');
        }
      } else if (!forceManual && query.length < 15) {
        const fullQ = getFullQuestion(speakerRole, query, currentTranscripts);
        if (fullQ && fullQ.length >= query.length) {
          query = fullQ;
        }
      }

      if (!query || query.trim().length === 0 || (!forceManual && query.trim().length < 3)) {
        console.log('[Copilot] No valid question or speech found to generate answer for.');
        return;
      }

      console.log(`[Copilot] 🚀 Processing query for answer generation: "${query}" (forceManual: ${forceManual})`);

      // Clear live transcript feed so answered question is deleted and app focuses on new incoming question
      setTranscripts([]);
      transcriptsRef.current = [];
      setInterimText(null);
      turnBuffersRef.current = { interviewer: '', candidate: '', system: '' };
      lastBufferedQuestionRef.current = null;
      if (silenceTimersRef.current.interviewer) {
        clearTimeout(silenceTimersRef.current.interviewer);
        silenceTimersRef.current.interviewer = null;
      }
      if (silenceTimersRef.current.candidate) {
        clearTimeout(silenceTimersRef.current.candidate);
        silenceTimersRef.current.candidate = null;
      }
      if (silenceTimersRef.current.system) {
        clearTimeout(silenceTimersRef.current.system);
        silenceTimersRef.current.system = null;
      }

      // 0. Check pre-saved Instant Knowledge Base (0ms latency, zero tokens, instant answer)
      if (currentSettings.enableInstantQABank !== false) {
        const instantMatch = findInstantAnswer(query, currentSettings.language || 'en');
        if (instantMatch) {
          setSuggestion({
            id: Date.now().toString(),
            question: query,
            bullets: instantMatch.bullets,
            keywords: instantMatch.keywords,
            timestamp: Date.now(),
            isStreaming: false,
            role: speakerRole,
            isPinned: false,
          });
          window.electronAPI?.broadcastMobileSuggestion?.({
            id: Date.now().toString(),
            question: query,
            bullets: instantMatch.bullets,
            isStreaming: false,
            role: speakerRole,
          });
          setIsGenerating(false);
          isGeneratingRef.current = false;

          // Log Instant QA answer
          qaLogger.logQA({
            question: query,
            answer: instantMatch.bullets.join('\n'),
            speaker: speakerRole,
            provider: 'Instant QA Bank',
            model: 'Offline Knowledge',
            latencyMs: 0,
            source: 'instant-qa',
          });
          return;
        }
      }

      let activeProvider = currentSettings.aiProvider;
      let activeKey =
        activeProvider === 'gemini'
          ? (currentSettings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '')
          : activeProvider === 'groq'
          ? (currentSettings.groqApiKey || USER_GROQ_KEY)
          : currentSettings.openaiApiKey;

      // Auto-fallback if the chosen provider has no key configured
      if (!activeKey || activeKey.trim() === '') {
        if (currentSettings.groqApiKey || USER_GROQ_KEY) {
          activeProvider = 'groq';
          activeKey = currentSettings.groqApiKey || USER_GROQ_KEY;
        } else if (currentSettings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY) {
          activeProvider = 'gemini';
          activeKey = currentSettings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;
        }
      }

      if (!activeKey) {
        const errorMsg = `Please configure your ${currentSettings.aiProvider.toUpperCase()} API key in Settings to stream answers.`;
        setSuggestion({
          id: Date.now().toString(),
          question: query,
          bullets: [errorMsg],
          keywords: [],
          timestamp: Date.now(),
          isStreaming: false,
          role: speakerRole,
        });
        window.electronAPI?.broadcastMobileSuggestion?.({
          id: Date.now().toString(),
          question: query,
          bullets: [errorMsg],
          isStreaming: false,
          role: speakerRole,
        });
        return;
      }

      setIsGenerating(true);
      isGeneratingRef.current = true;
      const newSuggestionId = Date.now().toString();

      setSuggestion({
        id: newSuggestionId,
        question: query,
        bullets: ['Formulating response...'],
        keywords: [],
        timestamp: Date.now(),
        isStreaming: true,
        role: speakerRole,
        isPinned: false,
      });

      window.electronAPI?.broadcastMobileSuggestion?.({
        id: newSuggestionId,
        question: query,
        bullets: ['Formulating response...'],
        isStreaming: true,
        role: speakerRole,
      });

      const crossFallbackKey =
        currentSettings.aiProvider === 'groq'
          ? (currentSettings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '')
          : (currentSettings.groqApiKey || USER_GROQ_KEY);

      const streamStartTime = Date.now();

      try {
        await llmRef.current.streamAnswer(
          query,
          currentTranscripts,
          currentSettings.aiProvider,
          activeKey,
          currentSettings.systemPrompt,
          {
            onToken: (_token, accumulated) => {
              const lines = accumulated
                .split('\n')
                .map((l) => l.trimEnd());

              setSuggestion((prev) => ({
                id: newSuggestionId,
                question: query!,
                bullets: lines.length > 0 ? lines : [accumulated],
                keywords: [],
                timestamp: Date.now(),
                isStreaming: true,
                role: speakerRole,
                isPinned: prev?.isPinned ?? false,
              }));

              window.electronAPI?.broadcastMobileToken?.({
                id: newSuggestionId,
                question: query!,
                bullets: lines.length > 0 ? lines : [accumulated],
                isStreaming: true,
                role: speakerRole,
              });
            },
            onComplete: (fullText) => {
              const lines = fullText
                .split('\n')
                .map((l) => l.trimEnd());

              setSuggestion((prev) => ({
                id: newSuggestionId,
                question: query!,
                bullets: lines.length > 0 ? lines : [fullText],
                keywords: [],
                timestamp: Date.now(),
                isStreaming: false,
                role: speakerRole,
                isPinned: prev?.isPinned ?? false,
              }));

              window.electronAPI?.broadcastMobileSuggestion?.({
                id: newSuggestionId,
                question: query!,
                bullets: lines.length > 0 ? lines : [fullText],
                isStreaming: false,
                role: speakerRole,
              });

              setIsGenerating(false);
              isGeneratingRef.current = false;

              // Log Question and Generated Answer
              const latencyMs = Date.now() - streamStartTime;
              qaLogger.logQA({
                question: query!,
                answer: fullText,
                speaker: speakerRole,
                provider: currentSettings.aiProvider,
                model: currentSettings.modelName,
                latencyMs,
                source: forceManual ? 'manual' : enterModeRef.current ? 'stt-enter' : 'stt-auto',
              });
            },
            onError: (err) => {
              console.error('Generation stream error:', err);
              const errBullet = `Error: ${err.message || 'Failed to generate answer'}`;
              setSuggestion((prev) => ({
                id: newSuggestionId,
                question: query!,
                bullets: [errBullet],
                keywords: [],
                timestamp: Date.now(),
                isStreaming: false,
                role: speakerRole,
                isPinned: prev?.isPinned ?? false,
              }));
              window.electronAPI?.broadcastMobileSuggestion?.({
                id: newSuggestionId,
                question: query!,
                bullets: [errBullet],
                isStreaming: false,
                role: speakerRole,
              });
              setIsGenerating(false);
              isGeneratingRef.current = false;

              // Log Error in Answer Generation
              const latencyMs = Date.now() - streamStartTime;
              qaLogger.logQA({
                question: query!,
                answer: `Error: ${err.message}`,
                speaker: speakerRole,
                provider: currentSettings.aiProvider,
                model: currentSettings.modelName,
                latencyMs,
                source: forceManual ? 'manual' : enterModeRef.current ? 'stt-enter' : 'stt-auto',
              });
            },
          },
          currentSettings.modelName,
          crossFallbackKey,
          currentSettings.language || 'en'
        );
      } catch (fatalErr: any) {
        console.error('[Copilot] Unexpected error in streamAnswer:', fatalErr);
        const errBullet = `Error: ${fatalErr?.message || 'Streaming failed'}`;
        setSuggestion((prev) => ({
          id: newSuggestionId,
          question: query!,
          bullets: [errBullet],
          keywords: [],
          timestamp: Date.now(),
          isStreaming: false,
          role: speakerRole,
          isPinned: prev?.isPinned ?? false,
        }));
        window.electronAPI?.broadcastMobileSuggestion?.({
          id: newSuggestionId,
          question: query!,
          bullets: [errBullet],
          isStreaming: false,
          role: speakerRole,
        });
      } finally {
        setIsGenerating(false);
        isGeneratingRef.current = false;
      }
    },
    []
  );

  const handleTogglePinAnswer = useCallback(() => {
    setSuggestion((prev) => {
      if (!prev) return null;
      return { ...prev, isPinned: !prev.isPinned };
    });
  }, []);

  triggerAnswerGenerationRef.current = triggerAnswerGeneration;

  /**
   * Finalize a speaker's turn and automatically trigger AI answer if criteria are met
   */
  const finalizeTurn = useCallback(
    (role: SpeakerRole) => {
      // Clear pending silence timer for this role
      if (silenceTimersRef.current[role]) {
        clearTimeout(silenceTimersRef.current[role]!);
        silenceTimersRef.current[role] = null;
      }

      const turnText = (turnBuffersRef.current[role] || '').trim();
      turnBuffersRef.current[role] = '';

      if (!turnText || turnText.length < 4) return;

      const currentSettings = settingsRef.current;
      if (!currentSettings.autoGenerateAnswer) return;

      const triggerMode = currentSettings.autoTriggerSpeaker || 'both';

      // Reconstruct the full question from consecutive utterances to avoid fragmented queries
      const fullQuestion = getFullQuestion(role, turnText, transcriptsRef.current);
      const questionToTrigger = fullQuestion || turnText;

      // ================= CANDIDATE SPEECH OVERWRITE PROTECTION =================
      if (role === 'candidate') {
        if (triggerMode === 'interviewer') {
          return;
        }

        if (isGeneratingRef.current) {
          console.log('[Copilot] Candidate speech ignored: AI answer is currently generating.');
          return;
        }

        const isRecentSuggestion = suggestionRef.current && Date.now() - suggestionRef.current.timestamp < 6000;
        if (isRecentSuggestion && !isExplicitQuestion(questionToTrigger, currentSettings.language || 'en')) {
          console.log('[Copilot] Candidate is explaining answer. Preserving current suggestion.');
          return;
        }
      }

      // If active suggestion is locked/pinned, do not auto-trigger
      if (suggestionRef.current?.isPinned) {
        console.log('[Copilot] Current answer is pinned. Skipping auto-trigger.');
        return;
      }

      let shouldTrigger = false;

      if (role === 'interviewer') {
        shouldTrigger = isQuestionOrPrompt(questionToTrigger, currentSettings.language || 'en');
      } else if (role === 'candidate' && (triggerMode === 'candidate' || triggerMode === 'both')) {
        shouldTrigger = isQuestionOrPrompt(questionToTrigger, currentSettings.language || 'en');
      }

      if (!shouldTrigger) return;

      qaLogger.logQuestionDetected(role, questionToTrigger, enterModeRef.current ? 'enter-mode (buffered)' : 'auto-trigger');

      // ================= ENTER MODE: Buffer question, wait for Enter key =================
      if (enterModeRef.current) {
        console.log(`[Copilot] Enter-mode: Buffered question from ${role}: "${questionToTrigger}"`);
        lastBufferedQuestionRef.current = { query: questionToTrigger, role };
        return;
      }

      // ================= AUTO MODE: Trigger immediately =================
      console.log(`[Copilot] Auto-triggering real-time answer generation for ${role}: "${questionToTrigger}"`);
      triggerAnswerGenerationRef.current(questionToTrigger, role);
    },
    []
  );

  finalizeTurnRef.current = finalizeTurn;

  /**
   * Start Audio Capture & STT Pipeline (AssemblyAI, Deepgram, or Groq)
   */
  const startAudioPipeline = async () => {
    const currentSettings = settingsRef.current;
    const provider = currentSettings.sttProvider || 'assemblyai';

    if (provider === 'assemblyai' && !currentSettings.assemblyaiApiKey) {
      alert('Please enter your AssemblyAI API Key in Settings to enable real-time speech-to-text.\n\n(Get free $50 credits at assemblyai.com, or switch to Deepgram in Settings).');
      return;
    }
    if (provider === 'deepgram' && !currentSettings.deepgramApiKey) {
      alert('Please enter your Deepgram API Key in Settings to enable real-time speech-to-text.');
      return;
    }
    if (provider === 'groq' && !currentSettings.groqApiKey) {
      alert('Please enter your Groq API Key in Settings to enable real-time Whisper speech-to-text.');
      return;
    }

    try {
      const currentLang = currentSettings.language || 'en';

      const sttCallbacks = {
        onTranscript: (role: SpeakerRole, text: string, isFinal: boolean, speechFinal: boolean) => {
          const cleanText = normalizeTechnicalTranscript(text, currentLang);
          if (!isFinal) {
            setInterimText({ role, text: cleanText });
          } else {
            setInterimText((prev) => (prev?.role === role ? null : prev));

            // Log finalized transcript turn
            qaLogger.logTranscript(role, cleanText);

            // Append to turn buffer
            const prevBuf = turnBuffersRef.current[role];
            turnBuffersRef.current[role] = prevBuf ? `${prevBuf} ${cleanText}` : cleanText;

            // Group into visual transcripts
            appendTranscript(role, cleanText);

            // If the other speaker had buffered speech, finalize their turn first
            const otherRole: SpeakerRole = role === 'interviewer' ? 'candidate' : 'interviewer';
            if (turnBuffersRef.current[otherRole]) {
              finalizeTurnRef.current(otherRole);
            }

            // Responsive silence debounce timer
            if (silenceTimersRef.current[role]) {
              clearTimeout(silenceTimersRef.current[role]!);
            }
            silenceTimersRef.current[role] = setTimeout(() => {
              finalizeTurnRef.current(role);
            }, speechFinal ? 450 : 800);
          }
        },
        onUtteranceEnd: (role: SpeakerRole) => {
          if (silenceTimersRef.current[role]) {
            clearTimeout(silenceTimersRef.current[role]!);
          }
          silenceTimersRef.current[role] = setTimeout(() => {
            finalizeTurnRef.current(role);
          }, 200);
        },
        onError: (role: SpeakerRole, err: any) => {
          console.warn(`[STT] error on ${role}:`, err);
          setSttStatus('error');
        },
        onStatusChange: (role: SpeakerRole, status: any) => {
          console.log(`[STT] Status for ${role}: ${status}`);
          setSttStatus(status);
        },
      };

      // 1. Initialize selected STT Engine
      if (provider === 'assemblyai') {
        const assembly = new AssemblyAILiveStreamer(currentSettings.assemblyaiApiKey || '', sttCallbacks, currentLang);
        assembly.connect();
        deepgramRef.current = assembly;
      } else if (provider === 'deepgram') {
        const deepgram = new DeepgramLiveStreamer(
          currentSettings.deepgramApiKey,
          sttCallbacks,
          currentSettings.androidKeywordsBoost !== false ? ANDROID_STT_KEYWORDS : [],
          currentLang
        );
        deepgram.connect();
        deepgramRef.current = deepgram;
      } else {
        const groqSTT = new GroqWhisperSTT(currentSettings.groqApiKey, sttCallbacks, currentLang);
        groqSTT.connect();
        deepgramRef.current = groqSTT;
      }

      // 2. Initialize Dual Channel Audio Capture
      const audioCapture = new DualChannelAudioCapture({
        onMicPcmChunk: (chunk) => {
          if (!isMicMutedRef.current && deepgramRef.current) {
            deepgramRef.current.sendMicChunk(chunk);
          }
        },
        onSpeakerPcmChunk: (chunk) => {
          if (!isSpeakerMutedRef.current && deepgramRef.current) {
            deepgramRef.current.sendSpeakerChunk(chunk);
          }
        },
        onAudioLevels: (levels) => {
          setAudioLevels(levels);
        },
        onError: (err) => {
          console.error('Audio capture error:', err);
        },
      });

      await audioCapture.start(
        currentSettings.selectedMicId,
        currentSettings.selectedLoopbackId,
        currentSettings.audioGainBoost || 2.0
      );
      audioCaptureRef.current = audioCapture;
      setIsAudioCapturing(true);
    } catch (err: any) {
      console.error('Failed to start audio pipeline:', err);
      alert(`Audio capture failed: ${err.message}`);
    }
  };

  /**
   * Stop Audio Capture & STT
   */
  const stopAudioPipeline = () => {
    // Clear all pending debounce silence timers
    if (silenceTimersRef.current.interviewer) {
      clearTimeout(silenceTimersRef.current.interviewer);
      silenceTimersRef.current.interviewer = null;
    }
    if (silenceTimersRef.current.candidate) {
      clearTimeout(silenceTimersRef.current.candidate);
      silenceTimersRef.current.candidate = null;
    }
    if (silenceTimersRef.current.system) {
      clearTimeout(silenceTimersRef.current.system);
      silenceTimersRef.current.system = null;
    }
    turnBuffersRef.current = { interviewer: '', candidate: '', system: '' };

    if (audioCaptureRef.current) {
      audioCaptureRef.current.stop();
      audioCaptureRef.current = null;
    }
    if (deepgramRef.current) {
      deepgramRef.current.disconnect();
      deepgramRef.current = null;
    }
    setIsAudioCapturing(false);
    setSttStatus('disconnected');
    setAudioLevels({
      micLevel: 0,
      speakerLevel: 0,
      isMicActive: false,
      isSpeakerActive: false,
    });
    setInterimText(null);
  };

  // Quick simulate question to test live transcripts and AI answers
  const handleSimulateQuestion = useCallback(() => {
    const sampleQuestions = [
      "Can you explain the difference between StateFlow and SharedFlow in Kotlin Coroutines, and when would you choose one over the other?",
      "How does Jetpack Compose handle recomposition, and how can we optimize performance using remember and derivedStateOf?",
      "What is the difference between launch and async in Kotlin Coroutines? How does SupervisorJob prevent failure propagation?",
      "Explain how you design an offline-first Android app architecture using Room, Flow, and clean MVVM.",
    ];
    const randomQ = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
    appendTranscript('interviewer', randomQ);
    triggerAnswerGeneration(randomQ, 'interviewer', true);
  }, [appendTranscript, triggerAnswerGeneration]);

  // Auto-start audio pipeline on launch if configured
  useEffect(() => {
    const currentSettings = settingsRef.current;
    const provider = currentSettings.sttProvider || 'assemblyai';
    const hasKey =
      (provider === 'assemblyai' && Boolean(currentSettings.assemblyaiApiKey)) ||
      (provider === 'deepgram' && Boolean(currentSettings.deepgramApiKey)) ||
      (provider === 'groq' && Boolean(currentSettings.groqApiKey));

    if (hasKey && !isAudioCapturing) {
      const timer = setTimeout(() => {
        startAudioPipeline().catch((err) => {
          console.log('[AutoStart] Pipeline auto-start deferred:', err?.message || err);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudioPipeline();
      llmRef.current.abort();
    };
  }, []);

  /**
   * Screen / Chat Vision Capture Trigger:
   * Captures screen snapshot and uses Gemini Vision to detect and answer chat / coding questions.
   */
  const handleCaptureScreen = async () => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings to use Screen / Chat Vision.');
      return;
    }

    let screenshotDataUrl: string | null = null;

    // Strategy 1: If audio capture is already running with an active screen display stream,
    // grab the live frame instantly with 0ms delay and no OS prompt
    if (audioCaptureRef.current?.getIsRunning()) {
      try {
        screenshotDataUrl = await audioCaptureRef.current.captureCurrentFrame();
        if (screenshotDataUrl) {
          console.log('[ScreenScan] Successfully grabbed snapshot from active audio display stream');
        }
      } catch (err) {
        console.warn('[ScreenScan] Active display stream capture failed, trying next strategy:', err);
      }
    }

    // Strategy 2: Electron Main Process capture (DesktopCapturer + Windows GDI fallback)
    if (!screenshotDataUrl && window.electronAPI?.captureScreen) {
      try {
        const result = await window.electronAPI.captureScreen();
        if (result && result.startsWith('data:image/') && result.length > 100) {
          screenshotDataUrl = result;
          console.log('[ScreenScan] Successfully captured screen via Electron API');
        }
      } catch (err) {
        console.warn('[ScreenScan] electronAPI.captureScreen failed, trying displayMedia fallback:', err);
      }
    }

    // Strategy 3: Chromium getDisplayMedia fallback
    if (!screenshotDataUrl && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        await new Promise<void>((resolve) => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          } else {
            video.onloadeddata = () => resolve();
            setTimeout(resolve, 500);
          }
        });

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 100) {
            screenshotDataUrl = dataUrl;
            console.log('[ScreenScan] Successfully captured screen via getDisplayMedia fallback');
          }
        }
        stream.getTracks().forEach((track) => track.stop());
      } catch (e: any) {
        console.warn('[ScreenScan] Fallback displayMedia capture error:', e);
      }
    }

    if (!screenshotDataUrl) {
      alert('Screen capture failed. Please check screen recording permissions or restart the app with "npm run dev".');
      return;
    }

    try {
      setIsGenerating(true);
      const newSuggestionId = Date.now().toString();
      const visionStartSuggestion = {
        id: newSuggestionId,
        question: 'Scanning screen & meeting chatbox for question...',
        bullets: ['Inspecting screen image with Gemini Vision...'],
        keywords: [],
        timestamp: Date.now(),
        isStreaming: true,
      };
      setSuggestion(visionStartSuggestion);
      window.electronAPI?.broadcastMobileSuggestion?.(visionStartSuggestion);

      const visionStartTime = Date.now();

      await llmRef.current.streamVisionAnswer(
        screenshotDataUrl,
        settings.geminiApiKey,
        settings.systemPrompt,
        {
          onToken: (_token, accumulated) => {
            const lines = accumulated
              .split('\n')
              .map((l) => l.trimEnd());

            const updatedBullets = lines.length > 0 ? lines : [accumulated];
            setSuggestion({
              id: newSuggestionId,
              question: 'Detected Question / Problem from Screen',
              bullets: updatedBullets,
              keywords: [],
              timestamp: Date.now(),
              isStreaming: true,
            });

            window.electronAPI?.broadcastMobileToken?.({
              id: newSuggestionId,
              question: 'Detected Question / Problem from Screen',
              bullets: updatedBullets,
              isStreaming: true,
              role: 'system',
            });
          },
          onComplete: (fullText) => {
            const lines = fullText
              .split('\n')
              .map((l) => l.trimEnd());

            const finalBullets = lines.length > 0 ? lines : [fullText];
            setSuggestion({
              id: newSuggestionId,
              question: 'Detected Question / Problem from Screen',
              bullets: finalBullets,
              keywords: [],
              timestamp: Date.now(),
              isStreaming: false,
            });

            window.electronAPI?.broadcastMobileSuggestion?.({
              id: newSuggestionId,
              question: 'Detected Question / Problem from Screen',
              bullets: finalBullets,
              isStreaming: false,
              role: 'system',
            });

            setIsGenerating(false);

            // Log Screen Vision Q&A
            const latencyMs = Date.now() - visionStartTime;
            qaLogger.logQA({
              question: 'Detected Question / Problem from Screen',
              answer: fullText,
              speaker: 'system',
              provider: 'gemini',
              model: 'gemini-vision',
              latencyMs,
              source: 'vision',
            });
          },
          onError: (err) => {
            console.error('Vision error:', err);
            const errBullets = [`Screen Vision Error: ${err.message}`];
            setSuggestion((prev) =>
              prev
                ? {
                    ...prev,
                    bullets: errBullets,
                    isStreaming: false,
                  }
                : null
            );

            window.electronAPI?.broadcastMobileSuggestion?.({
              id: newSuggestionId,
              question: 'Screen Vision Error',
              bullets: errBullets,
              isStreaming: false,
              role: 'system',
            });

            setIsGenerating(false);

            // Log Screen Vision Error
            const latencyMs = Date.now() - visionStartTime;
            qaLogger.logQA({
              question: 'Detected Question / Problem from Screen',
              answer: `Screen Vision Error: ${err.message}`,
              speaker: 'system',
              provider: 'gemini',
              model: 'gemini-vision',
              latencyMs,
              source: 'vision',
            });
          },
        }
      );
    } catch (err: any) {
      console.error('Screen capture error:', err);
      alert(`Screen capture failed: ${err.message}`);
      setIsGenerating(false);
    }
  };

  handleCaptureScreenRef.current = handleCaptureScreen;

  // Global hotkey listener registered in Electron main process (Alt+S)
  useEffect(() => {
    if (window.electronAPI?.onTriggerScreenCapture) {
      const unsub = window.electronAPI.onTriggerScreenCapture(() => {
        console.log('[Copilot] Global hotkey Alt+S triggered screen capture');
        handleCaptureScreen();
      });
      return unsub;
    }
  }, [handleCaptureScreen]);

  // Keyboard shortcuts
  // - Enter          : In Enter-mode → generate from buffered question
  // - Ctrl + Enter   : Manual trigger (always works)
  // - Alt + S / Ctrl+Shift+S : Screen scan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Plain Enter key: triggers buffered question, pending speech buffer, or latest transcript
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }

        e.preventDefault();
        // 1. Flush any pending speaker silence buffer immediately
        if (turnBuffersRef.current.interviewer) finalizeTurnRef.current('interviewer');
        if (turnBuffersRef.current.candidate) finalizeTurnRef.current('candidate');

        const buffered = lastBufferedQuestionRef.current;
        if (buffered) {
          console.log(`[Copilot] Enter pressed → generating answer for buffered: "${buffered.query}"`);
          lastBufferedQuestionRef.current = null;
          triggerAnswerGenerationRef.current(buffered.query, buffered.role, true);
        } else {
          console.log(`[Copilot] Enter pressed → generating answer from active conversation`);
          triggerAnswerGenerationRef.current(undefined, 'interviewer', true);
        }
      }
      // Ctrl/Cmd + Enter always manually triggers
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerAnswerGeneration(undefined, 'interviewer', true);
      }
      if ((e.altKey && (e.key === 's' || e.key === 'S')) || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's'))) {
        e.preventDefault();
        handleCaptureScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerAnswerGeneration, handleCaptureScreen]);

  // Support pasting text directly from clipboard (e.g. copied from Meet chat)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text && text.trim().length > 3) {
        triggerAnswerGeneration(text.trim());
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [triggerAnswerGeneration]);

  return (
    <div className="h-screen w-screen bg-transparent" style={{ padding: isMiniMode ? 0 : '0.5rem', boxSizing: 'border-box' }}>
      {isMiniMode ? (
        /* ——— MINI FLOATING ICON MODE ——— */
        <MiniWidget
          isAudioCapturing={isAudioCapturing}
          isGenerating={isGenerating}
          sttStatus={sttStatus}
          onExpand={handleToggleMiniMode}
          onClose={() => {
            if (window.electronAPI?.closeWindow) {
              window.electronAPI.closeWindow();
            }
          }}
        />
      ) : (
        /* ——— FULL HUD MODE ——— */
        <HUDOverlay
          transcripts={transcripts}
          interimText={interimText}
          suggestion={suggestion}
          isGenerating={isGenerating}
          audioLevels={audioLevels}
          isAudioCapturing={isAudioCapturing}
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onToggleMicMute={() => setIsMicMuted(!isMicMuted)}
          onToggleSpeakerMute={() => setIsSpeakerMuted(!isSpeakerMuted)}
          onClearTranscripts={() => {
            setTranscripts([]);
            turnBuffersRef.current = { interviewer: '', candidate: '', system: '' };
          }}
          onGenerateManualAnswer={() => triggerAnswerGeneration(undefined, 'interviewer', true)}
          onTogglePinAnswer={handleTogglePinAnswer}
          onCaptureScreen={handleCaptureScreen}
          onStopGenerating={() => {
            llmRef.current.abort();
            setIsGenerating(false);
          }}
          onStartAudio={startAudioPipeline}
          onStopAudio={stopAudioPipeline}
          sttStatus={sttStatus}
          onSimulateQuestion={handleSimulateQuestion}
          enterModeEnabled={enterModeEnabled}
          onToggleEnterMode={() => {
            const next = !enterModeEnabled;
            setEnterModeEnabled(next);
            enterModeRef.current = next;
            localStorage.setItem('prateek_enter_mode', String(next));
            lastBufferedQuestionRef.current = null;
          }}
          onToggleMiniMode={handleToggleMiniMode}
        />
      )}
    </div>
  );
};
