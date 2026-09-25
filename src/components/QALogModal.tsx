import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Search,
  Sparkles,
  Clock,
  User,
  Cpu
} from 'lucide-react';
import { QALogEntry } from '../types';
import { qaLogger } from '../services/logger';

interface QALogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QALogModal: React.FC<QALogModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<QALogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [logFilePath, setLogFilePath] = useState('interview_qa.log');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = qaLogger.subscribe((newHistory) => {
      setHistory(newHistory);
    });
    qaLogger.getLogFilePath().then((path) => {
      setLogFilePath(path);
    });
    return unsub;
  }, [isOpen]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return [...history].reverse();
    const q = searchQuery.toLowerCase();
    return [...history]
      .reverse()
      .filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          item.speaker.toLowerCase().includes(q) ||
          item.provider.toLowerCase().includes(q)
      );
  }, [history, searchQuery]);

  if (!isOpen) return null;

  const handleCopyItem = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const md = qaLogger.exportAsMarkdown();
    navigator.clipboard.writeText(md);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleOpenLogFile = async () => {
    await qaLogger.openLogFile();
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all recorded interview Q&A logs?')) {
      qaLogger.clearHistory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-drag">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/90 select-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-500/30 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Transcript & Q&A Logs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-500/20">
                  {history.length} {history.length === 1 ? 'Question' : 'Questions'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                All detected interview questions and AI-generated answers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenLogFile}
              title="Open log text file on your PC"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>Open .txt File</span>
            </button>

            <button
              onClick={handleCopyAll}
              disabled={history.length === 0}
              title="Copy entire interview session as markdown"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/10 bg-slate-950/50">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past questions, topics, keywords..."
              className="w-full bg-slate-900/90 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              title="Clear all Q&A history"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Q&A Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-white/5 flex items-center justify-center text-slate-500">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-slate-300">
                {searchQuery ? 'No matching questions found' : 'No interview questions logged yet'}
              </h3>
              <p className="text-[11px] text-slate-500 max-w-sm">
                {searchQuery
                  ? 'Try searching with a different keyword or clear search.'
                  : 'Start audio capture or simulate a question in HUD. Every detected question and generated answer is automatically saved here.'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item, index) => {
              const latencyText = item.latencyMs ? `${(item.latencyMs / 1000).toFixed(2)}s` : null;
              const formattedCopy = `Question:\n"${item.question}"\n\nAI Answer (${item.provider}${item.model ? ` · ${item.model}` : ''}):\n${item.answer}`;

              return (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-950/60 border border-white/10 p-3.5 space-y-3 hover:border-white/20 transition-all shadow-sm"
                >
                  {/* Card Meta Header */}
                  <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">
                        #{filteredHistory.length - index}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                          item.speaker === 'interviewer'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        <User className="w-2.5 h-2.5" />
                        <span className="capitalize">{item.speaker}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                        <Cpu className="w-2.5 h-2.5 text-purple-400" />
                        <span>{item.provider}</span>
                        {item.model && <span className="text-slate-400">· {item.model}</span>}
                      </span>

                      {latencyText && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-mono">
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>{latencyText}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.timeString}
                      </span>
                      <button
                        onClick={() => handleCopyItem(item.id, formattedCopy)}
                        title="Copy this Q&A pair"
                        className="p-1 hover:text-white text-slate-400 hover:bg-white/5 rounded transition-colors cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Question Box */}
                  <div className="rounded-lg bg-amber-950/20 border border-amber-500/30 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 mb-1">
                      <span>❓ Detected Question:</span>
                    </div>
                    <p className="text-xs text-amber-100 font-medium leading-relaxed">
                      "{item.question}"
                    </p>
                  </div>

                  {/* Answer Box */}
                  <div className="rounded-lg bg-slate-900/90 border border-white/5 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 mb-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Generated Answer:</span>
                    </div>
                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Persistent Log Path Info */}
        <div className="px-4 py-2 border-t border-white/10 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 truncate max-w-md">
            <span>Log File:</span>
            <code className="text-[10px] text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5 truncate font-mono">
              {logFilePath}
            </code>
          </div>
          <button
            onClick={handleOpenLogFile}
            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>View text file</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
