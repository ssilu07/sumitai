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
  X
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { TranscriptFeed } from './TranscriptFeed';
import { AnswerPanel } from './AnswerPanel';
import { SettingsModal } from './SettingsModal';
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
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);

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

  const handleMinimize = () => {
    if (window.electronAPI?.minimizeToBackground) {
      window.electronAPI.minimizeToBackground();
    } else if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
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

          {/* Android Senior Role Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-[10px] font-medium text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Android · Kotlin · Compose (5 YOE)</span>
          </div>

          {/* Click-Through Status Indicator */}
          {isClickThrough && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-[10px] font-medium text-amber-300 animate-pulse">
              <MousePointer className="w-2.5 h-2.5" />
              <span>PASS-THROUGH (Ctrl+Shift+X)</span>
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
        <div className="no-drag flex items-center gap-1">
          {/* Quick Click-Through Toggle */}
          <button
            onClick={handleToggleClickThrough}
            title={isClickThrough ? "Disable Click-Through (Ctrl+Shift+X)" : "Enable Click-Through (clicks pass beneath window)"}
            className={`p-1.5 rounded transition-colors ${
              isClickThrough ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          {/* Compact View Toggle */}
          <button
            onClick={() => setIsCompactMode(!isCompactMode)}
            title={isCompactMode ? "Standard View" : "Compact Answers-Only View"}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            {isCompactMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Copilot Settings & API Keys"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Minimize / Hide to Background */}
          <button
            onClick={handleMinimize}
            title="Minimize to background (Ctrl+Shift+H to restore)"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>

          {/* Close Window */}
          <button
            onClick={handleClose}
            title="Close Copilot"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ================= MAIN CONTENT SPLIT ================= */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Half: Real-time Transcript Feed (Collapsible in compact mode) */}
        {!isCompactMode && (
          <div className="flex-[3] min-h-[100px] overflow-hidden">
            <TranscriptFeed
              transcripts={transcripts}
              interimText={interimText}
              onClear={onClearTranscripts}
              fontSize={settings.fontSize}
            />
          </div>
        )}

        {/* Bottom Half: Real-time AI Suggested Answers */}
        <div className="flex-[7] min-h-[160px] overflow-hidden">
          <AnswerPanel
            suggestion={suggestion}
            isGenerating={isGenerating}
            onRegenerate={onGenerateManualAnswer}
            onStop={onStopGenerating}
            onTogglePin={onTogglePinAnswer}
            fontSize={settings.fontSize}
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

        {/* Center/Left: Screen Vision Scan */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCaptureScreen}
            disabled={isGenerating}
            title="Scan screen or Meet chat for question (Google Meet chat, CoderPad, LeetCode)"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-950/80 hover:bg-amber-900/90 border border-amber-500/40 text-amber-300 font-medium transition-all text-xs disabled:opacity-40"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Scan Screen / Chat</span>
          </button>
        </div>

        {/* Right: Manual Audio Trigger Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerateManualAnswer}
            disabled={isGenerating || transcripts.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium shadow-sm transition-all text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Answer</span>
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
    </div>
  );
};
