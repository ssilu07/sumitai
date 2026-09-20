import React from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { AudioLevels } from '../types';

interface AudioVisualizerProps {
  levels: AudioLevels;
  isMicMuted: boolean;
  isSpeakerMuted: boolean;
  onToggleMicMute: () => void;
  onToggleSpeakerMute: () => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  levels,
  isMicMuted,
  isSpeakerMuted,
  onToggleMicMute,
  onToggleSpeakerMute,
}) => {
  return (
    <div className="flex items-center gap-3 text-xs no-drag">
      {/* Interviewer Audio Level */}
      <div
        onClick={onToggleSpeakerMute}
        title={isSpeakerMuted ? "Interviewer capture muted" : "Click to mute interviewer capture"}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all duration-150 ${
          isSpeakerMuted
            ? 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
            : levels.isSpeakerActive
            ? 'bg-blue-950/60 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/20'
            : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
        }`}
      >
        <Volume2 className={`w-3.5 h-3.5 ${levels.isSpeakerActive && !isSpeakerMuted ? 'animate-pulse text-blue-400' : ''}`} />
        <span className="font-medium text-[11px]">Interviewer</span>
        <div className="w-8 h-1.5 bg-slate-700/60 rounded-full overflow-hidden flex items-center">
          <div
            className={`h-full transition-all duration-75 rounded-full ${
              isSpeakerMuted ? 'w-0' : 'bg-blue-400'
            }`}
            style={{ width: isSpeakerMuted ? '0%' : `${Math.min(100, Math.round(levels.speakerLevel * 2.2))}%` }}
          />
        </div>
      </div>

      {/* Candidate Mic Level */}
      <div
        onClick={onToggleMicMute}
        title={isMicMuted ? "Microphone muted" : "Click to mute your microphone"}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all duration-150 ${
          isMicMuted
            ? 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
            : levels.isMicActive
            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
            : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
        }`}
      >
        <Mic className={`w-3.5 h-3.5 ${levels.isMicActive && !isMicMuted ? 'animate-pulse text-emerald-400' : ''}`} />
        <span className="font-medium text-[11px]">You</span>
        <div className="w-8 h-1.5 bg-slate-700/60 rounded-full overflow-hidden flex items-center">
          <div
            className={`h-full transition-all duration-75 rounded-full ${
              isMicMuted ? 'w-0' : 'bg-emerald-400'
            }`}
            style={{ width: isMicMuted ? '0%' : `${Math.min(100, Math.round(levels.micLevel * 2.2))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
