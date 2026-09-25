import React, { useState, useEffect } from 'react';
import { X, Smartphone, Copy, Check, ExternalLink, Wifi, Shield, Mic, Zap } from 'lucide-react';

interface MobileRemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileRemoteModal: React.FC<MobileRemoteModalProps> = ({ isOpen, onClose }) => {
  const [mobileInfo, setMobileInfo] = useState<{
    ip: string;
    port: number;
    url: string;
    activeClients: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && window.electronAPI?.getMobileServerInfo) {
      window.electronAPI.getMobileServerInfo().then((info) => {
        if (info) setMobileInfo(info);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const remoteUrl = mobileInfo?.url || `http://localhost:4899`;

  const handleCopy = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLocal = () => {
    window.open(remoteUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl glass-panel border border-white/15 bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Mobile Remote Controller</h2>
              <p className="text-[11px] text-slate-400">Control HUD & receive answers from your phone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-[11px] uppercase tracking-wider">Server Active (Port {mobileInfo?.port || 4899})</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400/80">
              <Wifi className="w-3.5 h-3.5" />
              <span>Same Wi-Fi / Hotspot</span>
            </div>
          </div>

          {/* URL Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 tracking-wide">
              Open this URL on your Mobile (Chrome or Safari):
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-blue-500/30 font-mono text-sm text-blue-300 select-all font-semibold overflow-x-auto whitespace-nowrap">
                {remoteUrl}
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md transition-colors whitespace-nowrap cursor-pointer active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick test button */}
          <div className="flex justify-end">
            <button
              onClick={handleOpenLocal}
              className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Preview Controller in browser</span>
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[11px]">
                <Zap className="w-3.5 h-3.5" />
                <span>Stealth Typing</span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                Type question on your phone under the table. Instant answer appears on PC HUD!
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                <Mic className="w-3.5 h-3.5" />
                <span>Phone Mic Input</span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                Dictate questions hands-free using your phone's built-in speech recognition.
              </p>
            </div>
          </div>

          {/* How to use */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>Super Stealth Setup:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Connect phone & PC to same Wi-Fi or phone's Hotspot.</li>
              <li>Open URL above in mobile browser (can add to Home Screen).</li>
              <li>As soon as you type and tap Send, the AI streams bullets simultaneously to PC HUD and your phone!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
