import React, { useState, useEffect } from 'react';
import {
  GripHorizontal,
  Settings,
  Shield,
  EyeOff,
  Minimize2,
  MousePointer,
  Sparkles,
  Play,
  Square,
  Maximize2,
  Camera,
  X,
  FileText,
  Languages,
  ChevronsUpDown,
  Smartphone,
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { TranscriptFeed } from './TranscriptFeed';
import { AnswerPanel } from './AnswerPanel';
import { SettingsModal } from './SettingsModal';
import { QALogModal } from './QALogModal';
import { MobileRemoteModal } from './MobileRemoteModal';
import { qaLogger } from '../services/logger';
import {
  TranscriptEntry,
  AISuggestion,
  AppSettings,
  AudioLevels,
  SpeakerRole,
} from '../types';

interface HUDOverlayProps {
  transcripts: TranscriptEntry[];
  interimText: { role: SpeakerRole; text: string } | null;
  suggestion: AISuggestion | null;
  isGenerating: boolean;
  audioLevels: AudioLevels;
  isAudioCapturing: boolean;
  isMicMuted: boolean;
  isSpeakerMuted: boolean;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onToggleMicMute: () => void;
  onToggleSpeakerMute: () => void;
  onClearTranscripts: () => void;
  onGenerateManualAnswer: () => void;
  onCaptureScreen: () => void;
  onStopGenerating: () => void;
  onTogglePinAnswer?: () => void;
  onStartAudio: () => void;
  onStopAudio: () => void;
  sttStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  onSimulateQuestion?: () => void;
  enterModeEnabled?: boolean;
  onToggleEnterMode?: () => void;
  onToggleMiniMode?: () => void;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  transcripts,
  interimText,
  suggestion,
  isGenerating,
  audioLevels,
  isAudioCapturing,
  isMicMuted,
  isSpeakerMuted,
  settings,
  onUpdateSettings,
  onToggleMicMute,
  onToggleSpeakerMute,
  onClearTranscripts,
  onGenerateManualAnswer,
  onCaptureScreen,
  onStopGenerating,
  onTogglePinAnswer,
  onStartAudio,
  onStopAudio,
  sttStatus = 'connected',
  onSimulateQuestion,
  enterModeEnabled = false,
  onToggleEnterMode,
  onToggleMiniMode,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [qaCount, setQaCount] = useState(0);
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Dynamic Auto-Expand Window State (automatically expands window downwards as answer lengthens)
  const autoExpand = settings.autoExpandWindow ?? true;
  const BASE_WINDOW_HEIGHT = 520;
  const MAX_WINDOW_HEIGHT = 860;
  const resizeTimerRef = React.useRef<any>(null);
  const lastTargetHeightRef = React.useRef<number>(BASE_WINDOW_HEIGHT);

  const handleContentHeightChange = React.useCallback(
    (answerContentHeight: number) => {
      if (!autoExpand) return;
      if (!window.electronAPI?.setWindowHeight) return;

      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }

      resizeTimerRef.current = setTimeout(() => {
        if (!suggestion && !isGenerating) {
          if (lastTargetHeightRef.current !== BASE_WINDOW_HEIGHT) {
            lastTargetHeightRef.current = BASE_WINDOW_HEIGHT;
            console.log('[AutoExpand] Resetting window height to base:', BASE_WINDOW_HEIGHT);
            window.electronAPI?.setWindowHeight?.(BASE_WINDOW_HEIGHT);
          }
          return;
        }

        // Real UI chrome overhead:
        // App padding (16px) + Titlebar (42px) + Bottom toolbar (42px) + Answer header (34px) + inner padding & borders (16px)
        const uiChromeOverhead = 150;

        let transcriptHeight = 0;
        if (!isCompactMode) {
          transcriptHeight = transcripts.length === 0 ? 36 : 100;
        }

        const neededTotal = uiChromeOverhead + transcriptHeight + answerContentHeight;
        const targetHeight = Math.max(BASE_WINDOW_HEIGHT, Math.min(MAX_WINDOW_HEIGHT, neededTotal));

        if (Math.abs(targetHeight - lastTargetHeightRef.current) >= 6) {
          lastTargetHeightRef.current = targetHeight;
          console.log(`[AutoExpand] Resizing window height: ${targetHeight}px (answer: ${answerContentHeight}px, overhead: ${uiChromeOverhead + transcriptHeight}px)`);
          window.electronAPI?.setWindowHeight?.(targetHeight);
        }
      }, 40);
    },
    [autoExpand, isCompactMode, suggestion, isGenerating, transcripts.length]
  );

  // When suggestion is cleared and generation stops, gracefully snap window back to compact base
  useEffect(() => {
    if (!suggestion && !isGenerating && autoExpand && window.electronAPI?.setWindowHeight) {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      if (lastTargetHeightRef.current !== BASE_WINDOW_HEIGHT) {
        lastTargetHeightRef.current = BASE_WINDOW_HEIGHT;
        console.log('[AutoExpand] Snapping back to base window height:', BASE_WINDOW_HEIGHT);
        window.electronAPI?.setWindowHeight?.(BASE_WINDOW_HEIGHT);
      }
    }
  }, [suggestion, isGenerating, autoExpand]);

  // Subscribe to Q&A logger history count
  useEffect(() => {
    const unsub = qaLogger.subscribe((history) => {
      setQaCount(history.length);
    });
    return unsub;
  }, []);

  // Listen for global shortcut click-through changes from main process
  useEffect(() => {
    if (window.electronAPI?.onClickThroughChanged) {
      const cleanup = window.electronAPI.onClickThroughChanged((enabled) => {
        setIsClickThrough(enabled);
      });
      return cleanup;
    }
  }, []);

  // Handle dynamic mouse event pass-through when hovering over interactive elements vs glass background
  const handleMouseEnterControls = () => {
    if (!isClickThrough && window.electronAPI?.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleToggleClickThrough = async () => {
    if (window.electronAPI?.toggleClickThrough) {
      const active = await window.electronAPI.toggleClickThrough();
      setIsClickThrough(active);
    }
  };

  const handleMinimize = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (onToggleMiniMode) {
      onToggleMiniMode();
    } else if (window.electronAPI?.setMiniMode) {
      window.electronAPI.setMiniMode(true);
    } else if (window.electronAPI?.minimizeToBackground) {
      window.electronAPI.minimizeToBackground();
    } else if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  return (
    <div
      style={{ opacity: settings.opacity }}
      onMouseEnter={handleMouseEnterControls}
      className="h-full w-full flex flex-col rounded-xl overflow-hidden glass-panel border border-white/10 transition-opacity duration-150"
    >
      {/* ================= TOP TITLE BAR (DRAGGABLE) ================= */}
      <div className="titlebar-drag flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-white/10 select-none">
        {/* Left Side: Drag Handle & Stealth Indicator */}
        <div className="flex items-center gap-2">
          <div className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing">
            <GripHorizontal className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-[10px] font-medium text-blue-300">
            <Shield className="w-3 h-3 text-blue-400" />
            <span className="tracking-wide font-mono">STEALTH HUD</span>
          </div>

          {/* STT Status Indicator */}
          {isAudioCapturing && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              sttStatus === 'connected'
                ? 'bg-emerald-950/70 border border-emerald-500/30 text-emerald-300'
                : sttStatus === 'connecting'
                ? 'bg-amber-950/70 border border-amber-500/30 text-amber-300 animate-pulse'
                : 'bg-rose-950/70 border border-rose-500/30 text-rose-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                sttStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : sttStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
              }`} />
              <span className="font-mono uppercase">{settings.sttProvider || 'assemblyai'}</span>
            </div>
          )}

          {/* Instant 1-Click Language Mode Selector (EN / HI / Hinglish) */}
          <div className="no-drag flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10 text-[10px] font-medium shadow-inner">
            <span className="flex items-center gap-1 pl-1.5 pr-1 text-slate-400">
              <Languages className="w-3 h-3 text-blue-400" />
            </span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
              title="English Mode: Transcribe pure English. Disables Hinglish word conversion."
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                (settings.language || 'en') === 'en'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, language: 'hi' })}
              title="Hindi Mode (हिंदी): Transcribe Hindi speech accurately."
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                settings.language === 'hi'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              HI
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, language: 'hinglish' })}
              title="Hinglish Mode: Mixed Hindi + English bilingual speech."
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                settings.language === 'hinglish'
                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Hinglish
            </button>
          </div>

          {/* Android Senior Role Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-[10px] font-medium text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Android · Kotlin (5 YOE)</span>
          </div>

          {/* Click-Through Status Indicator */}
          {isClickThrough && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-[10px] font-medium text-amber-300 animate-pulse">
              <MousePointer className="w-2.5 h-2.5" />
              <span>PASS-THROUGH (Ctrl+Shift+X)</span>
            </div>
          )}

          {/* Enter Mode Indicator */}
          {enterModeEnabled && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-[10px] font-medium text-blue-300 animate-pulse">
              <span>↵</span>
              <span>Press Enter to generate</span>
            </div>
          )}
        </div>

        {/* Center: Audio VU Monitor */}
        <AudioVisualizer
          levels={audioLevels}
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          onToggleMicMute={onToggleMicMute}
          onToggleSpeakerMute={onToggleSpeakerMute}
        />

        {/* Right Side: Window & Utility Controls (NO-DRAG) */}
        <div className="no-drag flex items-center gap-1 relative z-50">
          {/* Quick Click-Through Toggle */}
          <button
            type="button"
            onClick={handleToggleClickThrough}
            title={isClickThrough ? "Disable Click-Through (Ctrl+Shift+X)" : "Enable Click-Through (clicks pass beneath window)"}
            className={`no-drag p-1.5 rounded transition-colors cursor-pointer ${
              isClickThrough ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          {/* Compact View Toggle */}
          <button
            type="button"
            onClick={() => setIsCompactMode(!isCompactMode)}
            title={isCompactMode ? "Standard View" : "Compact Answers-Only View"}
            className="no-drag p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
          >
            {isCompactMode ? <Maximize2 className="w-3.5 h-3.5 pointer-events-none" /> : <Minimize2 className="w-3.5 h-3.5 pointer-events-none" />}
          </button>

          {/* Dynamic Auto-Expand Window Height Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !autoExpand;
              onUpdateSettings({ ...settings, autoExpandWindow: next });
              if (!next) {
                lastTargetHeightRef.current = BASE_WINDOW_HEIGHT;
                window.electronAPI?.setWindowHeight?.(BASE_WINDOW_HEIGHT);
              }
            }}
            title={
              autoExpand
                ? "Dynamic Auto-Expand is ACTIVE: Window automatically expands downwards for longer answers. Click to lock fixed height."
                : "Dynamic Auto-Expand is OFF: Window height is fixed. Click to enable automatic expansion."
            }
            className={`no-drag p-1.5 rounded transition-colors cursor-pointer ${
              autoExpand ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ChevronsUpDown className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          {/* Q&A Session Logs */}
          <button
            type="button"
            onClick={() => setIsLogsOpen(true)}
            title="View Transcript & Q&A Generation Logs"
            className="no-drag flex items-center gap-1 p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer text-xs"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400 pointer-events-none" />
            {qaCount > 0 && (
              <span className="px-1 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-mono leading-none">
                {qaCount}
              </span>
            )}
          </button>

          {/* Mobile Remote Controller */}
          <button
            type="button"
            onClick={() => setIsMobileModalOpen(true)}
            title="Mobile Remote Controller (Control HUD from your phone)"
            className="no-drag p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Copilot Settings & API Keys"
            className="no-drag p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          {/* Minimize / Collapse to Mini Floating Icon */}
          <button
            type="button"
            onClick={handleMinimize}
            title="Collapse to small floating icon (or Ctrl+Shift+H to hide completely)"
            className="no-drag p-1.5 text-slate-400 hover:text-blue-300 hover:bg-white/5 rounded transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          {/* Close Window */}
          <button
            type="button"
            onClick={handleClose}
            title="Close Copilot"
            className="no-drag p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 pointer-events-none" />
          </button>
        </div>
      </div>

      {/* ================= MAIN CONTENT SPLIT (DYNAMICALLY ADAPTIVE) ================= */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Half: Real-time Transcript Feed (Contracts when answer is active to prioritize answer space) */}
        {!isCompactMode && (
          <div
            className={`transition-all duration-200 overflow-hidden ${
              suggestion || isGenerating
                ? transcripts.length === 0
                  ? 'h-[36px] flex-none'
                  : 'max-h-[120px] flex-[2.5] min-h-[64px]'
                : 'flex-[4] min-h-[110px]'
            }`}
          >
            <TranscriptFeed
              transcripts={transcripts}
              interimText={interimText}
              onClear={onClearTranscripts}
              fontSize={settings.fontSize}
              isAudioCapturing={isAudioCapturing}
              onStartAudio={onStartAudio}
              audioLevels={audioLevels}
              sttStatus={sttStatus}
              sttProvider={settings.sttProvider || 'assemblyai'}
              onSimulateQuestion={onSimulateQuestion}
            />
          </div>
        )}

        {/* Bottom Half: Real-time AI Suggested Answers (Dynamic Auto-Expanding) */}
        <div className="flex-1 min-h-[160px] overflow-hidden flex flex-col">
          <AnswerPanel
            suggestion={suggestion}
            isGenerating={isGenerating}
            onRegenerate={onGenerateManualAnswer}
            onStop={onStopGenerating}
            onTogglePin={onTogglePinAnswer}
            fontSize={settings.fontSize}
            onContentHeightChange={handleContentHeightChange}
          />
        </div>
      </div>

      {/* ================= BOTTOM ACTION TOOLBAR (NO-DRAG) ================= */}
      <div className="no-drag flex items-center justify-between px-3 py-2 bg-slate-950/90 border-t border-white/10 text-xs">
        {/* Left: Audio Capture Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={isAudioCapturing ? onStopAudio : onStartAudio}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all text-xs ${
              isAudioCapturing
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/80'
                : 'bg-slate-800 text-slate-300 border border-white/5 hover:bg-slate-700'
            }`}
          >
            {isAudioCapturing ? (
              <>
                <Square className="w-3 h-3 fill-current text-emerald-400" />
                <span>Capturing Audio</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current text-blue-400" />
                <span>Start Audio Capture</span>
              </>
            )}
          </button>
        </div>

        {/* Center: Screen Vision Scan */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCaptureScreen}
            disabled={isGenerating}
            title="Scan screen or Meet chat for question (Google Meet chat, CoderPad, LeetCode) - Shortcut: Alt+S"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-950/80 hover:bg-amber-900/90 border border-amber-500/40 text-amber-300 font-medium transition-all text-xs disabled:opacity-40"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Scan Screen</span>
            <span className="text-[10px] text-amber-400/70 font-mono bg-amber-900/40 px-1 py-0.2 rounded border border-amber-500/20">Alt+S</span>
          </button>
        </div>

        {/* Right: Mode Toggle + Generate Button */}
        <div className="flex items-center gap-1.5">
          {/* Auto / Enter Mode Toggle */}
          <div className="flex items-center rounded-md border border-white/10 overflow-hidden text-[11px] font-medium">
            <button
              onClick={() => !enterModeEnabled && onToggleEnterMode?.()}
              title="Auto Mode: Answer generates automatically when a question is detected (silence-based)"
              className={`px-2.5 py-1 transition-colors ${
                !enterModeEnabled
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
              }`}
            >
              ⚡ Auto
            </button>
            <button
              onClick={() => enterModeEnabled && onToggleEnterMode?.()}
              title="Enter Mode: App listens to full question, then press Enter to generate answer"
              className={`px-2.5 py-1 transition-colors ${
                enterModeEnabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
              }`}
            >
              ↵ Enter
            </button>
          </div>

          {/* Generate / Manual Trigger Button */}
          <button
            onClick={onGenerateManualAnswer}
            disabled={isGenerating}
            title={enterModeEnabled ? "Generate answer (or press Enter key)" : "Manually generate answer from last transcript"}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium shadow-sm transition-all text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{enterModeEnabled ? 'Generate (Enter)' : 'Generate'}</span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={onUpdateSettings}
      />

      {/* Transcript & Q&A Session Logs Modal */}
      <QALogModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />

      {/* Mobile Remote Controller Modal */}
      <MobileRemoteModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
      />
    </div>
  );
};
