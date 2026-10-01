import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Key,
  Mic,
  Sliders,
  Cpu,
  Save,
  UserCheck,
  RotateCcw,
  Briefcase,
  Radio,
  Languages,
  Zap,
} from 'lucide-react';
import { AppSettings, AudioDevice } from '../types';
import { getAvailableAudioDevices } from '../services/audioCapture';
import {
  CANDIDATE_PROFILE,
  ANDROID_SYSTEM_PROMPT,
  ANDROID_STT_KEYWORDS,
} from '../services/androidKnowledge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [desktopSources, setDesktopSources] = useState<Array<{ id: string; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'keys' | 'audio' | 'hud'>('profile');

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch Audio Devices
    getAvailableAudioDevices().then((devices) => {
      setAudioDevices(
        devices.map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
          kind: d.kind,
        }))
      );
    });

    // Fetch Desktop Capturer Sources
    if (window.electronAPI?.getDesktopSources) {
      window.electronAPI.getDesktopSources().then((sources) => {
        setDesktopSources(sources);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-drag">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-100">Copilot Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/30 px-3 pt-2 gap-1 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-slate-800 text-emerald-300 border-b-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Profile & Resume</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Model & Prompt</span>
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'keys'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'audio'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio Sources</span>
          </button>
          <button
            onClick={() => setActiveTab('hud')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'hud'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Stealth HUD</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Tab 0: Profile & Resume (Android Developer) */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Candidate Info Banner */}
              <div className="p-3.5 rounded-lg bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">{CANDIDATE_PROFILE.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium text-[10px] border border-emerald-500/30">
                        {CANDIDATE_PROFILE.totalExperience} Experience
                      </span>
                    </div>
                    <p className="text-xs text-emerald-400 font-medium mt-0.5">{CANDIDATE_PROFILE.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        systemPrompt: ANDROID_SYSTEM_PROMPT,
                        androidKeywordsBoost: true,
                        candidateProfileName: 'Sumit Singh (Senior Android Developer - 5 YOE)',
                      });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors shadow-sm"
                    title="Re-apply Senior Android Developer prompt & keyword boosts"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Preset</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed border-t border-white/5 pt-2">
                  {CANDIDATE_PROFILE.summary}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 text-[10px]">
                    Kotlin (Expert)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 text-[10px]">
                    Jetpack Compose
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 text-[10px]">
                    MVVM & Clean Architecture
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 text-[10px]">
                    Coroutines & StateFlow
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 text-[10px]">
                    Koin DI
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 text-[10px]">
                    Room DB & Retrofit
                  </span>
                </div>
              </div>

              {/* Deepgram STT Technical Vocabulary Boosting */}
              <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="font-semibold text-slate-200 text-xs">Deepgram STT Listener Tuning</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[10px] text-slate-400">Boost Technical Terms</span>
                    <input
                      type="checkbox"
                      checked={formData.androidKeywordsBoost !== false}
                      onChange={(e) => setFormData({ ...formData, androidKeywordsBoost: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-800 border-slate-600"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  The real-time speech listener is trained with 3x acoustic boosting on Android, Kotlin, and Jetpack Compose terms so interviewers' questions are transcribed with high precision:
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-black/40 rounded border border-white/5">
                  {ANDROID_STT_KEYWORDS.map((kw, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono"
                    >
                      {kw.split(':')[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Predefined Projects in System Prompt */}
              {CANDIDATE_PROFILE.projects.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span>Resume Projects Configured in AI</span>
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {CANDIDATE_PROFILE.projects.map((proj, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-black/20 border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-100 text-xs">{proj.name}</span>
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {proj.tech.split('·')[0].trim()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{proj.description}</p>
                        <div className="space-y-0.5 pt-1">
                          {proj.bulletPoints.map((bp, bIdx) => (
                            <div key={bIdx} className="text-[10px] text-slate-300 leading-snug">
                              • {bp}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 1: API Keys & STT Engine */}
          {activeTab === 'keys' && (
            <div className="space-y-3.5">
              {/* STT Engine Provider Selection */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
                <label className="block text-slate-200 font-semibold text-xs">
                  Speech-to-Text (STT) Engine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, sttProvider: 'assemblyai' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      (formData.sttProvider || 'assemblyai') === 'assemblyai'
                        ? 'bg-purple-950/70 border-purple-500 text-purple-100 ring-1 ring-purple-500'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>AssemblyAI v3</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">Recommended</span>
                    </div>
                    <div className="text-[10px] text-purple-200/90 mt-1 leading-tight">
                      ⚡ Universal-3.5 Pro Live WebSocket (Zero Hallucination)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, sttProvider: 'deepgram' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      formData.sttProvider === 'deepgram'
                        ? 'bg-blue-950/70 border-blue-500 text-blue-100 ring-1 ring-blue-500'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>Deepgram Nova-2</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">Alternative</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Fast Real-time streaming WebSocket
                    </div>
                  </button>
                </div>
              </div>

              {/* STT API Key Field */}
              {(formData.sttProvider || 'assemblyai') === 'assemblyai' ? (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    AssemblyAI API Key <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.assemblyaiApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, assemblyaiApiKey: e.target.value })}
                    placeholder="Enter your AssemblyAI API Key"
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Free signup with $50 credits at assemblyai.com (Universal-3.5 Pro live streaming).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Deepgram API Key <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.deepgramApiKey}
                    onChange={(e) => setFormData({ ...formData, deepgramApiKey: e.target.value })}
                    placeholder="Enter your Deepgram API Key (nova-2 streaming)"
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Required for Deepgram Nova-2 real-time speech recognition. Free signup at deepgram.com
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Google Gemini API Key <span className="text-amber-400">*</span>
                </label>
                <input
                  type="password"
                  value={formData.geminiApiKey}
                  onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                  placeholder="Enter your Google Gemini API Key"
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Powers Gemini 1.5 Flash ultra-low latency answer streaming.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Groq API Key <span className="text-emerald-400">* (Ultra-Fast 500+ tok/s)</span>
                </label>
                <input
                  type="password"
                  value={formData.groqApiKey || ''}
                  onChange={(e) => setFormData({ ...formData, groqApiKey: e.target.value })}
                  placeholder="gsk_..."
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Powers ultra-fast sub-second answer streaming with Llama/Compound models.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  OpenAI API Key (Optional Fallback)
                </label>
                <input
                  type="password"
                  value={formData.openaiApiKey}
                  onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Audio Sources */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Candidate Microphone Input
                </label>
                <select
                  value={formData.selectedMicId}
                  onChange={(e) => setFormData({ ...formData, selectedMicId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="">Default Microphone</option>
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Captures your voice responses (labeled [You] in the transcript).
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Interviewer Audio Loopback Source
                </label>
                <select
                  value={formData.selectedLoopbackId}
                  onChange={(e) => setFormData({ ...formData, selectedLoopbackId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="">Auto System Loopback (Primary Screen/Speaker)</option>
                  {desktopSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      Screen/Desktop: {s.name}
                    </option>
                  ))}
                  {audioDevices.map((d) => (
                    <option key={`dev-${d.deviceId}`} value={d.deviceId}>
                      Audio Input/Virtual Cable: {d.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  On Windows: Captures system speaker audio automatically. On macOS: select BlackHole/VB-Cable device.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-300 font-medium">
                    Low Voice Boost & Speech Sensitivity
                  </label>
                  <span className="font-mono text-blue-400 font-medium">
                    {(formData.audioGainBoost ?? 2.0).toFixed(1)}x {((formData.audioGainBoost ?? 2.0) >= 2.0) ? '(High Boost)' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.2"
                  value={formData.audioGainBoost ?? 2.0}
                  onChange={(e) => setFormData({ ...formData, audioGainBoost: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Automatically amplifies quiet, low, or distant interviewer speech with dynamic range compression so Deepgram captures faint voices clearly without distortion.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: AI Model & Prompt */}
          {activeTab === 'ai' && (
            <div className="space-y-3.5">
              {/* Language Selection */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Languages className="w-4 h-4 text-blue-400" />
                    <label className="text-slate-200 font-semibold text-xs">
                      Interview Language / भाषा चयन
                    </label>
                  </div>
                  <span className="text-[10px] text-blue-300 font-mono uppercase bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/20">
                    {(formData.language || 'en') === 'en' ? 'English (EN)' : formData.language === 'hi' ? 'Hindi (HI)' : 'Hinglish (Auto)'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, language: 'en' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      (formData.language || 'en') === 'en'
                        ? 'bg-blue-950/70 border-blue-500 text-blue-100 ring-1 ring-blue-500'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>English</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">EN</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Pure English. No Hinglish conversions. Understands English technical words.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, language: 'hi' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      formData.language === 'hi'
                        ? 'bg-amber-950/70 border-amber-500 text-amber-100 ring-1 ring-amber-500'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>Hindi (हिंदी)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">HI</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Recognizes Hindi speech accurately. LLM creates English interview answers.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, language: 'hinglish' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      formData.language === 'hinglish'
                        ? 'bg-purple-950/70 border-purple-500 text-purple-100 ring-1 ring-purple-500'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>Hinglish</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">Auto</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Bilingual code-switching (mix of Hindi & English speech).
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Active AI Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, aiProvider: 'groq', modelName: 'qwen/qwen3.8-27b' })}
                    className={`px-3 py-2 rounded border text-left flex flex-col gap-0.5 transition-all ${
                      formData.aiProvider === 'groq'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500'
                        : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <span className="font-semibold text-xs text-emerald-300 flex items-center justify-between">
                      <span>Groq LPU</span>
                      <span className="text-[8px] bg-emerald-500/20 px-1 py-0.5 rounded text-emerald-300">⚡ 160ms</span>
                    </span>
                    <span className="text-[9px] text-slate-400">qwen-27b (500 tok/s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, aiProvider: 'gemini', modelName: 'gemini-flash-latest' })}
                    className={`px-3 py-2 rounded border text-left flex flex-col gap-0.5 transition-all ${
                      formData.aiProvider === 'gemini'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-200 ring-1 ring-blue-500'
                        : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <span className="font-semibold text-xs text-blue-300 flex items-center justify-between">
                      <span>Gemini</span>
                      <span className="text-[8px] bg-blue-500/20 px-1 py-0.5 rounded text-blue-300">Flash Lite</span>
                    </span>
                    <span className="text-[9px] text-slate-400">gemini-3.5-flash-lite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, aiProvider: 'openai', modelName: 'gpt-4o-mini' })}
                    className={`px-3 py-2 rounded border text-left flex flex-col gap-0.5 transition-all ${
                      formData.aiProvider === 'openai'
                        ? 'bg-purple-950/60 border-purple-500 text-purple-200 ring-1 ring-purple-500'
                        : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <span className="font-semibold text-xs">OpenAI</span>
                    <span className="text-[9px] text-slate-400">gpt-4o-mini</span>
                  </button>
                </div>
              </div>

              {/* Model Selection Dropdown */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Selected Model ({formData.aiProvider.toUpperCase()})
                </label>
                <select
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-mono"
                >
                  {formData.aiProvider === 'groq' && (
                    <>
                      <option value="qwen/qwen3.8-27b">⚡ qwen/qwen3.8-27b (160ms TTFT - Super Fast & Accurate - Recommended)</option>
                      <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Deep Reasoning - High Quality)</option>
                      <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (500ms TTFT)</option>
                    </>
                  )}
                  {formData.aiProvider === 'gemini' && (
                    <>
                      <option value="gemini-flash-latest">⚡ gemini-flash-latest (Recommended - Fast & Stable)</option>
                      <option value="gemini-3.6-flash">gemini-3.6-flash (Latest Model)</option>
                      <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Fast Flash Lite)</option>
                      <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (Stable Flash Lite)</option>
                    </>
                  )}
                  {formData.aiProvider === 'openai' && (
                    <>
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast)</option>
                      <option value="gpt-4o">gpt-4o (High Intelligence)</option>
                    </>
                  )}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {formData.aiProvider === 'groq' && '⚡ Groq LPU delivers answers in ~500ms (5x to 8x faster than traditional cloud APIs).'}
                  {formData.aiProvider === 'gemini' && 'Google Gemini Flash Lite streams answers with deep knowledge and minimal latency.'}
                  {formData.aiProvider === 'openai' && 'OpenAI Chat Completions streaming.'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">
                    System Prompt (Technical Co-Pilot Instructions)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, systemPrompt: ANDROID_SYSTEM_PROMPT })}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                    title="Re-apply Senior Android Developer prompt"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Android (5 YOE) Prompt</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-[11px] leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                {/* Instant QA Bank Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/10">
                  <div className="pr-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-xs text-slate-200">Instant QA Bank (Offline 0ms Cache)</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          formData.enableInstantQABank !== false
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-white/10'
                        }`}
                      >
                        {formData.enableInstantQABank !== false ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Instant 0ms answers for standard textbook questions. Turn <strong>OFF</strong> if you want Live AI (Groq / Gemini) to dynamically answer all questions with live context & custom code.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enableInstantQABank !== false}
                    onChange={(e) => setFormData({ ...formData, enableInstantQABank: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 bg-slate-800 border-slate-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-black/20 border border-white/5">
                  <div>
                    <span className="font-medium text-slate-200">Auto-Generate on Speech Pause</span>
                    <p className="text-[10px] text-slate-500">
                      Automatically triggers LLM streaming as soon as a question or speech pause is detected.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoGenerateAnswer}
                    onChange={(e) => setFormData({ ...formData, autoGenerateAnswer: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 bg-slate-800 border-slate-600"
                  />
                </div>

                {formData.autoGenerateAnswer && (
                  <div className="p-2 rounded bg-black/20 border border-white/5 space-y-1.5">
                    <label className="block text-slate-300 font-medium text-[11px]">
                      Auto-Generate Source
                    </label>
                    <select
                      value={formData.autoTriggerSpeaker || 'both'}
                      onChange={(e) => setFormData({ ...formData, autoTriggerSpeaker: e.target.value as any })}
                      className="w-full bg-slate-950 border border-white/10 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                    >
                      <option value="both">Smart Dual Mode (Recommended - Interviewer Loopback + Mic Question Trigger)</option>
                      <option value="interviewer">Interviewer Loopback Only (Candidate mic never triggers)</option>
                      <option value="candidate">Candidate Microphone Only (Solo Practice)</option>
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Smart Dual Mode automatically detects technical questions from both interviewer system audio and your microphone, while protecting active answers from ever being overwritten while you are speaking.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Stealth HUD Settings */}
          {activeTab === 'hud' && (
            <div className="space-y-4">
              {/* Screen Protection Banner */}
              <div
                className={`p-3 rounded-lg border ${
                  formData.contentProtection
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {formData.contentProtection ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {formData.contentProtection
                      ? 'Screen Protection Active (WDA_EXCLUDEFROMCAPTURE)'
                      : 'Screen Protection Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {formData.contentProtection
                    ? 'This overlay window is completely INVISIBLE to Zoom, Google Meet, Microsoft Teams screen shares, OBS, and screenshot utilities.'
                    : 'The window is currently visible to screen recordings.'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = !formData.contentProtection;
                      setFormData({ ...formData, contentProtection: updated });
                      window.electronAPI?.setContentProtection(updated);
                    }}
                    className="px-2.5 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    {formData.contentProtection ? 'Disable (Debug Mode)' : 'Enable Stealth Protection'}
                  </button>
                </div>
              </div>

              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-medium">HUD Window Opacity</label>
                  <span className="font-mono text-blue-400">{Math.round(formData.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="1.0"
                  step="0.05"
                  value={formData.opacity}
                  onChange={(e) => setFormData({ ...formData, opacity: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Font Size Picker */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">HUD Font Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sm', 'base', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormData({ ...formData, fontSize: size })}
                      className={`py-1.5 text-center rounded border capitalize font-medium transition-all ${
                        formData.fontSize === size
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      {size === 'sm' ? 'Compact (11px)' : size === 'base' ? 'Standard (12px)' : 'Large (13px)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Auto-Expand Window Height */}
              <div className="p-2.5 rounded bg-black/30 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Dynamic Auto-Expand Window</span>
                    <p className="text-[10px] text-slate-500">
                      Automatically expands the window downwards when answers are long so all bullet points fit on screen.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoExpandWindow ?? true}
                    onChange={(e) => setFormData({ ...formData, autoExpandWindow: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 bg-slate-800 border-slate-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Taskbar & Tray Stealth Options */}
              <div className="p-2.5 rounded bg-black/30 border border-white/5 space-y-2.5">
                <span className="font-semibold text-slate-300">OS Taskbar & Tray Stealth</span>
                
                {/* Hide from Taskbar */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Hide from Windows Taskbar</span>
                    <p className="text-[10px] text-slate-500">
                      Overlay does not appear in the Windows taskbar or Alt+Tab switcher.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.hideFromTaskbar ?? true}
                    onChange={(e) => setFormData({ ...formData, hideFromTaskbar: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 bg-slate-800 border-slate-600"
                  />
                </div>

                {/* Show System Tray Icon */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <div>
                    <span className="font-medium text-slate-200">Show System Tray Icon</span>
                    <p className="text-[10px] text-slate-500">
                      Show quick-access icon in notification area (near clock). Disable for 100% invisible operation.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.showSystemTray ?? true}
                    onChange={(e) => setFormData({ ...formData, showSystemTray: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 bg-slate-800 border-slate-600"
                  />
                </div>
              </div>

              {/* Hotkeys Quick Reference */}
              <div className="p-2.5 rounded bg-black/30 border border-white/5 space-y-1.5">
                <span className="font-semibold text-slate-300">Global Emergency Hotkeys:</span>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Panic Hide / Show HUD</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-200 font-mono">
                    Ctrl + Shift + H
                  </kbd>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Toggle Click-Through Mode</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-200 font-mono">
                    Ctrl + Shift + X
                  </kbd>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Emergency Quit App</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-200 font-mono">
                    Ctrl + Shift + Q
                  </kbd>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
