import { QALogEntry, SpeakerRole } from '../types';

class QALogger {
  private history: QALogEntry[] = [];
  private listeners: Array<(history: QALogEntry[]) => void> = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem('prateek_interview_qa_logs');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem('prateek_interview_qa_logs', JSON.stringify(this.history.slice(-100)));
    } catch {}
    this.notify();
  }

  private notify() {
    const copy = [...this.history];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }

  /**
   * Subscribe to Q&A log changes
   */
  subscribe(listener: (history: QALogEntry[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.history]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getHistory(): QALogEntry[] {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    console.log('%c[QALogger] History cleared.', 'color: #94a3b8; font-style: italic;');
  }

  /**
   * Log incoming speech transcript chunk (Interviewer or Candidate)
   */
  logTranscript(speaker: SpeakerRole, text: string) {
    if (!text || text.trim().length === 0) return;
    const timeStr = new Date().toLocaleTimeString();
    const speakerLabel = speaker === 'interviewer' ? 'INTERVIEWER' : speaker === 'candidate' ? 'CANDIDATE' : 'SYSTEM';
    const color = speaker === 'interviewer' ? '#60a5fa' : '#34d399';

    // Formatted browser DevTools output
    console.log(
      `%c[TRANSCRIPT] %c[${speakerLabel}] %c${timeStr}: %c"${text}"`,
      'color: #38bdf8; font-weight: bold;',
      `color: ${color}; font-weight: bold;`,
      'color: #94a3b8;',
      'color: #f1f5f9; font-weight: normal;'
    );

    // Forward to Electron process for terminal stdout + file log
    if (window.electronAPI?.logTranscriptEvent) {
      window.electronAPI.logTranscriptEvent({
        timestamp: Date.now(),
        timeString: timeStr,
        speaker,
        text,
      }).catch(() => {});
    }
  }

  /**
   * Log question detected by questionDetector or manual trigger
   */
  logQuestionDetected(speaker: SpeakerRole, question: string, source: string = 'auto') {
    const timeStr = new Date().toLocaleTimeString();
    console.log(
      `%c❓ [QUESTION DETECTED] %c[${speaker.toUpperCase()}] %c(${source}) %c${timeStr}\n%c"${question}"`,
      'color: #f59e0b; font-weight: bold;',
      'color: #60a5fa; font-weight: bold;',
      'color: #a855f7;',
      'color: #94a3b8;',
      'color: #fef08a; font-weight: bold; font-size: 1.05em;'
    );
  }

  /**
   * Log completed Question + Generated Answer pair
   */
  logQA(
    entry: Omit<QALogEntry, 'id' | 'timestamp' | 'timeString'> & {
      id?: string;
      timestamp?: number;
      timeString?: string;
    }
  ): QALogEntry {
    const now = entry.timestamp || Date.now();
    const timeStr = entry.timeString || new Date(now).toLocaleTimeString();
    const fullEntry: QALogEntry = {
      id: entry.id || `${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeString: timeStr,
      speaker: entry.speaker,
      question: entry.question,
      answer: entry.answer,
      provider: entry.provider,
      model: entry.model,
      latencyMs: entry.latencyMs,
      source: entry.source || 'stt-auto',
    };

    // Add to in-memory history and save to localStorage
    this.history.push(fullEntry);
    this.saveHistory();

    // DevTools Console Output (Grouped for clean inspection)
    const latencyStr = entry.latencyMs ? ` (${(entry.latencyMs / 1000).toFixed(2)}s)` : '';
    console.group(
      `%c🤖 [Q&A GENERATED] %c${timeStr} %c| %c${entry.speaker.toUpperCase()} %c| %c${entry.provider}${entry.model ? ` (${entry.model})` : ''}${latencyStr}`,
      'color: #10b981; font-weight: bold;',
      'color: #94a3b8;',
      'color: #64748b;',
      'color: #60a5fa; font-weight: bold;',
      'color: #64748b;',
      'color: #a855f7; font-weight: bold;'
    );
    console.log('%cQuestion:', 'color: #f59e0b; font-weight: bold;', entry.question);
    console.log('%cAnswer Generated:', 'color: #34d399; font-weight: bold;\n' + entry.answer);
    console.groupEnd();

    // Send to Electron Main Process for terminal output & persistent disk logging
    if (window.electronAPI?.logQAEvent) {
      window.electronAPI.logQAEvent(fullEntry).catch((err: any) => {
        console.warn('[QALogger] Could not send QA event to main process:', err);
      });
    }

    return fullEntry;
  }

  /**
   * Opens the local log file in default text editor (e.g. Notepad)
   */
  async openLogFile(): Promise<boolean> {
    if (window.electronAPI?.openLogFile) {
      return await window.electronAPI.openLogFile();
    }
    return false;
  }

  /**
   * Returns current log file path
   */
  async getLogFilePath(): Promise<string> {
    if (window.electronAPI?.getLogFilePath) {
      return await window.electronAPI.getLogFilePath();
    }
    return 'logs/interview_qa.log';
  }

  /**
   * Export all Q&A entries as clean markdown
   */
  exportAsMarkdown(): string {
    if (this.history.length === 0) {
      return '# Interview Q&A Session Logs\n\nNo questions recorded yet.\n';
    }

    let md = `# Interview Q&A Session Logs\n\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n`;
    md += `*Total Questions Answered: ${this.history.length}*\n\n---\n\n`;

    this.history.forEach((item, index) => {
      const latency = item.latencyMs ? ` (${(item.latencyMs / 1000).toFixed(2)}s)` : '';
      md += `### ${index + 1}. [${item.timeString}] Question by ${item.speaker.toUpperCase()}\n\n`;
      md += `**Question:**\n> ${item.question.replace(/\n/g, '\n> ')}\n\n`;
      md += `**Answer (${item.provider}${item.model ? ` · ${item.model}` : ''}${latency}):**\n\n`;
      md += `${item.answer}\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}

export const qaLogger = new QALogger();
