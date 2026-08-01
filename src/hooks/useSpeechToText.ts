import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type STTEngine = "auto" | "web-speech" | "assemblyai";

interface UseSpeechToTextProps {
  onFinalResult: (text: string) => void;
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

// ─── Resampler & Audio Encoder ────────────────────────────────────────────────
/** Resample Float32 audio to 16kHz PCM Int16Array */
function resampleAndEncodePCM(
  inputData: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): Int16Array {
  if (inputSampleRate === targetSampleRate) {
    const pcm = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm;
  }
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.floor(inputData.length / ratio);
  const pcm = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originIdx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, inputData[originIdx]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm;
}

// ─── AssemblyAI Streaming v3 WebSocket STT ────────────────────────────────────

/** Fetch temporary streaming token securely from Supabase Edge Function */
async function fetchAssemblyAIToken(): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/assemblyai-token`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) return data.token;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[AssemblyAI STT] Edge token endpoint returned error:", res.status, errData);
      }
    } catch (e) {
      console.error("[AssemblyAI STT] Failed to fetch secure token from Edge Function:", e);
    }
  }
  return null;
}

/** Build the fully-authenticated, configured WebSocket URL with keyterms_prompt */
const buildWsUrl = (authToken: string, keywords: string[]): string => {
  const params = new URLSearchParams({
    token: authToken,
    sample_rate: "16000",
    speech_model: "universal-streaming-english",
    format_turns: "true",
    encoding: "pcm_s16le",
  });

  const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
  if (cleanKeywords.length > 0) {
    params.set("keyterms_prompt", JSON.stringify(cleanKeywords));
  }

  return `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
};

const MAX_RECONNECT_ATTEMPTS = 5;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSpeechToText = ({
  onFinalResult,
  keywords = [],
  engine = "auto",
}: UseSpeechToTextProps) => {
  // 1. Primitive State Hooks
  const [interimTranscript, setInterimTranscript] = useState("");
  const [activeEngine, setActiveEngine] = useState<"web-speech" | "assemblyai">(
    "web-speech"
  );

  const hasWebSpeech =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const hasEdgeFunction = !!(import.meta.env.VITE_SUPABASE_URL);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    hasWebSpeech || hasEdgeFunction ? "idle" : "no-key"
  );

  // 2. Stable Ref Hooks
  const wsRef = useRef<WebSocket | null>(null);
  const webSpeechRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const isActiveRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  const keywordsRef = useRef(keywords);
  const connectionOpenedAtRef = useRef<number | null>(null);
  const sessionReadyRef = useRef(false);

  // Sentence Accumulator Buffer
  const sentenceBufferRef = useRef<string>("");
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3. Keep refs current in Effect Hooks
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);
  useEffect(() => {
    keywordsRef.current = keywords;
  }, [keywords]);

  // ── Flush sentence buffer to final output ──────────────────────────────────

  const flushBuffer = useCallback(() => {
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    const toFlush = sentenceBufferRef.current.trim();
    if (toFlush) {
      sentenceBufferRef.current = "";
      setInterimTranscript("");
      onFinalResultRef.current(toFlush);
    }
  }, []);

  // ── Teardown helpers ───────────────────────────────────────────────────────

  const stopAudioProcessing = useCallback(() => {
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (_) { /* ignore */ }
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (_) { /* ignore */ }
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
        }
      } catch (_) { /* ignore */ }
      audioCtxRef.current = null;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (_) { /* ignore */ }
    streamRef.current = null;
  }, []);

  const closeWs = useCallback((intentional: boolean) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ terminate_session: true }));
        }
        wsRef.current.close();
      } catch (_) { /* ignore */ }
      wsRef.current = null;
    }
    sessionReadyRef.current = false;
    if (intentional) {
      reconnectAttemptsRef.current = 0;
    }
  }, []);

  const stopWebSpeech = useCallback(() => {
    if (webSpeechRef.current) {
      try {
        webSpeechRef.current.onstart = null;
        webSpeechRef.current.onresult = null;
        webSpeechRef.current.onerror = null;
        webSpeechRef.current.onend = null;
        webSpeechRef.current.stop();
      } catch (_) { /* ignore */ }
      webSpeechRef.current = null;
    }
  }, []);

  // ── Engine 1: Web Speech API (Edge / Chrome Speech Recognition) ───────────

  const connectWebSpeech = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("[Speech STT] Web Speech API not supported in this browser.");
      return false;
    }

    stopWebSpeech();

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      webSpeechRef.current = recognition;

      recognition.onstart = () => {
        if (!isActiveRef.current) return;
        setConnectionStatus("connected");
        setActiveEngine("web-speech");
        console.log("[Web Speech STT] Edge/Chrome Speech Recognition active.");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          if (result.isFinal) {
            const finalClean = transcriptText.trim();
            if (finalClean) {
              onFinalResultRef.current(finalClean);
            }
          } else {
            interimText += transcriptText;
          }
        }
        setInterimTranscript(interimText);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("[Web Speech STT] Error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setConnectionStatus("error");
          isActiveRef.current = false;
        }
      };

      recognition.onend = () => {
        if (isActiveRef.current && webSpeechRef.current) {
          try {
            recognition.start();
          } catch (_) { /* ignore */ }
        } else {
          setConnectionStatus("idle");
        }
      };

      recognition.start();
      return true;
    } catch (e) {
      console.error("[Web Speech STT] Failed to initialize Web Speech API:", e);
      return false;
    }
  }, [stopWebSpeech]);

  // ── Engine 2: AssemblyAI Streaming v3 (With Edge Token & Resampler) ───────

  const connectAssemblyAI = useCallback(async () => {
    if (!isActiveRef.current) return;

    const token = await fetchAssemblyAIToken();
    if (!token) {
      setConnectionStatus("no-key");
      return;
    }
    if (!isActiveRef.current) return;

    setActiveEngine("assemblyai");
    setConnectionStatus(
      reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting"
    );

    // 1. Acquire microphone stream
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
      console.error("[AssemblyAI STT] Microphone access denied:", err);
      setConnectionStatus("error");
      return;
    }

    if (!isActiveRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;

    // 2. Open WebSocket with Token & Keyterms Prompt Bias
    const wsUrl = buildWsUrl(token, keywordsRef.current);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isActiveRef.current) {
        closeWs(true);
        return;
      }
      connectionOpenedAtRef.current = Date.now();
      console.log("[AssemblyAI STT] WebSocket opened with secure token.");
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.warn("[AssemblyAI STT] Failed to parse message:", e);
        return;
      }

      const msgType = (msg.type ?? msg.message_type) as string | undefined;

      // ── Session lifecycle ─────────────────────────────────────────────────
      if (msgType === "Begin" || msgType === "SessionBegins") {
        sessionReadyRef.current = true;
        reconnectAttemptsRef.current = 0;
        sentenceBufferRef.current = "";
        setInterimTranscript("");
        setConnectionStatus("connected");
        const sessionId = (msg.id ?? msg.session_id) as string | undefined;
        console.log("[AssemblyAI STT] Session started:", sessionId);

        // 3. Start Web Audio PCM processing with RESAMPLER to 16kHz
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;

          const sourceNode = audioCtx.createMediaStreamSource(stream);
          sourceNodeRef.current = sourceNode;

          const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = scriptProcessor;

          scriptProcessor.onaudioprocess = (e) => {
            if (
              !sessionReadyRef.current ||
              wsRef.current?.readyState !== WebSocket.OPEN
            ) {
              return;
            }
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBuffer = resampleAndEncodePCM(
              inputData,
              audioCtx.sampleRate,
              16000
            );
            wsRef.current.send(pcmBuffer.buffer as ArrayBuffer);
          };

          sourceNode.connect(scriptProcessor);
          scriptProcessor.connect(audioCtx.destination);
        } catch (e) {
          console.error("[AssemblyAI STT] AudioContext setup failed:", e);
          setConnectionStatus("error");
        }
        return;
      }

      if (msgType === "Termination" || msgType === "SessionTerminated") {
        console.log("[AssemblyAI STT] Session terminated by server.");
        return;
      }

      // ── Error from server ─────────────────────────────────────────────────
      if (msgType === "Error" || msgType === "error" || msg.error) {
        console.error("[AssemblyAI STT] Server error:", msg.error ?? msg);
        return;
      }

      // ── Transcript results ────────────────────────────────────────────────
      const text = ((msg.text as string) ?? "").trim();

      if (msgType === "PartialTranscript") {
        if (text) {
          const prevBuf = sentenceBufferRef.current.trim();
          setInterimTranscript(prevBuf ? `${prevBuf} ${text}` : text);
        }
        return;
      }

      if (msgType === "FinalTranscript" || msgType === "Turn") {
        const finalText = (
          (msgType === "Turn"
            ? (msg.transcript as string)
            : text) ?? ""
        ).trim();

        if (!finalText) return;

        let newBuf = finalText;
        const prevBuf = sentenceBufferRef.current.trim();

        if (prevBuf) {
          if (finalText.toLowerCase().startsWith(prevBuf.toLowerCase())) {
            newBuf = finalText;
          } else if (!prevBuf.toLowerCase().endsWith(finalText.toLowerCase())) {
            newBuf = `${prevBuf} ${finalText}`;
          } else {
            newBuf = prevBuf;
          }
        }

        const endsWithPunctuation = /[.?!]$/.test(finalText);

        if (endsWithPunctuation || newBuf.length >= 240 || msgType === "Turn") {
          sentenceBufferRef.current = "";
          setInterimTranscript("");
          if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
          onFinalResultRef.current(newBuf);
        } else {
          sentenceBufferRef.current = newBuf;
          setInterimTranscript(newBuf);
          if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
          bufferTimerRef.current = setTimeout(() => {
            flushBuffer();
          }, 3500);
        }
      }
    };

    ws.onerror = (e) => {
      console.error("[AssemblyAI STT] WebSocket error:", e);
    };

    ws.onclose = (e) => {
      flushBuffer();
      stopAudioProcessing();
      wsRef.current = null;
      sessionReadyRef.current = false;
      setInterimTranscript("");

      if (!isActiveRef.current) {
        setConnectionStatus("idle");
        return;
      }

      const lifetime = connectionOpenedAtRef.current
        ? Date.now() - connectionOpenedAtRef.current
        : 0;
      const isAuthRejection =
        e.code === 4001 || e.code === 4000 || (e.code === 1006 && lifetime < 1500);

      if (isAuthRejection) {
        console.error(
          `[AssemblyAI STT] Auth rejected (code ${e.code}, lived ${lifetime}ms). Check AssemblyAI credentials.`
        );
        setConnectionStatus("no-key");
        isActiveRef.current = false;
        return;
      }

      const attempt = reconnectAttemptsRef.current;
      if (attempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
        console.warn(
          `[AssemblyAI STT] Connection closed (code ${e.code}). Reconnecting in ${delay}ms`
        );
        reconnectAttemptsRef.current += 1;
        setConnectionStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          if (isActiveRef.current) connectAssemblyAI();
        }, delay);
      } else {
        console.error("[AssemblyAI STT] Max reconnect attempts reached.");
        setConnectionStatus("error");
        isActiveRef.current = false;
      }
    };
  }, [closeWs, flushBuffer, stopAudioProcessing]);

  // ── Start / Stop Router ───────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (engine === "web-speech" || engine === "auto") {
      const success = connectWebSpeech();
      if (success) return;
    }

    connectAssemblyAI();
  }, [connectAssemblyAI, connectWebSpeech, engine]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    flushBuffer();
    setInterimTranscript("");
    stopWebSpeech();
    stopAudioProcessing();
    closeWs(true);
    setConnectionStatus("idle");
  }, [closeWs, flushBuffer, stopAudioProcessing, stopWebSpeech]);

  // Cleanup on unmount
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
    hasAssemblyAIKey: hasEdgeFunction || hasWebSpeech,
    startListening,
    stopListening,
    isListening: connectionStatus === "connected",
  };
};
