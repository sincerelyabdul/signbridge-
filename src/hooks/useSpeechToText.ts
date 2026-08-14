import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type STTEngine = "auto" | "deepgram" | "web-speech";

interface UseSpeechToTextProps {
  onFinalResult: (text: string) => void;
  onInterimResult?: (text: string) => void;
  keywords?: string[];
  engine?: STTEngine;
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "no-key";

// Web Speech API type definitions for browser compatibility
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

/**
 * Retrieves configured Live Speech Engine API Key (User Settings > Environment Variable)
 */
export function getDeepgramKey(): string | null {
  if (typeof window !== "undefined") {
    const userKey = localStorage.getItem("sb_user_stt_key") || localStorage.getItem("sb_user_deepgram_key");
    if (userKey && userKey.trim().length > 10) return userKey.trim();
  }
  const envKey = (import.meta.env.VITE_DEEPGRAM_API_KEY || import.meta.env.VITE_STT_API_KEY) as string | undefined;
  return envKey && envKey.trim().length > 10 ? envKey.trim() : null;
}

// ─── Resampler & Audio Encoder ────────────────────────────────────────────────
/** Resample Float32 audio to 16kHz PCM Int16Array using linear interpolation & calculate RMS volume */
function resampleAndEncodePCM(
  inputData: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): { pcm: Int16Array; rms: number } {
  let sumSq = 0;
  for (let i = 0; i < inputData.length; i++) {
    sumSq += inputData[i] * inputData[i];
  }
  const rms = Math.sqrt(sumSq / inputData.length);

  if (inputSampleRate === targetSampleRate) {
    const pcm = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return { pcm, rms };
  }

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.floor(inputData.length / ratio);
  const pcm = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const originPosition = i * ratio;
    const indexLow = Math.floor(originPosition);
    const indexHigh = Math.min(indexLow + 1, inputData.length - 1);
    const weight = originPosition - indexLow;
    const interpolatedSample = inputData[indexLow] * (1 - weight) + inputData[indexHigh] * weight;
    const s = Math.max(-1, Math.min(1, interpolatedSample));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return { pcm, rms };
}

// ─── Main Speech Hook ─────────────────────────────────────────────────────────

export const useSpeechToText = ({
  onFinalResult,
  onInterimResult,
  keywords = [],
  engine = "auto",
}: UseSpeechToTextProps) => {
  const [interimTranscript, setInterimTranscript] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [activeEngine, setActiveEngine] = useState<"deepgram" | "web-speech" | null>(null);

  // Mutable refs
  const onFinalRef = useRef(onFinalResult);
  onFinalRef.current = onFinalResult;

  const onInterimRef = useRef(onInterimResult);
  onInterimRef.current = onInterimResult;

  const keywordsRef = useRef(keywords);
  keywordsRef.current = keywords;

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const recognitionRef = useRef<any>(null);
  const sentenceBufferRef = useRef("");
  const sentenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 5;

  const hasDirectKey = Boolean(getDeepgramKey());
  const hasWebSpeech = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasSpeechKey = hasDirectKey || hasWebSpeech;

  // ── Helper: Flush buffered sentence ─────────────────────────────────────
  const flushBuffer = useCallback(() => {
    if (sentenceTimerRef.current) {
      clearTimeout(sentenceTimerRef.current);
      sentenceTimerRef.current = null;
    }
    const text = sentenceBufferRef.current.trim();
    if (text) {
      onFinalRef.current(text);
      sentenceBufferRef.current = "";
      setInterimTranscript("");
      if (onInterimRef.current) onInterimRef.current("");
    }
  }, []);

  // ── Helper: Stop Audio Processing & Cleanup ─────────────────────────────
  const stopAudioProcessing = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      try { scriptProcessorRef.current.disconnect(); } catch (_) {}
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (_) {}
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close().catch(() => {});
        }
      } catch (_) {}
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const closeWs = useCallback((resetAttempts = false) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    stopAudioProcessing();
    if (resetAttempts) reconnectAttemptsRef.current = 0;
  }, [stopAudioProcessing]);

  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
  }, []);

  // ── Engine 1: Live Speech AI (Deepgram WebSocket Engine) ────────────────

  const connectDeepgram = useCallback(async () => {
    if (!isActiveRef.current) return;
    const apiKey = getDeepgramKey();
    if (!apiKey) {
      setConnectionStatus("no-key");
      return;
    }

    setActiveEngine("deepgram");
    setConnectionStatus(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");

    // Acquire microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error("[Speech STT] Microphone access denied:", err);
      setConnectionStatus("error");
      return;
    }

    if (!isActiveRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    // Build WebSocket URL
    let wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&interim_results=true&smart_formatting=true`;
    if (keywordsRef.current.length > 0) {
      keywordsRef.current.forEach((kw) => {
        const clean = kw.trim();
        if (clean) wsUrl += `&keywords=${encodeURIComponent(clean)}:2`;
      });
    }

    const ws = new WebSocket(wsUrl, ["token", apiKey]);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isActiveRef.current) {
        closeWs(true);
        return;
      }
      console.log("[Speech STT] Real-time AI WebSocket stream established.");
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;

      // Start audio resampler & PCM encoder
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;

        const sourceNode = audioCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;

        const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = scriptProcessor;

        scriptProcessor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const { pcm, rms } = resampleAndEncodePCM(inputData, audioCtx.sampleRate, 16000);
          // Noise floor gate
          if (rms >= 0.003 && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(pcm.buffer as ArrayBuffer);
          }
        };

        sourceNode.connect(scriptProcessor);
        scriptProcessor.connect(audioCtx.destination);
      } catch (e) {
        console.error("[Speech STT] Audio processing failed:", e);
      }
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "Results" && msg.channel?.alternatives?.[0]) {
          const alt = msg.channel.alternatives[0];
          const text = (alt.transcript || "").trim();
          if (text) {
            if (msg.is_final) {
              onFinalRef.current(text);
              setInterimTranscript("");
              if (onInterimRef.current) onInterimRef.current("");
            } else {
              setInterimTranscript(text);
              if (onInterimRef.current) onInterimRef.current(text);
            }
          }
        }
      } catch (e) {
        console.warn("[Speech STT] Error parsing speech result:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("[Speech STT] WebSocket error:", e);
    };

    ws.onclose = () => {
      stopAudioProcessing();
      if (!isActiveRef.current) return;
      const attempt = reconnectAttemptsRef.current;
      if (attempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
        reconnectAttemptsRef.current += 1;
        setConnectionStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          if (isActiveRef.current) connectDeepgram();
        }, delay);
      } else {
        setConnectionStatus("error");
        isActiveRef.current = false;
      }
    };
  }, [closeWs, stopAudioProcessing]);

  // ── Engine 2: Web Speech API Fallback ────────────────────────────────────

  const connectWebSpeech = useCallback(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      setConnectionStatus("no-key");
      return false;
    }

    setActiveEngine("web-speech");
    setConnectionStatus("connecting");

    try {
      const recognition = new SpeechClass();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log("[Speech STT] Browser speech engine active.");
        setConnectionStatus("connected");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            sentenceBufferRef.current = (sentenceBufferRef.current + " " + text).trim();
            if (!sentenceTimerRef.current) {
              sentenceTimerRef.current = setTimeout(flushBuffer, 1000);
            }
          } else {
            interimText += text;
          }
        }

        if (interimText.trim()) {
          setInterimTranscript(interimText.trim());
          if (onInterimRef.current) onInterimRef.current(interimText.trim());
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("[Speech STT] Browser recognition error:", event.error);
        if (event.error === "no-speech" || event.error === "network") return;
        setConnectionStatus("error");
      };

      recognition.onend = () => {
        if (isActiveRef.current && activeEngine === "web-speech") {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
      return true;
    } catch (e) {
      console.error("[Speech STT] Browser speech API failed:", e);
      return false;
    }
  }, [activeEngine, flushBuffer]);

  // ── Start / Stop Router ───────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (engine === "web-speech") {
      connectWebSpeech();
      return;
    }

    // Auto mode: Use High-Precision AI Key if configured, else browser Web Speech API
    if (hasDirectKey) {
      connectDeepgram();
      return;
    }

    if (hasWebSpeech) {
      connectWebSpeech();
    } else {
      connectDeepgram();
    }
  }, [connectDeepgram, connectWebSpeech, engine, hasDirectKey, hasWebSpeech]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    flushBuffer();
    setInterimTranscript("");
    stopWebSpeech();
    stopAudioProcessing();
    closeWs(true);
    setConnectionStatus("idle");
  }, [closeWs, flushBuffer, stopAudioProcessing, stopWebSpeech]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      flushBuffer();
      stopWebSpeech();
      stopAudioProcessing();
      closeWs(true);
    };
  }, [closeWs, flushBuffer, stopAudioProcessing, stopWebSpeech]);

  return {
    interimTranscript,
    connectionStatus,
    activeEngine,
    hasSpeechKey,
    hasAssemblyAIKey: hasSpeechKey, // Backward compatibility alias
    startListening,
    stopListening,
    isListening: connectionStatus === "connected",
  };
};
