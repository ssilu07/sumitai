# Real-Time Stealth AI Interview Copilot (Prateek AI)

> An undetectable, floating transparent HUD desktop overlay designed for real-time meeting transcription and streaming AI-generated answers during technical interviews (Zoom, Google Meet, Microsoft Teams).

---

## 🌟 Key Features

1. **Screen-Cloaked Undetectable HUD Overlay:**
   - Employs OS-level display affinity (`win.setContentProtection(true)` -> `WDA_EXCLUDEFROMCAPTURE` on Windows 10/11 and `NSWindowSharingNone` on macOS).
   - Completely invisible during screen-sharing (Zoom, Google Meet, Microsoft Teams, Slack, Discord) and screen recordings (OBS, Snipping Tool, QuickTime).
   - Glassmorphic dark UI with dynamic mouse click-through (`win.setIgnoreMouseEvents`).
   - Panic hotkey (`Ctrl + Shift + H` / `Cmd + Shift + H`) to toggle visibility instantly.

2. **Dual-Channel Real-Time Audio Capture & Transcription:**
   - **Interviewer Channel:** Captures system loopback audio from meeting participants using low-overhead desktop audio capture.
   - **Candidate Channel:** Captures local microphone audio with acoustic echo cancellation.
   - **Real-Time Speech-to-Text:** Streams 16kHz 16-bit Mono Linear PCM directly to **Deepgram Nova-2 WebSocket API** with sub-300ms latency.
   - Labeled turn-by-turn transcript feeds: `[Interviewer]` (Cyan) and `[You]` (Emerald).

3. **Real-Time Streaming AI Generation:**
   - Powered by **Google Gemini 1.5 Flash** (or **OpenAI GPT-4o-mini**).
   - Token-by-token streaming response appears within milliseconds of question completion.
   - Tailored system prompt: produces structured, high-impact bullet points (max 3-4 bullets) with highlighted technical keywords and zero conversational filler.
   - Auto-triggers upon pause detection (`speech_final: true`) or manual trigger (`Ctrl + Enter`).

---

## 📂 Project Architecture & Hierarchy

```
prateek/
├── .env.example                     # Environment template for Deepgram & Gemini API keys
├── index.html                       # Transparent root DOM host
├── package.json                     # Dependencies & Electron/Vite build scripts
├── postcss.config.js                # Tailwind CSS postprocessor
├── tailwind.config.js               # Dark glassmorphism color palette & typography
├── tsconfig.json                    # TypeScript configuration for React frontend
├── tsconfig.electron.json           # TypeScript configuration for Electron Main & Preload
├── vite.config.ts                   # Vite + Electron build orchestration
│
├── electron/
│   ├── main.ts                      # Window setup, setContentProtection, hotkeys, IPC
│   └── preload.ts                   # Secure contextBridge API for renderer
│
├── src/
│   ├── main.tsx                     # React application root mount
│   ├── App.tsx                      # State coordinator (Audio, Deepgram, LLM)
│   ├── index.css                    # Glassmorphism, transparent body, scrollbars
│   ├── types/
│   │   └── index.ts                 # Transcripts, settings, and audio level types
│   ├── services/
│   │   ├── audioCapture.ts          # Dual-channel mic + desktop loopback & 16kHz PCM
│   │   ├── deepgramSTT.ts           # Deepgram Nova-2 dual WebSocket streaming client
│   │   └── llmService.ts            # Streaming Gemini 1.5 Flash & OpenAI SSE client
│   └── components/
│       ├── HUDOverlay.tsx           # Floating draggable HUD container
│       ├── AudioVisualizer.tsx      # Microphone & interviewer VU level meters
│       ├── TranscriptFeed.tsx       # Live dual-speaker transcription feed
│       ├── AnswerPanel.tsx          # Streaming AI answers with bullet points
│       └── SettingsModal.tsx        # Configuration modal (API keys, audio devices)
│
└── scripts/
    └── verify-protection.js         # Win32 GetWindowDisplayAffinity validation tool
```

---

## 🚀 Step-by-Step Setup Instructions

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended).
- **Deepgram API Key**: Sign up for free at [console.deepgram.com](https://console.deepgram.com/) ($200 free credit).
- **Google Gemini API Key**: Get an API key from [aistudio.google.com](https://aistudio.google.com/) (or OpenAI key from [platform.openai.com](https://platform.openai.com/)).

### 2. Installation
Clone or navigate to the project directory and install dependencies:
```bash
npm install
```

### 3. Environment Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your API credentials:
```env
VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_DEFAULT_AI_PROVIDER=gemini
```
*(Note: You can also configure or update these keys at any time directly inside the HUD UI by clicking the Settings gear icon).*

### 4. Run in Development Mode
Launch the Vite dev server and the Electron stealth window:
```bash
npm run dev
```

---

## 🎧 Audio Capture Setup (Interviewer + Candidate)

### How It Works Under the Hood
1. **Candidate Audio (Microphone):**
   - Captured through Web Audio API `navigator.mediaDevices.getUserMedia({ audio: true })`.
   - Acoustic echo cancellation and noise suppression are enabled by default so your laptop speakers do not bleed into your microphone.
2. **Interviewer Audio (System Loopback):**
   - **Windows:** Electron captures system audio loopback automatically via `desktopCapturer.getSources({ types: ['screen'] })` using Chromium's WASAPI loopback capture. This captures everything that outputs to your headphones or speakers (Zoom, Teams, Google Meet, YouTube).
   - **macOS:** Due to Apple's sandbox architecture, direct desktop loopback without virtual routing can be limited. For macOS users, install **BlackHole (2ch)** (free open-source virtual audio driver) via `brew install blackhole-2ch`. Set your meeting output to a Multi-Output Device (Headphones + BlackHole), and select "BlackHole 2ch" as the Interviewer Audio Loopback Source in the Copilot Settings.

---

## 🛡️ Screen Protection & Undetectability Deep-Dive

### Win32 & macOS Display Affinity Mechanism
When the HUD window initializes in `electron/main.ts`, it executes:
```ts
mainWindow.setContentProtection(true);
```

#### Windows Implementation:
- In Windows 10 (Version 2004, Build 19041+) and Windows 11, Chromium maps `setContentProtection(true)` to the Win32 API:
  ```c
  SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE); // 0x00000011
  ```
- **What this means:** When Zoom, Google Meet, or Microsoft Teams calls the Windows Desktop Duplication API (DDA) or `BitBlt` to capture your screen, the Desktop Window Manager (DWM) omits the Copilot window completely during compositing. The screen capture will show whatever was behind the HUD overlay as if the window does not exist.

#### macOS Implementation:
- In macOS, Electron sets:
  ```objc
  [mainWindow setSharingType:NSWindowSharingNone];
  ```
- This instructs macOS CoreGraphics and ScreenCaptureKit to exclude the window from all capture streams.

### Edge Cases & Best Practices

1. **Mouse Cursor Hover Behavior:**
   - If mouse events are captured while hovering over a transparent window, on some operating systems the cursor might flicker or show an I-beam.
   - **Solution:** We implement dynamic mouse forwarding via `mainWindow.setIgnoreMouseEvents(ignore, { forward: true })`. Mouse clicks pass cleanly through transparent areas to your underlying browser or IDE, and the cursor does not betray the overlay's presence.
2. **Keyboard Focus:**
   - In technical coding interviews, you will type in CoderPad, LeetCode, or VS Code. The HUD operates without stealing focus (`mainWindow.showInactive()`), ensuring your cursor remains active in your coding editor.
3. **Taskbar & Window Switcher Stealth:**
   - `skipTaskbar: true` is enabled by default to prevent the app icon from appearing in the Windows Taskbar or Alt+Tab switcher.
   - Can also be customized in **Settings > Stealth HUD**.
4. **Emergency Panic & Quit Shortcuts:**
   - Press **`Ctrl + Shift + H`** (or **`Cmd + Shift + H`** on macOS) to instantly hide or restore the overlay.
   - Press **`Ctrl + Shift + Q`** (or **`Cmd + Shift + Q`** on macOS) to immediately quit the application.

---

## 🧪 Testing & Validation Guide (Verify It's Truly Hidden)

Follow this step-by-step checklist to confirm that the overlay is 100% invisible on screen shares before joining an actual interview:

### Test 1: Win32 Affinity Check Script
Run the automated verification script:
```bash
node scripts/verify-protection.js
```
- **Expected Output:**
  ```text
  Process: electron (PID: 1234)
    Window Title: AI Interview Copilot HUD
    Affinity Value: 0x00000011 -> WDA_EXCLUDEFROMCAPTURE [CONFIRMED INVISIBLE TO SCREEN SHARE]
  ```

### Test 2: Windows Snipping Tool / macOS Screenshot Test
1. Position the HUD in the center of your screen over a web page.
2. Open **Windows Snipping Tool** (`Win + Shift + S`) or macOS Screenshot (`Cmd + Shift + 4`).
3. Take a screenshot of the area containing the HUD overlay.
4. **Result:** The saved screenshot will show only your background wallpaper or browser window. The HUD will be completely invisible.

### Test 3: Google Meet Self-Share Test
1. Open Google Chrome and start a personal meeting at `meet.google.com/new`.
2. Click **Share Screen** -> select **Entire Screen**.
3. Position the HUD over your shared screen.
4. Look at the Meet sharing preview tile:
   - **Result:** You will see your desktop/browser, but the HUD overlay is omitted from the stream.

### Test 4: Zoom Screen Share Test
1. Start a personal Zoom meeting.
2. Click **Share Screen** -> **Screen 1** (Entire Desktop).
3. Open Zoom's participant view on a second monitor or phone.
4. **Result:** The participant view shows your desktop; the HUD is invisible.

---

## ⌨️ Hotkeys Reference

| Hotkey | Action |
| :--- | :--- |
| **`Ctrl + Shift + H`** / **`Cmd + Shift + H`** | **Panic Toggle:** Instantly hide or restore HUD visibility |
| **`Ctrl + Shift + X`** / **`Cmd + Shift + X`** | **Click-Through:** Toggle mouse clicks passing through the window |
| **`Ctrl + Enter`** | **Manual AI Answer:** Manually generate bullet-point answer for the latest question |

---

## 📜 License
This project is open-source under the MIT License.
