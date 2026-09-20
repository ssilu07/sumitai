import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HUDOverlay } from './components/HUDOverlay';
import { DualChannelAudioCapture } from './services/audioCapture';
import { DeepgramLiveStreamer } from './services/deepgramSTT';
import { LLMService, DEFAULT_SYSTEM_PROMPT } from './services/llmService';
import { ANDROID_SYSTEM_PROMPT, ANDROID_STT_KEYWORDS } from './services/androidKnowledge';
import { isQuestionOrPrompt, isSubstantiveTurn, isExplicitQuestion, getFullQuestion } from './services/questionDetector';
import { findInstantAnswer } from './services/kotlinQABank';
import { normalizeTechnicalTranscript } from './services/phoneticNormalizer';
import {
  TranscriptEntry,
  AISuggestion,
  AppSettings,
  AudioLevels,
  SpeakerRole,
} from './types';

const DEFAULT_SETTINGS: AppSettings = {
  deepgramApiKey: import.meta.env.VITE_DEEPGRAM_API_KEY || '',
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  aiProvider: (import.meta.env.VITE_DEFAULT_AI_PROVIDER as any) || 'gemini',
  modelName: 'gemini-flash-latest',
  systemPrompt: ANDROID_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  opacity: 0.92,
  fontSize: 'base',
  autoGenerateAnswer: true,
  autoTriggerSpeaker: 'both',
  contentProtection: true,
  selectedMicId: '',
  selectedLoopbackId: '',
  audioGainBoost: 2.0,
  candidateProfileName: 'Sumit Singh (Senior Android Developer - 5 YOE)',
  androidKeywordsBoost: true,
};

export const App: React.FC = () => {
  // Application Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('prateek_copilot_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Automatically upgrade old prompt or prompt containing removed projects
        const isOutdatedPrompt =
          !parsed.systemPrompt ||
          parsed.systemPrompt.includes('Act as an expert technical interview co-pilot.\nYour goal is to provide concise, direct, bullet-pointed answers') ||
          parsed.systemPrompt.includes('Michael Kors') ||
          parsed.systemPrompt.includes('Club Caddie') ||
          parsed.systemPrompt.includes('Experian') ||
          parsed.systemPrompt.includes('Vocab Tricks');

        const cleanPrompt = isOutdatedPrompt ? ANDROID_SYSTEM_PROMPT : parsed.systemPrompt;
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          systemPrompt: cleanPrompt,
          candidateProfileName: parsed.candidateProfileName || DEFAULT_SETTINGS.candidateProfileName,
          androidKeywordsBoost: parsed.androidKeywordsBoost ?? true,
          autoTriggerSpeaker: parsed.autoTriggerSpeaker || 'both',
        };
        if (isOutdatedPrompt) {
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
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);

  const isMicMutedRef = useRef<boolean>(isMicMuted);
  isMicMutedRef.current = isMicMuted;
  const isSpeakerMutedRef = useRef<boolean>(isSpeakerMuted);
  isSpeakerMutedRef.current = isSpeakerMuted;

  // Services references
  const audioCaptureRef = useRef<DualChannelAudioCapture | null>(null);
  const deepgramRef = useRef<DeepgramLiveStreamer | null>(null);
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

  const triggerAnswerGenerationRef = useRef<
    (questionText?: string, role?: SpeakerRole, forceManual?: boolean) => Promise<void>
  >(() => Promise.resolve());
  const finalizeTurnRef = useRef<(role: SpeakerRole) => void>(() => {});

  // Save settings when modified
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('prateek_copilot_settings', JSON.stringify(newSettings));
    if (deepgramRef.current) {
      deepgramRef.current.setApiKey(newSettings.deepgramApiKey);
      deepgramRef.current.setKeywords(
        newSettings.androidKeywordsBoost !== false ? ANDROID_STT_KEYWORDS : []
      );
    }
    if (audioCaptureRef.current && newSettings.audioGainBoost) {
      audioCaptureRef.current.setGainBoost(newSettings.audioGainBoost);
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
      // If query is short or empty, reconstruct full question from recent consecutive transcripts
      if (!query || query.length < 15) {
        const fullQ = getFullQuestion(speakerRole, query || '', currentTranscripts);
        if (fullQ && fullQ.length >= (query?.length || 0)) {
          query = fullQ;
        }
      }
      if (!query) {
        const lastQuestion = [...currentTranscripts]
          .reverse()
          .find((t) => isQuestionOrPrompt(t.text));
        const lastTurn = [...currentTranscripts]
          .reverse()
          .find((t) => isSubstantiveTurn(t.text));
        query = lastQuestion?.text || lastTurn?.text || '';
      }

      if (!query || query.trim().length < 4) return;

      // 0. Check pre-saved Instant Knowledge Base (0ms latency, zero tokens, instant answer)
      const instantMatch = findInstantAnswer(query);
      if (instantMatch) {
        setSuggestion({
          id: Date.now().toString(),
          question: instantMatch.question,
          bullets: instantMatch.bullets,
          keywords: instantMatch.keywords,
          timestamp: Date.now(),
          isStreaming: false,
          role: speakerRole,
          isPinned: false,
        });
        setIsGenerating(false);
        isGeneratingRef.current = false;
        return;
      }

      const activeKey =
        currentSettings.aiProvider === 'gemini'
          ? currentSettings.geminiApiKey
          : currentSettings.openaiApiKey;

      if (!activeKey) {
        setSuggestion({
          id: Date.now().toString(),
          question: query,
          bullets: [`Please configure your ${currentSettings.aiProvider.toUpperCase()} API key in Settings to stream answers.`],
          keywords: [],
          timestamp: Date.now(),
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
              .map((l) => l.trim())
              .filter((l) => l.length > 0);

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
          },
          onComplete: (fullText) => {
            const lines = fullText
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0);

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
            setIsGenerating(false);
            isGeneratingRef.current = false;
          },
          onError: (err) => {
            console.error('Generation stream error:', err);
            setSuggestion((prev) => ({
              id: newSuggestionId,
              question: query!,
              bullets: [`Error: ${err.message}`],
              keywords: [],
              timestamp: Date.now(),
              isStreaming: false,
              role: speakerRole,
              isPinned: prev?.isPinned ?? false,
            }));
            setIsGenerating(false);
            isGeneratingRef.current = false;
          },
        },
        currentSettings.modelName
      );
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
      // When the candidate speaks or explains their answer, their microphone audio
      // must not overwrite the interviewer's answer unless they are asking a question.
      if (role === 'candidate') {
        if (triggerMode === 'interviewer') {
          return;
        }

        if (isGeneratingRef.current) {
          console.log('[Copilot] Candidate speech ignored: AI answer is currently generating.');
          return;
        }

        // If an answer was generated less than 6s ago, and candidate is explaining (not asking a question)
        const isRecentSuggestion = suggestionRef.current && Date.now() - suggestionRef.current.timestamp < 6000;
        if (isRecentSuggestion && !isExplicitQuestion(questionToTrigger)) {
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
        shouldTrigger = isQuestionOrPrompt(questionToTrigger);
      } else if (role === 'candidate' && (triggerMode === 'candidate' || triggerMode === 'both')) {
        shouldTrigger = isQuestionOrPrompt(questionToTrigger);
      }

      if (shouldTrigger) {
        console.log(`[Copilot] Auto-triggering real-time answer generation for ${role}: "${questionToTrigger}"`);
        triggerAnswerGenerationRef.current(questionToTrigger, role);
      }
    },
    []
  );

  finalizeTurnRef.current = finalizeTurn;

  /**
   * Start Audio Capture & Deepgram STT Pipeline
   */
  const startAudioPipeline = async () => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.deepgramApiKey) {
      alert('Please enter your Deepgram API Key in Settings to enable real-time speech-to-text.');
      return;
    }

    try {
      // 1. Initialize Deepgram Live Streamer
      const deepgram = new DeepgramLiveStreamer(
        currentSettings.deepgramApiKey,
        {
          onTranscript: (role, text, isFinal, speechFinal) => {
            const cleanText = normalizeTechnicalTranscript(text);
            if (!isFinal) {
              setInterimText({ role, text: cleanText });
            } else {
              setInterimText((prev) => (prev?.role === role ? null : prev));

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
          onUtteranceEnd: (role) => {
            if (silenceTimersRef.current[role]) {
              clearTimeout(silenceTimersRef.current[role]!);
            }
            silenceTimersRef.current[role] = setTimeout(() => {
              finalizeTurnRef.current(role);
            }, 200);
          },
          onError: (role, err) => {
            console.warn(`Deepgram error on ${role}:`, err);
          },
          onStatusChange: (role, status) => {
            console.log(`[Deepgram] Status for ${role}: ${status}`);
          },
        },
        currentSettings.androidKeywordsBoost !== false ? ANDROID_STT_KEYWORDS : []
      );

      deepgram.connect();
      deepgramRef.current = deepgram;

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
    setAudioLevels({
      micLevel: 0,
      speakerLevel: 0,
      isMicActive: false,
      isSpeakerActive: false,
    });
    setInterimText(null);
  };

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

    if (window.electronAPI?.captureScreen) {
      screenshotDataUrl = await window.electronAPI.captureScreen();
    } else if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'never' } as any,
          audio: false,
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play();
            resolve(true);
          };
        });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        screenshotDataUrl = canvas.toDataURL('image/png');
        stream.getTracks().forEach((track) => track.stop());
      } catch (e: any) {
        console.warn('Fallback displayMedia capture error:', e);
      }
    }

    if (!screenshotDataUrl) {
      alert('Screen capture requires restarting the desktop app. Please press Ctrl+C in your terminal and run "npm run dev" again.');
      return;
    }

    try {
      setIsGenerating(true);
      const newSuggestionId = Date.now().toString();
      setSuggestion({
        id: newSuggestionId,
        question: 'Scanning screen & meeting chatbox for question...',
        bullets: ['Inspecting screen image with Gemini Vision...'],
        keywords: [],
        timestamp: Date.now(),
        isStreaming: true,
      });

      await llmRef.current.streamVisionAnswer(
        screenshotDataUrl,
        settings.geminiApiKey,
        settings.systemPrompt,
        {
          onToken: (_token, accumulated) => {
            const lines = accumulated
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0);

            setSuggestion({
              id: newSuggestionId,
              question: 'Detected Question / Problem from Screen',
              bullets: lines.length > 0 ? lines : [accumulated],
              keywords: [],
              timestamp: Date.now(),
              isStreaming: true,
            });
          },
          onComplete: (fullText) => {
            const lines = fullText
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0);

            setSuggestion({
              id: newSuggestionId,
              question: 'Detected Question / Problem from Screen',
              bullets: lines.length > 0 ? lines : [fullText],
              keywords: [],
              timestamp: Date.now(),
              isStreaming: false,
            });
            setIsGenerating(false);
          },
          onError: (err) => {
            console.error('Vision error:', err);
            setSuggestion((prev) =>
              prev
                ? {
                    ...prev,
                    bullets: [`Screen Vision Error: ${err.message}`],
                    isStreaming: false,
                  }
                : null
            );
            setIsGenerating(false);
          },
        }
      );
    } catch (err: any) {
      console.error('Screen capture error:', err);
      alert(`Screen capture failed: ${err.message}`);
      setIsGenerating(false);
    }
  };

  // Keyboard shortcut: Ctrl + Enter to manually generate answer, Alt + S / Ctrl + Shift + S to scan screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerAnswerGeneration();
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
    <div className="h-screen w-screen p-2 box-border bg-transparent">
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
      />
    </div>
  );
};
