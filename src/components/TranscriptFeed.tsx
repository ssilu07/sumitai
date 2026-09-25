import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, ArrowDown, Trash2, Mic, Play, Radio, Volume2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { TranscriptEntry, SpeakerRole, AudioLevels } from '../types';

interface TranscriptFeedProps {
  transcripts: TranscriptEntry[];
  interimText: { role: SpeakerRole; text: string } | null;
  onClear: () => void;
  fontSize: 'sm' | 'base' | 'lg';
  isAudioCapturing?: boolean;
  onStartAudio?: () => void;
  audioLevels?: AudioLevels;
  sttStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  sttProvider?: string;
  onSimulateQuestion?: () => void;
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  transcripts,
  interimText,
  onClear,
  fontSize,
  isAudioCapturing = false,
  onStartAudio,
  audioLevels,
  sttStatus = 'connected',
  sttProvider = 'assemblyai',
  onSimulateQuestion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll when new transcript lines arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts, interimText, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const fontClasses = {
    sm: 'text-xs leading-relaxed',
    base: 'text-sm leading-relaxed',
    lg: 'text-base leading-relaxed',
  }[fontSize];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-black/20 text-xs text-slate-400 no-drag">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>Live Audio Transcript</span>
          <span className="text-[10px] text-slate-500 font-mono">({transcripts.length})</span>

          {/* Real-time status pill */}
          {isAudioCapturing ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>STT Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400 border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>Stopped</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {transcripts.length > 0 && (
            <button
              onClick={onClear}
              title="Clear transcript history"
              className="p-1 hover:text-rose-400 hover:bg-white/5 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transcript Scroll Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-3 space-y-2.5 ${fontClasses}`}
      >
        {transcripts.length === 0 && !interimText && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            {!isAudioCapturing ? (
              <div className="max-w-xs space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">Audio Capture Not Started</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Click the button below to start capturing interviewer speech & microphone.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  {onStartAudio && (
                    <button
                      onClick={onStartAudio}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-950 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Listening Now</span>
                    </button>
                  )}
                  {onSimulateQuestion && (
                    <button
                      onClick={onSimulateQuestion}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-white/5 border border-white/10 text-slate-300 text-[11px] font-medium transition-all"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      <span>Test with Sample Question</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-sm space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Listening Live to Meeting Audio</span>
                  </h3>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-mono">
                      STT Engine: <strong className="text-slate-200 uppercase">{sttProvider}</strong>
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      sttStatus === 'connected' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20' : sttStatus === 'connecting' ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20' : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                    }`}>
                      {sttStatus === 'connected' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      <span className="capitalize">{sttStatus}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Speak into your microphone or play interviewer audio (Google Meet, Zoom, YouTube). Transcripts will appear instantly.
                  </p>
                </div>

                {/* Live Channel Audio Health Monitors */}
                {audioLevels && (
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-black/40 border border-white/5 text-[10px]">
                    <div className="flex items-center gap-2">
                      <Volume2 className={`w-3.5 h-3.5 ${audioLevels.isSpeakerActive ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
                      <div className="text-left">
                        <span className="text-slate-400 block">System Audio</span>
                        <span className={audioLevels.isSpeakerActive ? 'text-blue-300 font-medium' : 'text-slate-500'}>
                          {audioLevels.isSpeakerActive ? 'Voice Detected' : 'Waiting...'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mic className={`w-3.5 h-3.5 ${audioLevels.isMicActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                      <div className="text-left">
                        <span className="text-slate-400 block">Your Mic</span>
                        <span className={audioLevels.isMicActive ? 'text-emerald-300 font-medium' : 'text-slate-500'}>
                          {audioLevels.isMicActive ? 'Voice Detected' : 'Waiting...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {onSimulateQuestion && (
                  <button
                    onClick={onSimulateQuestion}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-slate-300 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span>Simulate Question to Test AI</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {transcripts.map((item) => (
          <div
            key={item.id}
            className={`rounded-md p-2 transition-all ${
              item.role === 'interviewer'
                ? 'bg-blue-950/20 border-l-2 border-blue-500 text-slate-200'
                : 'bg-emerald-950/20 border-l-2 border-emerald-500 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <span
                className={
                  item.role === 'interviewer'
                    ? 'text-blue-400'
                    : 'text-emerald-400'
                }
              >
                {item.role === 'interviewer' ? 'Interviewer' : 'You'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{item.text}</p>
          </div>
        ))}

        {/* Interim / In-flight live speech preview */}
        {interimText && (
          <div
            className={`rounded-md p-2 opacity-80 border-l-2 border-dashed ${
              interimText.role === 'interviewer'
                ? 'bg-blue-950/10 border-blue-400/60 text-blue-200'
                : 'bg-emerald-950/10 border-emerald-400/60 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-0.5">
              <span className={interimText.role === 'interviewer' ? 'text-blue-400' : 'text-emerald-400'}>
                {interimText.role === 'interviewer' ? 'Interviewer (speaking...)' : 'You (speaking...)'}
              </span>
            </div>
            <p className="italic">{interimText.text}</p>
          </div>
        )}
      </div>

      {/* Scroll to bottom button if user scrolled up */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="no-drag absolute bottom-14 right-6 bg-blue-600/90 hover:bg-blue-500 text-white rounded-full p-1.5 shadow-lg backdrop-blur text-xs flex items-center gap-1 transition-all"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span className="text-[10px] pr-1">Latest</span>
        </button>
      )}
    </div>
  );
};
