import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, ArrowDown, Trash2 } from 'lucide-react';
import { TranscriptEntry, SpeakerRole } from '../types';

interface TranscriptFeedProps {
  transcripts: TranscriptEntry[];
  interimText: { role: SpeakerRole; text: string } | null;
  onClear: () => void;
  fontSize: 'sm' | 'base' | 'lg';
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  transcripts,
  interimText,
  onClear,
  fontSize,
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
        <div className="flex items-center gap-1.5 font-medium">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>Live Audio Transcript</span>
          <span className="text-[10px] text-slate-500 font-mono">({transcripts.length})</span>
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
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-6">
            <p className="text-xs">Listening to meeting audio...</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Interviewer questions and candidate responses will appear here live.
            </p>
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
