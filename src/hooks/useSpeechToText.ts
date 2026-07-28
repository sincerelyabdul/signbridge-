import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSpeechToTextProps {
  onFinalResult: (text: string) => void;
  keywords?: string[];
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error" | "no-key";

// ─── Deepgram WebSocket STT ───────────────────────────────────────────────────
// Optimized for educational classrooms & lectures:
//   • endpointing=2500ms + sentence buffering → prevents cutting sentences during lecturer pauses
//   • keywords boosting → passes session vocabulary to Deepgram Nova-3 model for high accuracy
//   • smart_format + punctuate → accurate capitalization, numbers, and grammar formatting
//   • Exponential backoff auto-reconnect on WebSocket disconnects

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY as string | undefined;

const buildWsUrl = (keywords?: string[]) => {
  let url =
    `wss://api.deepgram.com/v1/listen?` +
    `model=nova-3` +
    `&language=en` +
    `&punctuate=true` +
    `&smart_format=true` +
    `&interim_results=true` +
    `&endpointing=2500` +
    `&utterance_end_ms=2500` +
    `&vad_events=true` +
    `&filler_words=false`;

  if (keywords && keywords.length > 0) {
    keywords.forEach((kw) => {
      const cleanKw = kw.trim();
      if (cleanKw) {
        url += `&keywords=${encodeURIComponent(cleanKw)}:2`;
      }
    });
  }

  return url;
};

const getSupportedMimeType = () => {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
};

const CHUNK_INTERVAL_MS = 200; // send audio chunks every 200 ms
const MAX_RECONNECT_ATTEMPTS = 5;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSpeechToText = ({ onFinalResult, keywords = [] }: UseSpeechToTextProps) => {
  const [interimTranscript, setInterimTranscript] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    DEEPGRAM_API_KEY ? "idle" : "no-key"
  );

  // Stable refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isActiveRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  const keywordsRef = useRef(keywords);
  // Track when the WS was opened to detect immediate closes (auth rejections)
  const connectionOpenedAtRef = useRef<number | null>(null);

  // Sentence Accumulator Buffer — prevents cutting mid-sentence pauses
  const sentenceBufferRef = useRef<string>("");
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs current
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    keywordsRef.current = keywords;
  }, [keywords]);

  // Helper to flush sentence buffer to final output
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

  // ── Teardown helpers ────────────────────────────────────────────────────────

  const stopRecorder = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (_) { /* ignore */ }
    mediaRecorderRef.current = null;

    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
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
          wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        }
        wsRef.current.close();
      } catch (_) { /* ignore */ }
      wsRef.current = null;
    }
    if (intentional) {
      reconnectAttemptsRef.current = 0;
    }
  }, []);

  // ── Connect to Deepgram ─────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!DEEPGRAM_API_KEY) return;
    if (!isActiveRef.current) return;

    setConnectionStatus(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");

    // 1. Get high quality microphone stream
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
    } catch (err) {
      console.error("[Deepgram STT] Microphone access denied:", err);
      setConnectionStatus("error");
      return;
    }

    if (!isActiveRef.current) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    streamRef.current = stream;

    // 2. Open Deepgram WebSocket with custom keywords & endpointing parameters
    const wsUrl = buildWsUrl(keywordsRef.current);
    const ws = new WebSocket(wsUrl, ["token", DEEPGRAM_API_KEY]);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isActiveRef.current) {
        closeWs(true);
        return;
      }
      connectionOpenedAtRef.current = Date.now();
      reconnectAttemptsRef.current = 0;
      setConnectionStatus("connected");
      sentenceBufferRef.current = "";
      setInterimTranscript("");

      // 3. Start MediaRecorder with Opus audio stream
      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (
          e.data.size > 0 &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          wsRef.current.send(e.data);
        }
      };

      recorder.onerror = (e) => {
        console.error("[Deepgram STT] MediaRecorder error:", e);
      };

      recorder.start(CHUNK_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = JSON.parse(event.data);
        const msgType = msg.type;

        if (msgType === "Results") {
          const alt = msg.channel?.alternatives?.[0];
          if (!alt) return;
          const text: string = alt.transcript?.trim() ?? "";
          if (!text) return;

          const isFinal = msg.is_final;
          const speechFinal = msg.speech_final;

          if (isFinal) {
            let newBuf = text;
            const prevBuf = sentenceBufferRef.current.trim();

            if (prevBuf) {
              if (text.toLowerCase().startsWith(prevBuf.toLowerCase())) {
                newBuf = text;
              } else if (!prevBuf.toLowerCase().endsWith(text.toLowerCase())) {
                newBuf = `${prevBuf} ${text}`;
              } else {
                newBuf = prevBuf;
              }
            }

            const endsWithPunctuation = /[.?!]$/.test(text);

            if (speechFinal || endsWithPunctuation || newBuf.length >= 140) {
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
              }, 2500);
            }
          } else {
            const prevBuf = sentenceBufferRef.current.trim();
            const fullDraft = prevBuf ? `${prevBuf} ${text}` : text;
            setInterimTranscript(fullDraft);
          }
        } else if (msgType === "UtteranceEnd") {
          flushBuffer();
        } else if (msgType === "SpeechStarted") {
          // Keep building current sentence buffer
        }
      } catch (e) {
        console.warn("[Deepgram STT] Failed to parse message:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("[Deepgram STT] WebSocket error:", e);
    };

    ws.onclose = (e) => {
      flushBuffer();
      stopRecorder();
      wsRef.current = null;
      setInterimTranscript("");

      if (!isActiveRef.current) {
        setConnectionStatus("idle");
        return;
      }

      // Detect immediate closes: if the connection lived < 2500ms and closed
      // with code 1000, Deepgram rejected it (bad/missing API key). No point
      // retrying — it will fail the same way every time.
      const lifetime = connectionOpenedAtRef.current
        ? Date.now() - connectionOpenedAtRef.current
        : 0;
      const isImmediateClose = e.code === 1000 && lifetime < 2500;

      if (isImmediateClose) {
        console.error(
          `[Deepgram STT] Connection rejected immediately (code ${e.code}, lived ${lifetime}ms). ` +
          `Check that VITE_DEEPGRAM_API_KEY is set and valid. Stopping retries.`
        );
        setConnectionStatus("no-key");
        isActiveRef.current = false;
        return;
      }

      const attempt = reconnectAttemptsRef.current;
      if (attempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
        console.warn(`[Deepgram STT] Connection closed (code ${e.code}). Reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectAttemptsRef.current += 1;
        setConnectionStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          if (isActiveRef.current) connect();
        }, delay);
      } else {
        console.error("[Deepgram STT] Max reconnect attempts reached.");
        setConnectionStatus("error");
        isActiveRef.current = false;
      }
    };
  }, [closeWs, flushBuffer, stopRecorder]);

  // ── Public API ──────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (!DEEPGRAM_API_KEY) {
      console.error("[Deepgram STT] No API key found.");
      return;
    }
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    flushBuffer();
    setInterimTranscript("");
    stopRecorder();
    closeWs(true);
    setConnectionStatus("idle");
  }, [closeWs, flushBuffer, stopRecorder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      flushBuffer();
      stopRecorder();
      closeWs(true);
    };
  }, [closeWs, flushBuffer, stopRecorder]);

  return {
    interimTranscript,
    connectionStatus,
    hasDeepgramKey: !!DEEPGRAM_API_KEY,
    startListening,
    stopListening,
    isListening: connectionStatus === "connected",
  };
};
