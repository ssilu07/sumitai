import React, { useState } from 'react';
import { Sparkles, Copy, Check, RotateCw, Square, Zap, Lock, Unlock } from 'lucide-react';
import { AISuggestion } from '../types';

interface AnswerPanelProps {
  suggestion: AISuggestion | null;
  isGenerating: boolean;
  onRegenerate: () => void;
  onStop: () => void;
  onTogglePin?: () => void;
  fontSize: 'sm' | 'base' | 'lg';
}

export const AnswerPanel: React.FC<AnswerPanelProps> = ({
  suggestion,
  isGenerating,
  onRegenerate,
  onStop,
  onTogglePin,
  fontSize,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!suggestion) return;
    const textToCopy = suggestion.bullets.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fontClasses = {
    sm: 'text-xs leading-relaxed',
    base: 'text-sm leading-relaxed',
    lg: 'text-base leading-relaxed',
  }[fontSize];

  // Helper to render bold markdown formatting (**keyword**) cleanly in bullet points
  const renderFormattedLine = (line: string) => {
    // Strip leading dashes or bullets like "- " or "* "
    const cleaned = line.replace(/^[-*•]\s+/, '');
    const parts = cleaned.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const keyword = part.slice(2, -2);
        return (
          <span key={index} className="font-semibold text-amber-300 bg-amber-950/30 px-1 py-0.5 rounded text-[0.95em]">
            {keyword}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-white/10 bg-slate-950/40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/5 text-xs text-slate-300 no-drag">
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'text-amber-400 animate-spin' : 'text-amber-400'}`} />
          <span className="font-semibold text-amber-400">AI Co-Pilot Answer</span>
          {isGenerating && (
            <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
              <Zap className="w-2.5 h-2.5" /> streaming
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isGenerating ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 text-[11px] transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            suggestion && (
              <>
                {onTogglePin && (
                  <button
                    onClick={onTogglePin}
                    title={
                      suggestion.isPinned
                        ? 'Unlock answer (allow auto-updates)'
                        : 'Lock answer (prevents candidate speech from overwriting)'
                    }
                    className={`p-1 rounded transition-colors ${
                      suggestion.isPinned
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {suggestion.isPinned ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  onClick={onRegenerate}
                  title="Regenerate answer"
                  className="p-1 hover:text-white hover:bg-white/5 rounded text-slate-400 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCopy}
                  title="Copy bullet points"
                  className="p-1 hover:text-white hover:bg-white/5 rounded text-slate-400 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Answer Content */}
      <div className={`flex-1 overflow-y-auto p-3 space-y-2 ${fontClasses}`}>
        {!suggestion && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-center py-4 px-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">AI Co-Pilot is Listening & Ready</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
              Pre-trained on <span className="text-amber-300 font-medium">Android, Kotlin & Jetpack Compose</span> for <span className="text-slate-200 font-medium">Sumit Singh (5 YOE)</span>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 mt-2.5 max-w-sm">
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">Jetpack Compose</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">Coroutines & Flow</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">Clean MVVM</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">Koin DI</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">Room DB</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">Offline-First</span>
            </div>
          </div>
        )}

        {suggestion && (
          <div className="space-y-2 animate-fade-in">
            {/* Detected Question Banner */}
            {suggestion.question && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-white/5 px-2.5 py-1 rounded border-l-2 border-amber-400/80">
                <div className="flex-1 mr-2">
                  <span className="text-amber-400 font-semibold">Q: </span>
                  <span className="italic">{suggestion.question}</span>
                </div>
                {suggestion.isPinned && (
                  <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-amber-300 font-sans bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30 font-medium">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>
            )}

            {/* Formatted Bullets */}
            <ul className="space-y-2 text-slate-200">
              {suggestion.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-white/[0.02] p-2 rounded border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0 shadow-sm shadow-amber-400/50" />
                  <div className="flex-1 leading-relaxed">
                    {renderFormattedLine(bullet)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
