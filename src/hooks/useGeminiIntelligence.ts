import { useState, useRef, useCallback, useEffect } from "react";
import { processTranscriptChunk } from "../services/geminiService";
import type { GeminiAnalysisResult } from "../services/geminiService";
import type { ConceptCard, TranscriptLine } from "../context/SignBridgeContext";

interface UseGeminiIntelligenceProps {
  sessionTitle?: string;
  onAnalysisComplete: (result: {
    correctedLine: TranscriptLine;
    newConceptCards: ConceptCard[];
    keyPoints: string[];
  }) => void;
}

export type AIProcessingStatus = "idle" | "buffering" | "processing" | "updated" | "error";

export const useGeminiIntelligence = ({
  sessionTitle,
  onAnalysisComplete
}: UseGeminiIntelligenceProps) => {
  const [aiStatus, setAiStatus] = useState<AIProcessingStatus>("idle");
  const [lastProcessedTime, setLastProcessedTime] = useState<number | null>(null);

  const bufferTextRef = useRef<string>("");
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const onAnalysisCompleteRef = useRef(onAnalysisComplete);
  const sessionTitleRef = useRef(sessionTitle);

  useEffect(() => {
    onAnalysisCompleteRef.current = onAnalysisComplete;
  }, [onAnalysisComplete]);

  useEffect(() => {
    sessionTitleRef.current = sessionTitle;
  }, [sessionTitle]);

  // Flush buffer to Gemini Flash API
  const flushBuffer = useCallback(async () => {
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }

    const chunkToProcess = bufferTextRef.current.trim();
    if (!chunkToProcess || isProcessingRef.current) return;

    bufferTextRef.current = "";
    isProcessingRef.current = true;
    setAiStatus("processing");

    try {
      const result: GeminiAnalysisResult = await processTranscriptChunk(chunkToProcess, {
        title: sessionTitleRef.current
      });

      const now = Date.now();
      const correctedLine: TranscriptLine = {
        id: crypto.randomUUID(),
        text: result.corrected_text || chunkToProcess,
        timestamp: now
      };

      const newConceptCards: ConceptCard[] = (result.explanations || []).map((exp) => ({
        id: crypto.randomUUID(),
        concept: exp.term,
        definition: exp.definition,
        details: exp.details,
        timestamp: now
      }));

      onAnalysisCompleteRef.current({
        correctedLine,
        newConceptCards,
        keyPoints: result.key_points || []
      });

      setLastProcessedTime(now);
      setAiStatus("updated");
      setTimeout(() => setAiStatus("idle"), 2500);
    } catch (e) {
      console.error("[useGeminiIntelligence] Exception processing chunk:", e);
      setAiStatus("error");
      setTimeout(() => setAiStatus("idle"), 3000);
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  // Ingest raw speech line from Deepgram fast stream
  const ingestRawLine = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      if (bufferTextRef.current) {
        bufferTextRef.current += " " + clean;
      } else {
        bufferTextRef.current = clean;
      }

      setAiStatus("buffering");

      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
      }

      const currentBuffer = bufferTextRef.current;
      const endsWithSentencePunctuation = /[.!?]$/.test(clean);
      const isSubstantialLength = currentBuffer.length >= 70;

      // Trigger immediately if sentence ends & buffer has enough context, else flush after 3.2s pause
      if (endsWithSentencePunctuation || isSubstantialLength) {
        bufferTimerRef.current = setTimeout(() => {
          flushBuffer();
        }, 1200);
      } else {
        bufferTimerRef.current = setTimeout(() => {
          flushBuffer();
        }, 3200);
      }
    },
    [flushBuffer]
  );

  return {
    ingestRawLine,
    flushBuffer,
    aiStatus,
    lastProcessedTime,
    isBuffering: aiStatus === "buffering",
    isProcessing: aiStatus === "processing"
  };
};
