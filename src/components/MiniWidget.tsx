import React, { useState } from 'react';
import { Shield, Maximize2, X } from 'lucide-react';

interface MiniWidgetProps {
  isAudioCapturing: boolean;
  isGenerating: boolean;
  sttStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  onExpand: () => void;
  onClose?: () => void;
}

export const MiniWidget: React.FC<MiniWidgetProps> = ({
  isAudioCapturing,
  isGenerating,
  sttStatus,
  onExpand,
  onClose,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    // Outer wrapper — full window area, also draggable so edges drag the window
    <div
      className="titlebar-drag w-full h-full flex items-center justify-center select-none bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glass card — draggable background ring around the icon */}
      <div className="titlebar-drag relative w-14 h-14 rounded-2xl bg-slate-950/95 border-2 border-blue-500/60 shadow-2xl shadow-blue-500/20 backdrop-blur-xl flex items-center justify-center transition-all duration-200 hover:border-blue-400 group">

        {/* ── Expand button (no-drag so clicks register) ── */}
        {/* inset-[8px] means 8px padding from card edge stays as drag area */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          title="Click to expand • Drag edges to move"
          className="no-drag absolute inset-[8px] flex flex-col items-center justify-center rounded-lg cursor-pointer focus:outline-none z-10"
        >
          {isHovered ? (
            <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-150">
              <Maximize2 className="w-5 h-5 text-blue-300 pointer-events-none drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              <span className="text-[7px] font-semibold text-blue-200 mt-0.5 tracking-tight pointer-events-none">
                Expand
              </span>
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              {/* Spinning ring while generating */}
              {isGenerating && (
                <span className="absolute -inset-1 rounded-full border border-blue-400 border-t-transparent animate-spin pointer-events-none" />
              )}
              <Shield
                className={`w-6 h-6 pointer-events-none drop-shadow-[0_0_6px_rgba(59,130,246,0.6)] ${
                  isGenerating ? 'text-blue-400 animate-pulse' : 'text-blue-400'
                }`}
              />
              {/* Status dot */}
              <span
                className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 pointer-events-none ${
                  isAudioCapturing
                    ? sttStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : sttStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                    : 'bg-slate-500'
                }`}
              />
            </div>
          )}
        </button>

        {/* ── Close button (no-drag, top-right corner) ── */}
        {onClose && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Close Copilot"
            className={`no-drag absolute top-0.5 right-0.5 p-0.5 rounded-full z-20 transition-all duration-150 ${
              isHovered
                ? 'opacity-100 text-slate-400 hover:text-rose-400 hover:bg-white/10'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <X className="w-2.5 h-2.5 pointer-events-none" />
          </button>
        )}

        {/* Drag hint — tiny pill at bottom visible on hover */}
        <div
          className={`titlebar-drag absolute bottom-1 w-5 h-1 rounded-full transition-colors duration-200 ${
            isHovered ? 'bg-blue-400/70' : 'bg-slate-600/50'
          }`}
          title="Drag to move"
        />
      </div>
    </div>
  );
};
