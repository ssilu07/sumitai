import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export interface MobileServerOptions {
  port?: number;
  onQuery: (query: string, role?: string) => void;
  onAction: (action: string, payload?: any) => void;
}

export interface MobileServerInfo {
  ip: string;
  port: number;
  url: string;
  activeClients: number;
}

let server: http.Server | null = null;
let sseClients: Set<http.ServerResponse> = new Set();
let currentSuggestionState: any = null;
let serverPort = 4899;

/**
 * Automatically determine the local LAN IP address (IPv4)
 */
export function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Broadcast payload to all connected mobile SSE clients
 */
export function broadcastToMobile(event: string, data: any) {
  if (event === 'suggestion' || event === 'token') {
    currentSuggestionState = data;
  } else if (event === 'clear') {
    currentSuggestionState = null;
  }

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Get current server status and URL
 */
export function getMobileServerInfo(): MobileServerInfo {
  const ip = getLocalIPAddress();
  return {
    ip,
    port: serverPort,
    url: `http://${ip}:${serverPort}`,
    activeClients: sseClients.size,
  };
}

/**
 * Starts the Mobile Remote Controller HTTP + SSE Server
 */
export function startMobileServer(options: MobileServerOptions): Promise<MobileServerInfo> {
  return new Promise((resolve) => {
    const targetPort = options.port || 4899;

    server = http.createServer((req, res) => {
      // Enable CORS for all local requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url || '/', `http://localhost:${serverPort}`);
      const pathname = parsedUrl.pathname;

      // ── 1. SSE Real-Time Event Stream ─────────────────────────────────────────
      if (pathname === '/api/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write('retry: 2000\n\n');

        // Send current state immediately on connect
        if (currentSuggestionState) {
          res.write(`event: suggestion\ndata: ${JSON.stringify(currentSuggestionState)}\n\n`);
        } else {
          res.write(`event: ready\ndata: ${JSON.stringify({ status: 'connected', ip: getLocalIPAddress() })}\n\n`);
        }

        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // ── 2. Submit Question from Mobile (POST /api/query) ──────────────────────
      if (pathname === '/api/query' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const query = (data.query || '').trim();
            if (query) {
              console.log(`\x1b[36m[MobileRemote]\x1b[0m Received question from mobile: \x1b[32m"${query}"\x1b[0m`);
              options.onQuery(query, data.role || 'interviewer');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Question sent to HUD' }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Empty query' }));
            }
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // ── 3. Stealth Actions from Mobile (POST /api/action) ─────────────────────
      if (pathname === '/api/action' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const action = data.action;
            if (action) {
              console.log(`\x1b[36m[MobileRemote]\x1b[0m Triggered action: \x1b[33m${action}\x1b[0m`);
              options.onAction(action, data.payload);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, action }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Missing action' }));
            }
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // ── 4. Status Check (GET /api/info) ───────────────────────────────────────
      if (pathname === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getMobileServerInfo()));
        return;
      }

      // ── 5. Serve the Mobile Stealth Controller Web App (GET /) ───────────────
      if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMobileHTML());
        return;
      }

      // ── 6. Download Native Android App APK (GET /download or /PrateekRemote.apk) ───
      if (pathname === '/download' || pathname === '/PrateekRemote.apk' || pathname === '/app-debug.apk') {
        const potentialPaths = [
          path.join(process.cwd(), 'release', 'PrateekRemote.apk'),
          path.join(process.cwd(), 'android-app', 'PrateekRemote.apk'),
          path.join(process.cwd(), 'android-app', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
        ];
        const apkPath = potentialPaths.find(p => fs.existsSync(p));
        if (apkPath) {
          const stat = fs.statSync(apkPath);
          res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Length': stat.size,
            'Content-Disposition': 'attachment; filename="PrateekRemote.apk"'
          });
          fs.createReadStream(apkPath).pipe(res);
          return;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('APK is compiling. Please check back in a moment or build with ./gradlew assembleDebug.');
          return;
        }
      }

      // Default 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    server.listen(targetPort, '0.0.0.0', () => {
      serverPort = targetPort;
      const info = getMobileServerInfo();
      printStartupBanner(info.url);
      resolve(info);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[MobileRemote] Port ${targetPort} in use, trying ${targetPort + 1}...`);
        startMobileServer({ ...options, port: targetPort + 1 }).then(resolve);
      } else {
        console.error('[MobileRemote] Server error:', err);
      }
    });
  });
}

export function stopMobileServer() {
  if (server) {
    server.close();
    server = null;
    sseClients.clear();
  }
}

function printStartupBanner(url: string) {
  console.log('\n\x1b[32m' + '═'.repeat(68) + '\x1b[0m');
  console.log(' \x1b[1m\x1b[36m📱 PRATEEK COPILOT - MOBILE REMOTE CONTROLLER ACTIVE\x1b[0m');
  console.log('\x1b[32m' + '═'.repeat(68) + '\x1b[0m');
  console.log(' \x1b[1m👉 Open this link on your Mobile (Same Wi-Fi / Hotspot):\x1b[0m');
  console.log(`    \x1b[1m\x1b[33m${url}\x1b[0m\n`);
  console.log(' \x1b[90m• Type questions or use phone microphone to dictate\x1b[0m');
  console.log(' \x1b[90m• Answers instantly appear on PC HUD and your phone screen!\x1b[0m');
  console.log(' \x1b[90m• Emergency buttons: Stealth Hide, Clear, and Code Presets\x1b[0m');
  console.log('\x1b[32m' + '═'.repeat(68) + '\x1b[0m\n');
}

/**
 * Returns the complete standalone HTML/CSS/JS for the Mobile Web Remote Controller
 */
function getMobileHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#060709">
  <title>Prateek AI - Stealth Mobile Remote</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      background-color: #060709;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 12px 14px calc(18px + env(safe-area-inset-bottom));
      overflow-x: hidden;
    }
    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #f8fafc;
    }
    .badge {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Input Section */
    .input-card {
      background: rgba(18, 22, 31, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .textarea-wrapper {
      position: relative;
    }
    textarea {
      width: 100%;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: #f8fafc;
      font-size: 15px;
      line-height: 1.4;
      padding: 10px 12px;
      min-height: 84px;
      resize: none;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    textarea:focus {
      border-color: #38bdf8;
    }
    textarea::placeholder {
      color: #64748b;
      font-size: 13.5px;
    }

    /* Primary Actions */
    .action-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 13.5px;
      padding: 11px 14px;
      border: none;
      cursor: pointer;
      user-select: none;
      transition: all 0.12s active;
    }
    .btn:active {
      transform: scale(0.97);
      opacity: 0.85;
    }
    .btn-send {
      flex: 1;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      box-shadow: 0 2px 12px rgba(37, 99, 235, 0.35);
    }
    .btn-mic {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 11px 16px;
    }
    .btn-mic.recording {
      background: rgba(239, 68, 68, 0.25);
      border-color: #ef4444;
      color: #f87171;
      animation: pulse 1s infinite;
    }

    /* Preset Chips */
    .presets-scroll {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 6px;
      margin-bottom: 12px;
      scrollbar-width: none;
    }
    .presets-scroll::-webkit-scrollbar {
      display: none;
    }
    .chip {
      white-space: nowrap;
      font-size: 11.5px;
      font-weight: 500;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 5px 11px;
      cursor: pointer;
    }
    .chip:active {
      background: rgba(56, 189, 248, 0.2);
      border-color: #38bdf8;
      color: #38bdf8;
    }

    /* Stealth Controls */
    .stealth-toolbar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }
    .btn-stealth {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px 4px;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .btn-stealth span.icon {
      font-size: 16px;
    }

    /* Answer Display Container */
    .answer-card {
      flex: 1;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      min-height: 220px;
    }
    .answer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 10px;
    }
    .answer-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-copy {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      cursor: pointer;
    }
    .question-badge {
      font-size: 12.5px;
      font-weight: 600;
      color: #f1f5f9;
      background: rgba(0, 0, 0, 0.35);
      padding: 6px 10px;
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 3px solid #38bdf8;
    }
    .bullets-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 14px;
      line-height: 1.5;
      color: #cbd5e1;
      overflow-y: auto;
    }
    .bullet-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .bullet-dot {
      color: #38bdf8;
      font-size: 16px;
      line-height: 1.2;
      flex-shrink: 0;
    }
    .bullet-text {
      flex: 1;
    }
    .bullet-text strong {
      color: #38bdf8;
      font-weight: 600;
    }
    .mobile-code {
      background: rgba(2, 6, 23, 0.95);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 8px;
      padding: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11.5px;
      color: #6ee7b7;
      overflow-x: auto;
      white-space: pre;
      line-height: 1.45;
      margin: 4px 0;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 160px;
      color: #64748b;
      font-size: 13px;
      text-align: center;
      gap: 6px;
    }
    .empty-icon {
      font-size: 28px;
      opacity: 0.6;
    }
    .streaming-cursor {
      display: inline-block;
      width: 7px;
      height: 15px;
      background: #38bdf8;
      margin-left: 4px;
      vertical-align: middle;
      animation: blink 0.8s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(56, 189, 248, 0.5);
      color: #f8fafc;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12.5px;
      font-weight: 600;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    }
    .toast.show {
      opacity: 1;
    }
    .bottom-bar-container {
      position: sticky;
      bottom: 12px;
      margin-top: 14px;
      z-index: 100;
    }
    .bottom-generate-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #0f172a, #1e293b, rgba(2, 132, 199, 0.25));
      border: 1.5px solid rgba(56, 189, 248, 0.45);
      border-radius: 16px;
      padding: 12px 16px;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      transition: transform 0.15s, border-color 0.2s, background 0.2s;
    }
    .bottom-generate-bar:active {
      transform: scale(0.98);
      border-color: #38bdf8;
      background: linear-gradient(135deg, #0f172a, #0369a1);
    }
    .bottom-generate-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #38bdf8, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 900;
      color: white;
      flex-shrink: 0;
    }
    .bottom-generate-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bottom-generate-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 700;
      color: white;
      letter-spacing: 0.3px;
    }
    .enter-badge {
      background: rgba(56, 189, 248, 0.2);
      border: 0.5px solid rgba(56, 189, 248, 0.6);
      color: #38bdf8;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .bottom-generate-sub {
      font-size: 11px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bottom-generate-status {
      font-size: 18px;
      color: #38bdf8;
      flex-shrink: 0;
    }
  </style>
</head>
<body>

  <!-- Top Bar -->
  <div class="header">
    <div class="brand">
      <span style="font-size: 18px;">⚡</span>
      <span class="brand-title">Prateek AI Remote</span>
    </div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <a href="/download" style="text-decoration: none; font-size: 10.5px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); padding: 3px 8px; border-radius: 999px; display: flex; align-items: center; gap: 3px;">
        <span>📥</span><span>APK</span>
      </a>
      <div class="badge" id="statusBadge">
        <span class="badge-dot"></span>
        <span id="statusText">LIVE PC</span>
      </div>
    </div>
  </div>

  <!-- Prompt Input Card -->
  <div class="input-card">
    <div class="textarea-wrapper">
      <textarea id="queryInput" placeholder="Type question or topic here... (e.g. Kotlin Coroutines vs Threads)"></textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-send" id="btnSend">
        <span>⚡ Send & Answer</span>
      </button>
      <button class="btn btn-code" id="btnCode" onclick="toggleCodingMode()" title="Toggle Kotlin Coding Mode" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; border-radius: 10px; padding: 0 12px; font-weight: 700; font-size: 12px; cursor: pointer;">
        <span id="codeBtnText">💻 Kotlin Code</span>
      </button>
      <button class="btn btn-mic" id="btnMic" title="Voice Input (Speech-to-Text)">
        <span>🎤 Mic</span>
      </button>
    </div>
  </div>

  <!-- Quick Preset Chips -->
  <div class="presets-scroll">
    <button class="chip" onclick="quickSend('[Kotlin Coding Mode] Palindrome string program using Kotlin extension function')">💻 Palindrome (Ext)</button>
    <button class="chip" onclick="quickSend('[Kotlin Coding Mode] High-impact idiomatic Kotlin extension functions')">🧩 Extension Func</button>
    <button class="chip" onclick="quickSend('[Kotlin Coding Mode] Coroutine Flow debounce and throttleFirst extension')">⚡ Coroutines Flow</button>
    <button class="chip" onclick="quickSend('Explain architecture & design pattern with trade-offs')">🏗️ Architecture</button>
    <button class="chip" onclick="quickSend('Provide clean code example with best practices')">💻 Code Example</button>
    <button class="chip" onclick="quickSend('Key differences, pros vs cons')">⚖️ Pros vs Cons</button>
    <button class="chip" onclick="quickSend('Give 3 high-impact interview bullet points')">🎯 3 Bullets</button>
    <button class="chip" onclick="quickSend('Explain memory leak prevention & lifecycle safety')">🛡️ Memory/Lifecycle</button>
  </div>

  <!-- Stealth Toolbar -->
  <div class="stealth-toolbar">
    <button class="btn-stealth" onclick="triggerAction('scan-screen')" style="border-color: rgba(56, 189, 248, 0.5); background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
      <span class="icon">📸</span>
      <span>Scan Screen</span>
    </button>
    <button class="btn-stealth" onclick="triggerAction('toggle-stealth')">
      <span class="icon">👁️</span>
      <span>Hide HUD</span>
    </button>
    <button class="btn-stealth" onclick="triggerAction('clear')">
      <span class="icon">🧹</span>
      <span>Clear</span>
    </button>
    <button class="btn-stealth" onclick="triggerAction('toggle-mini')">
      <span class="icon">📦</span>
      <span>Mini Mode</span>
    </button>
    <button class="btn-stealth" onclick="triggerAction('stop')">
      <span class="icon">⏹️</span>
      <span>Stop AI</span>
    </button>
  </div>

  <!-- Live Answer Display Card -->
  <div class="answer-card">
    <div class="answer-header">
      <div class="answer-title">
        <span>💡 Streaming Answer</span>
        <span id="streamingIndicator" style="display: none; color: #34d399; font-size: 10px;">● STREAMING</span>
      </div>
      <button class="btn-copy" id="btnCopy" onclick="copyAnswer()">📋 Copy</button>
    </div>

    <div id="questionDisplay" class="question-badge" style="display: none;"></div>

    <div id="bulletsContainer" class="bullets-list">
      <div class="empty-state">
        <span class="empty-icon">📱</span>
        <span>Type above or tap Mic to formulate answer.</span>
        <span style="font-size: 11px; color: #475569;">Answer streams on PC HUD & this phone simultaneously.</span>
      </div>
    </div>
  </div>

  <!-- Sticky Bottom Enter/Generate Box -->
  <div class="bottom-bar-container">
    <div class="bottom-generate-bar" id="btnBottomGenerate" onclick="generateAnswer()">
      <div class="bottom-generate-icon">↵</div>
      <div class="bottom-generate-text">
        <div class="bottom-generate-title">
          <span>GENERATE ANSWER</span>
          <span class="enter-badge">ENTER</span>
        </div>
        <div class="bottom-generate-sub" id="bottomGenerateSub">Touch to trigger instant answer from audio</div>
      </div>
      <div class="bottom-generate-status" id="bottomGenerateStatus">⚡</div>
    </div>
  </div>

  <div class="toast" id="toastMsg">Sent to HUD</div>

  <script>
    const queryInput = document.getElementById('queryInput');
    const btnSend = document.getElementById('btnSend');
    const btnMic = document.getElementById('btnMic');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const bulletsContainer = document.getElementById('bulletsContainer');
    const questionDisplay = document.getElementById('questionDisplay');
    const streamingIndicator = document.getElementById('streamingIndicator');
    const toastMsg = document.getElementById('toastMsg');

    let currentBullets = [];
    let isStreaming = false;

    function showToast(msg) {
      toastMsg.textContent = msg;
      toastMsg.classList.add('show');
      setTimeout(() => toastMsg.classList.remove('show'), 1800);
    }

    function vibrate(ms = 35) {
      if (navigator.vibrate) {
        navigator.vibrate(ms);
      }
    }

    // Connect to Server-Sent Events (SSE)
    function connectSSE() {
      const eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        statusText.textContent = 'CONNECTED';
      };

      eventSource.onerror = () => {
        statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        statusText.textContent = 'RECONNECTING';
      };

      eventSource.addEventListener('suggestion', (e) => {
        try {
          const data = JSON.parse(e.data);
          renderSuggestion(data);
        } catch {}
      });

      eventSource.addEventListener('token', (e) => {
        try {
          const data = JSON.parse(e.data);
          renderSuggestion(data);
        } catch {}
      });

      eventSource.addEventListener('clear', () => {
        questionDisplay.style.display = 'none';
        bulletsContainer.innerHTML = \`
          <div class="empty-state">
            <span class="empty-icon">🧹</span>
            <span>HUD cleared</span>
          </div>
        \`;
      });
    }

    function renderSuggestion(data) {
      if (!data) return;
      if (data.question) {
        questionDisplay.textContent = 'Q: ' + data.question;
        questionDisplay.style.display = 'block';
      }

      isStreaming = !!data.isStreaming;
      streamingIndicator.style.display = isStreaming ? 'inline' : 'none';

      const bullets = data.bullets || [];
      currentBullets = bullets;

      if (bullets.length === 0) return;

      let html = '';
      let inCode = false;
      let codeLines = [];

      bullets.forEach((b, idx) => {
        const isLast = idx === bullets.length - 1;
        const trimmed = (b || '').trim();

        if (trimmed.startsWith(String.fromCharCode(96, 96, 96))) {
          if (inCode) {
            html += \`<div class="mobile-code"><pre><code>\${codeLines.join('\\n')}</code></pre></div>\`;
            codeLines = [];
            inCode = false;
          } else {
            inCode = true;
          }
          return;
        }

        if (inCode) {
          codeLines.push(b);
          if (isLast && codeLines.length > 0) {
            html += \`<div class="mobile-code"><pre><code>\${codeLines.join('\\n')}</code></pre></div>\`;
          }
          return;
        }

        // Format bold keywords
        const formatted = b
          .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
          .replace(/^[-•*]\\s*/, '');

        html += \`
          <div class="bullet-item">
            <span class="bullet-dot">▸</span>
            <span class="bullet-text">\${formatted}\${isStreaming && isLast ? '<span class="streaming-cursor"></span>' : ''}</span>
          </div>
        \`;
      });

      bulletsContainer.innerHTML = html;
    }

    let isCodingMode = false;
    function toggleCodingMode() {
      isCodingMode = !isCodingMode;
      const btn = document.getElementById('btnCode');
      const btnText = document.getElementById('codeBtnText');
      if (isCodingMode) {
        btn.style.background = 'rgba(16, 185, 129, 0.4)';
        btn.style.borderColor = '#10b981';
        btnText.textContent = '💻 Kotlin: ON';
        queryInput.placeholder = 'Kotlin Mode ON: Type problem (e.g. palindrome, extension function)...';
        showToast('💻 Kotlin Mode ON');
      } else {
        btn.style.background = 'rgba(16, 185, 129, 0.15)';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        btnText.textContent = '💻 Kotlin Code';
        queryInput.placeholder = 'Type question or topic here... (e.g. Kotlin Coroutines vs Threads)';
        showToast('Standard Mode');
      }
      vibrate(35);
    }

    // Send query to PC
    async function sendQuery(text) {
      let q = (text || queryInput.value).trim();
      if (!q) return;

      if (isCodingMode && !q.startsWith('[Kotlin Coding Mode]')) {
        q = '[Kotlin Coding Mode] ' + q;
      }

      vibrate(50);
      showToast(isCodingMode ? '💻 Generating Kotlin code...' : '⚡ Formulating Answer...');

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        if (res.ok) {
          queryInput.value = '';
          questionDisplay.textContent = 'Q: ' + q.replace('[Kotlin Coding Mode]', '💻 Kotlin:');
          questionDisplay.style.display = 'block';
          bulletsContainer.innerHTML = \`
            <div class="empty-state">
              <span class="empty-icon">⏳</span>
              <span>Thinking & streaming to HUD...</span>
            </div>
          \`;
        }
      } catch (e) {
        showToast('❌ Failed to reach PC');
      }
    }

    function quickSend(preset) {
      const base = queryInput.value.trim();
      const combined = base ? (base + ' - ' + preset) : preset;
      sendQuery(combined);
    }

    async function triggerAction(action) {
      vibrate(40);
      try {
        const res = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          showToast(action.toUpperCase());
        }
      } catch {
        showToast('Action failed');
      }
    }

    function copyAnswer() {
      if (currentBullets.length === 0) return;
      const text = currentBullets.join('\\n');
      navigator.clipboard.writeText(text);
      vibrate(30);
      showToast('📋 Copied Answer');
    }

    btnSend.addEventListener('click', () => sendQuery());

    const bottomGenerateSub = document.getElementById('bottomGenerateSub');

    queryInput.addEventListener('input', () => {
      if (queryInput.value.trim().length > 0) {
        bottomGenerateSub.textContent = 'Tap to send typed question';
      } else {
        bottomGenerateSub.textContent = 'Touch to trigger instant answer from audio';
      }
    });

    async function generateAnswer() {
      vibrate(45);
      const text = queryInput.value.trim();
      if (text) {
        sendQuery(text);
      } else {
        showToast('⚡ Generating answer on PC...');
        try {
          await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate' }),
          });
        } catch {
          showToast('❌ Failed to reach PC');
        }
      }
    }

    // Enter key sends without newline
    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuery();
      }
    });

    // Voice recognition (Speech-to-Text on mobile browser)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecording = true;
        btnMic.classList.add('recording');
        btnMic.innerHTML = '<span>🔴 Stop</span>';
        showToast('Listening on phone mic...');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        queryInput.value = transcript;
      };

      recognition.onend = () => {
        isRecording = false;
        btnMic.classList.remove('recording');
        btnMic.innerHTML = '<span>🎤 Mic</span>';
        if (queryInput.value.trim().length > 3) {
          sendQuery();
        }
      };

      recognition.onerror = () => {
        isRecording = false;
        btnMic.classList.remove('recording');
        btnMic.innerHTML = '<span>🎤 Mic</span>';
      };

      btnMic.addEventListener('click', () => {
        vibrate(30);
        if (isRecording) {
          recognition.stop();
        } else {
          queryInput.value = '';
          recognition.start();
        }
      });
    } else {
      btnMic.style.display = 'none';
    }

    // Start SSE stream
    connectSSE();
  </script>
</body>
</html>`;
}
