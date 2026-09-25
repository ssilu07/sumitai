import { AudioLevels } from '../types';

export interface AudioCaptureCallbacks {
  onMicPcmChunk?: (chunk: ArrayBuffer) => void;
  onSpeakerPcmChunk?: (chunk: ArrayBuffer) => void;
  onAudioLevels?: (levels: AudioLevels) => void;
  onError?: (err: Error) => void;
}

export class DualChannelAudioCapture {
  private micStream: MediaStream | null = null;
  private speakerStream: MediaStream | null = null;
  private activeDisplayStream: MediaStream | null = null;
  private videoTracksToCleanup: MediaStreamTrack[] = [];
  private audioContext: AudioContext | null = null;

  // Analysers for VU meters / activity indicators
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;
  private levelInterval: number | null = null;

  // Voice Enhancement: Compressors and Gain Boosters for Low/Soft Voices
  private micCompressor: DynamicsCompressorNode | null = null;
  private micGain: GainNode | null = null;
  private speakerCompressor: DynamicsCompressorNode | null = null;
  private speakerGain: GainNode | null = null;
  private currentGainBoost: number = 2.0;

  // Processors for PCM conversion
  private micProcessor: ScriptProcessorNode | null = null;
  private speakerProcessor: ScriptProcessorNode | null = null;

  private isRunning = false;
  private callbacks: AudioCaptureCallbacks = {};

  constructor(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start dual-channel audio capture:
   * 1. Mic input (User/Candidate)
   * 2. Loopback desktop audio (Interviewer)
   * With automatic voice boost and compression for quiet/low voices.
   */
  async start(micDeviceId?: string, loopbackSourceId?: string, gainBoost: number = 2.0): Promise<void> {
    if (this.isRunning) return;
    this.currentGainBoost = gainBoost;

    try {
      // Create unified AudioContext. Try 16000Hz, fall back to native device rate if hardware requires
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: 16000 });
      } catch (e) {
        console.warn('[AudioCapture] AudioContext 16kHz not supported by hardware, using default rate');
        this.audioContext = new AudioCtx();
      }

      console.log('[AudioCapture] AudioContext initialized. Sample rate:', this.audioContext.sampleRate);

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 1. Capture Microphone Input (Candidate)
      await this.initMicStream(micDeviceId, gainBoost);

      // 2. Capture System Loopback (Interviewer)
      await this.initSpeakerLoopback(loopbackSourceId, gainBoost);

      // 3. Start audio metering loop
      this.startMetering();

      this.isRunning = true;
      console.log('[AudioCapture] Dual channel capture running successfully.');
    } catch (err: any) {
      console.error('[AudioCapture] Initialization error:', err);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Dynamically adjust voice boost gain on active audio context
   */
  setGainBoost(boost: number): void {
    this.currentGainBoost = boost;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      const now = this.audioContext.currentTime;
      if (this.speakerGain) {
        this.speakerGain.gain.setValueAtTime(boost, now);
      }
      if (this.micGain) {
        this.micGain.gain.setValueAtTime(boost, now);
      }
    }
  }

  getGainBoost(): number {
    return this.currentGainBoost;
  }

  /**
   * Initialize Microphone capture
   */
  private async initMicStream(deviceId?: string, gainBoost: number = 2.0): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      };

      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!this.audioContext) return;

      const source = this.audioContext.createMediaStreamSource(this.micStream);

      // Voice enhancement compressor & gain (Normalizes quiet/low candidate voice)
      this.micCompressor = this.audioContext.createDynamicsCompressor();
      this.micCompressor.threshold.setValueAtTime(-38, this.audioContext.currentTime);
      this.micCompressor.knee.setValueAtTime(12, this.audioContext.currentTime);
      this.micCompressor.ratio.setValueAtTime(6, this.audioContext.currentTime);
      this.micCompressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.micCompressor.release.setValueAtTime(0.2, this.audioContext.currentTime);

      this.micGain = this.audioContext.createGain();
      this.micGain.gain.setValueAtTime(gainBoost, this.audioContext.currentTime);

      source.connect(this.micCompressor);
      this.micCompressor.connect(this.micGain);

      // Analyser for metering
      this.micAnalyser = this.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micGain.connect(this.micAnalyser);

      // Audio Processor for 16-bit PCM conversion
      this.micProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isRunning) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBuffer = this.downsampleAndConvert(
          inputData,
          this.audioContext?.sampleRate || 16000,
          16000
        );
        this.callbacks.onMicPcmChunk?.(pcmBuffer);
      };

      this.micGain.connect(this.micProcessor);
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.micProcessor.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      console.log('[AudioCapture] Microphone with Voice Enhancement initialized successfully.');
    } catch (err: any) {
      console.warn('[AudioCapture] Mic capture warning:', err.message);
    }
  }

  /**
   * Initialize System Speaker Loopback (Interviewer voice)
   * Uses modern Electron display media handler or desktopCapturer getUserMedia.
   */
  private async initSpeakerLoopback(sourceId?: string, gainBoost: number = 2.0): Promise<void> {
    try {
      console.log('[AudioCapture] Initializing system speaker loopback, requested sourceId:', sourceId || '(auto)');

      // Strategy 0: Direct Audio Device (If user explicitly picked a specific microphone, Stereo Mix, or Virtual Cable)
      if (sourceId && !sourceId.startsWith('screen')) {
        try {
          console.log('[AudioCapture] Strategy 0: User selected dedicated loopback audio device:', sourceId);
          this.speakerStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: sourceId },
              autoGainControl: true,
              echoCancellation: false,
              noiseSuppression: false,
            },
            video: false,
          });
          console.log('[AudioCapture] Strategy 0 SUCCESS: Attached selected audio input device:', this.speakerStream.getAudioTracks()[0]?.label);
        } catch (err: any) {
          console.warn('[AudioCapture] Strategy 0 failed, falling back to system loopback:', err?.message || err);
        }
      }

      // Strategy 1: Modern Electron getDisplayMedia with main process loopback handler
      if (!this.speakerStream && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        try {
          console.log('[AudioCapture] Strategy 1: Requesting getDisplayMedia for loopback audio...');
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });

          // CRITICAL FIX: DO NOT set track.enabled = false!
          // In Chromium/Electron on Windows, setting track.enabled = false on a display video track
          // signals that the capture session is idle, which pauses/halts the loopback audio stream!
          // Instead, keep track.enabled = true, don't render the video element, and stop cleanly on teardown.
          this.activeDisplayStream = displayStream;
          displayStream.getVideoTracks().forEach((track) => {
            this.videoTracksToCleanup.push(track);
          });

          const audioTracks = displayStream.getAudioTracks();
          console.log(`[AudioCapture] Strategy 1: getDisplayMedia returned ${audioTracks.length} audio track(s).`);
          if (audioTracks.length > 0) {
            this.speakerStream = new MediaStream(audioTracks);
            console.log('[AudioCapture] Strategy 1 SUCCESS: Attached loopback track:', audioTracks[0].label);
          }
        } catch (err: any) {
          console.warn('[AudioCapture] Strategy 1 failed:', err?.message || err);
        }
      }

      // Strategy 2: Auto-detect Stereo Mix / Virtual Cable / Loopback audio device
      if (!this.speakerStream && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
        try {
          console.log('[AudioCapture] Strategy 2: Checking for available Stereo Mix or virtual loopback devices...');
          const devices = await navigator.mediaDevices.enumerateDevices();
          const loopbackDevice = devices.find(
            (d) =>
              d.kind === 'audioinput' &&
              /stereo mix|what u hear|wave out|cable output|loopback/i.test(d.label)
          );

          if (loopbackDevice) {
            console.log('[AudioCapture] Strategy 2: Found loopback audio device:', loopbackDevice.label);
            this.speakerStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: loopbackDevice.deviceId } },
              video: false,
            });
            console.log('[AudioCapture] Strategy 2 SUCCESS: Attached Stereo Mix / loopback device.');
          }
        } catch (err: any) {
          console.warn('[AudioCapture] Strategy 2 failed:', err?.message || err);
        }
      }

      // Strategy 3: Desktop loopback via getUserMedia and chromeMediaSource: 'desktop'
      if (!this.speakerStream && window.electronAPI && typeof (navigator.mediaDevices as any).getUserMedia === 'function') {
        try {
          console.log('[AudioCapture] Strategy 3: Attempting getUserMedia with desktopCapturer...');
          let selectedSourceId = sourceId;

          if (!selectedSourceId || !selectedSourceId.startsWith('screen')) {
            const sources = await window.electronAPI.getDesktopSources();
            const screenSource = sources.find((s) => s.id.startsWith('screen')) || sources[0];
            selectedSourceId = screenSource?.id;
          }

          if (selectedSourceId) {
            const stream = await (navigator.mediaDevices as any).getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                },
              },
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: selectedSourceId,
                  maxWidth: 10,
                  maxHeight: 10,
                  maxFrameRate: 1,
                },
              },
            });

            this.activeDisplayStream = stream;
            stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
              this.videoTracksToCleanup.push(track);
            });

            const audioTracks = stream.getAudioTracks();
            console.log(`[AudioCapture] Strategy 3: getUserMedia returned ${audioTracks.length} audio track(s).`);
            if (audioTracks.length > 0) {
              this.speakerStream = new MediaStream(audioTracks);
              console.log('[AudioCapture] Strategy 3 SUCCESS: Attached loopback track:', audioTracks[0].label);
            }
          }
        } catch (err: any) {
          console.warn('[AudioCapture] Strategy 3 failed:', err?.message || err);
        }
      }

      if (this.speakerStream && this.audioContext) {
        const audioTracks = this.speakerStream.getAudioTracks();
        console.log(`[AudioCapture] Attaching speakerStream with ${audioTracks.length} audio track(s) to WebAudio graph.`);

        audioTracks.forEach((track, i) => {
          track.enabled = true;
          console.log(`[AudioCapture] Speaker audio track [${i}]: label="${track.label}", readyState="${track.readyState}", muted=${track.muted}`);
          track.onmute = () => console.warn(`[AudioCapture] Speaker track [${i}] muted by OS`);
          track.onunmute = () => console.log(`[AudioCapture] Speaker track [${i}] unmuted by OS`);
          track.onended = () => console.warn(`[AudioCapture] Speaker track [${i}] ended`);
        });

        const source = this.audioContext.createMediaStreamSource(this.speakerStream);

        // Voice enhancement compressor & gain (Normalizes low/quiet interviewer voices)
        this.speakerCompressor = this.audioContext.createDynamicsCompressor();
        this.speakerCompressor.threshold.setValueAtTime(-42, this.audioContext.currentTime);
        this.speakerCompressor.knee.setValueAtTime(15, this.audioContext.currentTime);
        this.speakerCompressor.ratio.setValueAtTime(8, this.audioContext.currentTime);
        this.speakerCompressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.speakerCompressor.release.setValueAtTime(0.2, this.audioContext.currentTime);

        this.speakerGain = this.audioContext.createGain();
        this.speakerGain.gain.setValueAtTime(gainBoost, this.audioContext.currentTime);

        source.connect(this.speakerCompressor);
        this.speakerCompressor.connect(this.speakerGain);

        this.speakerAnalyser = this.audioContext.createAnalyser();
        this.speakerAnalyser.fftSize = 256;
        this.speakerGain.connect(this.speakerAnalyser);

        this.speakerProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.speakerProcessor.onaudioprocess = (e) => {
          if (!this.isRunning) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBuffer = this.downsampleAndConvert(
            inputData,
            this.audioContext?.sampleRate || 16000,
            16000
          );
          this.callbacks.onSpeakerPcmChunk?.(pcmBuffer);
        };

        this.speakerGain.connect(this.speakerProcessor);
        const muteGain = this.audioContext.createGain();
        muteGain.gain.value = 0;
        this.speakerProcessor.connect(muteGain);
        muteGain.connect(this.audioContext.destination);

        console.log('[AudioCapture] System loopback audio with Voice Enhancement initialized successfully.');
      } else {
        console.warn('[AudioCapture] System loopback audio stream could not be initialized.');
      }
    } catch (err: any) {
      console.warn('[AudioCapture] System loopback init warning:', err.message);
    }
  }

  /**
   * Convert Float32Array (-1.0 to 1.0) into 16-bit linear PCM ArrayBuffer at 16,000 Hz.
   * If input sampleRate != 16000, perform clean linear resampling down to 16000.
   */
  private downsampleAndConvert(input: Float32Array, inputRate: number, outputRate: number = 16000): ArrayBuffer {
    if (inputRate === outputRate) {
      return this.floatTo16BitPCM(input);
    }
    const ratio = inputRate / outputRate;
    const newLength = Math.round(input.length / ratio);
    const buffer = new ArrayBuffer(newLength * 2);
    const output = new DataView(buffer);
    let offsetResult = 0;
    let offsetInput = 0;

    while (offsetResult < newLength) {
      const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
        accum += input[i];
        count++;
      }
      const sample = count > 0 ? accum / count : 0;
      const s = Math.max(-1, Math.min(1, sample));
      output.setInt16(offsetResult * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offsetResult++;
      offsetInput = nextOffsetInput;
    }

    return buffer;
  }

  /**
   * Convert Float32Array (-1.0 to 1.0) into 16-bit linear PCM ArrayBuffer
   * Includes soft-limiting protection against clipping.
   */
  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const output = new DataView(buffer);
    let offset = 0;

    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = input[i];
      // Clamp signal to prevent overflow wrap-around distortion
      if (s > 1.0) s = 1.0;
      else if (s < -1.0) s = -1.0;
      // Convert float sample to 16-bit signed integer
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  /**
   * Metering interval for computing RMS audio activity.
   * Uses high-sensitivity thresholds (4%) so soft or low voices are visibly registered.
   */
  private startMetering(): void {
    const micData = new Uint8Array(128);
    const speakerData = new Uint8Array(128);

    this.levelInterval = window.setInterval(() => {
      let micLevel = 0;
      let speakerLevel = 0;

      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData);
        let sum = 0;
        for (let i = 0; i < micData.length; i++) sum += micData[i];
        micLevel = Math.min(100, Math.round((sum / micData.length / 255) * 180));
      }

      if (this.speakerAnalyser) {
        this.speakerAnalyser.getByteFrequencyData(speakerData);
        let sum = 0;
        for (let i = 0; i < speakerData.length; i++) sum += speakerData[i];
        speakerLevel = Math.min(100, Math.round((sum / speakerData.length / 255) * 180));
      }

      this.callbacks.onAudioLevels?.({
        micLevel,
        speakerLevel,
        isMicActive: micLevel > 4,
        isSpeakerActive: speakerLevel > 4,
      });
    }, 80);
  }

  /**
   * Stop audio capture and clean up all resources cleanly
   */
  stop(): void {
    this.isRunning = false;

    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }

    if (this.micGain) {
      this.micGain.disconnect();
      this.micGain = null;
    }

    if (this.micCompressor) {
      this.micCompressor.disconnect();
      this.micCompressor = null;
    }

    if (this.speakerGain) {
      this.speakerGain.disconnect();
      this.speakerGain = null;
    }

    if (this.speakerCompressor) {
      this.speakerCompressor.disconnect();
      this.speakerCompressor = null;
    }

    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }

    if (this.speakerProcessor) {
      this.speakerProcessor.disconnect();
      this.speakerProcessor = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.speakerStream) {
      this.speakerStream.getTracks().forEach((track) => track.stop());
      this.speakerStream = null;
    }

    // Cleanly stop any video tracks associated with desktop loopback capture
    if (this.activeDisplayStream) {
      try {
        this.activeDisplayStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.activeDisplayStream = null;
    }

    this.videoTracksToCleanup.forEach((track) => {
      try {
        track.stop();
      } catch (e) {}
    });
    this.videoTracksToCleanup = [];

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('[AudioCapture] Stopped all audio capture streams.');
  }

  /**
   * Captures a single image snapshot from the active display stream (if loopback screen audio capture is active)
   */
  async captureCurrentFrame(): Promise<string | null> {
    if (!this.activeDisplayStream) return null;
    const videoTrack = this.activeDisplayStream.getVideoTracks().find((t) => t.readyState === 'live');
    if (!videoTrack) return null;

    try {
      const video = document.createElement('video');
      video.srcObject = new MediaStream([videoTrack]);
      video.muted = true;
      video.playsInline = true;
      await video.play();

      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          video.onloadeddata = () => resolve();
          setTimeout(resolve, 300);
        }
      });

      // If dimensions are <= 100, this might be a minimized/dummy stream, so fallback to desktop capture
      if (video.videoWidth <= 100 || video.videoHeight <= 100) {
        video.srcObject = null;
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        video.srcObject = null;
        return null;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      video.srcObject = null;
      return (dataUrl && dataUrl.length > 100) ? dataUrl : null;
    } catch (e) {
      console.warn('[AudioCapture] Failed to grab frame from active display stream:', e);
      return null;
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Utility: Enumerate available audio input devices
 */
export async function getAvailableAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  } catch (err) {
    console.error('Failed to list audio devices:', err);
    return [];
  }
}
