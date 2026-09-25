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
  onContentHeightChange?: (contentHeight: number) => void;
}

export const AnswerPanel: React.FC<AnswerPanelProps> = ({
  suggestion,
  isGenerating,
  onRegenerate,
  onStop,
  onTogglePin,
  fontSize,
  onContentHeightChange,
}) => {
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    if (!suggestion) return;
    const textToCopy = suggestion.bullets.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compact, crisp typography for easy interview scanning
  const fontClasses = {
    sm: 'text-[11px] leading-snug',
    base: 'text-xs leading-relaxed',
    lg: 'text-[13px] leading-relaxed',
  }[fontSize];

  // Helper to render bold markdown formatting (**keyword**) and inline code (`code`) cleanly
  const renderFormattedLine = (line: string) => {
    // Strip leading bullets: • - * 🔹 ➤ ▸ ★ or numbered (1. 2. etc.)
    const cleaned = line
      .replace(/^[•\-\*🔹➤▸★]\s+/, '')
      .replace(/^\d+\.\s+/, '');
    const parts = cleaned.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const keyword = part.slice(2, -2);
        return (
          <span key={index} className="font-semibold text-amber-300 bg-amber-950/30 px-1 py-0.5 rounded text-[0.92em]">
            {keyword}
          </span>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const code = part.slice(1, -1);
        return (
          <code key={index} className="font-mono text-emerald-300 bg-slate-900/80 px-1 py-0.5 rounded text-[0.88em] border border-slate-700/60">
            {code}
          </code>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Parse suggestion lines into section headers, code blocks, or regular bullet points
  const parsedItems = React.useMemo(() => {
    if (!suggestion?.bullets) return [];

    const items: Array<{
      type: 'header' | 'code' | 'bullet' | 'text';
      content: string;
    }> = [];

    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    // Flatten any elements that might already contain newlines
    const rawLines: string[] = [];
    for (const b of suggestion.bullets) {
      if (typeof b === 'string' && b.includes('\n')) {
        rawLines.push(...b.split('\n'));
      } else {
        rawLines.push(b);
      }
    }

    for (const raw of rawLines) {
      const trimmed = raw.trim();

      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          if (codeBuffer.length > 0) {
            items.push({ type: 'code', content: codeBuffer.join('\n') });
            codeBuffer = [];
          }
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          const remainder = trimmed.slice(3).replace(/^[a-zA-Z0-9_-]+/, '').trim();
          if (remainder) codeBuffer.push(remainder);
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(raw);
        continue;
      }

      if (!trimmed) continue;

      // Section headers: **1. X**, ### X, numbered bold headers
      const isHeader =
        /^(\*{0,2}(?:\d+\.|#+)\s*(?:Definition|Why|Key Benefits|Benefits|Differences|Example|Code Example|How|Senior|Note|Summary).*)/i.test(trimmed) ||
        /^(\*{2}(?:1\.|2\.|3\.|4\.).*?\*{2}:?)$/i.test(trimmed) ||
        /^#{1,3}\s+\w/.test(trimmed);

      if (isHeader) {
        items.push({ type: 'header', content: trimmed });
      } else if (
        // Standard bullets: • - * 🔹 ➤ ▸ ★ numbered (1. 2.)
        /^[•\-\*🔹➤▸★]\s/.test(trimmed) ||
        /^\d+\.\s+/.test(trimmed) ||
        /^\*\*[^*]+?\*\*/.test(trimmed)
      ) {
        items.push({ type: 'bullet', content: trimmed });
      } else {
        items.push({ type: 'text', content: trimmed });
      }
    }

    if (codeBuffer.length > 0) {
      items.push({ type: 'code', content: codeBuffer.join('\n') });
    }

    return items;
  }, [suggestion?.bullets]);

  const answerContentRef = React.useRef<HTMLDivElement>(null);

  // Dynamically report unconstrained content height to parent for auto-expansion
  React.useEffect(() => {
    if (!onContentHeightChange) return;

    const measureHeight = () => {
      if (answerContentRef.current) {
        // Measure true unconstrained rendered height of all answer bullets and code
        const h = Math.ceil(
          answerContentRef.current.getBoundingClientRect().height ||
          answerContentRef.current.scrollHeight ||
          answerContentRef.current.offsetHeight
        );
        onContentHeightChange(h);
      } else {
        onContentHeightChange(0);
      }
    };

    // Immediate measure + rAF to ensure layout is painted
    measureHeight();
    const rafId = requestAnimationFrame(measureHeight);

    if (!answerContentRef.current) {
      return () => cancelAnimationFrame(rafId);
    }

    const observer = new ResizeObserver(() => {
      measureHeight();
    });
    observer.observe(answerContentRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [suggestion, suggestion?.bullets, isGenerating, fontSize, onContentHeightChange]);

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
      <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto p-2.5 space-y-1.5 ${fontClasses}`}>
        {!suggestion && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-center py-4 px-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">AI Co-Pilot is Listening & Ready</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-xs">
              Pre-trained on <span className="text-amber-300 font-medium">Android, Kotlin & Jetpack Compose</span> for <span className="text-slate-200 font-medium">Sumit Singh (5 YOE)</span>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 mt-2 max-w-sm">
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9.5px] text-slate-300">Jetpack Compose</span>
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9.5px] text-slate-300">Coroutines & Flow</span>
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9.5px] text-slate-300">Clean MVVM</span>
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9.5px] text-slate-300">Koin DI</span>
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9.5px] text-slate-300">Room DB</span>
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9.5px] text-slate-300">Offline-First</span>
            </div>
          </div>
        )}

        {suggestion && (
          <div ref={answerContentRef} className="space-y-1.5 animate-fade-in">
            {/* Detected Question Banner */}
            {suggestion.question && (
              <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-mono bg-white/5 px-2.5 py-1 rounded border-l-2 border-amber-400/80">
                <div className="flex-1 mr-2 truncate">
                  <span className="text-amber-400 font-semibold">Q: </span>
                  <span className="italic">{suggestion.question}</span>
                </div>
                {suggestion.isPinned && (
                  <span className="flex-shrink-0 flex items-center gap-1 text-[9.5px] text-amber-300 font-sans bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30 font-medium">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>
            )}

            {/* Formatted Content */}
            <div className="space-y-1.5 text-slate-200">
              {parsedItems.map((item, idx) => {
                if (item.type === 'header') {
                  const cleanHeader = item.content.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
                  return (
                    <div key={idx} className="pt-1.5 pb-0.5 mt-1 border-t border-white/5 first:border-t-0 first:pt-0 first:mt-0">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        {cleanHeader}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'code') {
                  return (
                    <div key={idx} className="my-1.5 rounded-lg bg-slate-950/95 border border-emerald-500/30 overflow-hidden shadow-lg select-text group">
                      <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900/90 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Kotlin Program
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.content);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="Copy Code"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Code</span>
                        </button>
                      </div>
                      <div className="p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed">
                        <pre className="whitespace-pre">{item.content}</pre>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'bullet') {
                  return (
                    <div key={idx} className="flex items-start gap-1.5 bg-white/[0.02] px-2 py-1 rounded border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0 shadow-sm shadow-amber-400/50" />
                      <div className="flex-1 leading-relaxed">
                        {renderFormattedLine(item.content)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="px-2 py-0.5 text-slate-200 leading-relaxed bg-white/[0.01] rounded">
                    {renderFormattedLine(item.content)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
