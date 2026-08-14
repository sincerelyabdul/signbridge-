/**
 * Deepgram Synchronous Speech-to-Text Service
 *
 * Transcribes short audio files or blobs synchronously via Deepgram REST API (/v1/listen)
 * using high-precision Nova-2 model.
 */

import { getDeepgramKey } from "../hooks/useSpeechToText";

interface SyncTranscribeOptions {
  audioBlob: Blob;
  languageCode?: string;
  keywords?: string[];
}

interface SyncTranscribeResponse {
  text: string;
  confidence?: number;
  words?: Array<{ text: string; start: number; end: number; confidence: number }>;
  error?: string;
}

/**
 * Transcribe a short audio Blob synchronously using Deepgram REST API endpoint
 */
export async function transcribeShortAudioSync({
  audioBlob,
  languageCode = "en",
  keywords = [],
}: SyncTranscribeOptions): Promise<SyncTranscribeResponse> {
  const apiKey = getDeepgramKey();

  if (!apiKey) {
    return {
      text: "",
      error: "Speech Engine API Key not configured.",
    };
  }

  try {
    let url = `https://api.deepgram.com/v1/listen?model=nova-2&smart_formatting=true&punctuate=true&language=${encodeURIComponent(languageCode)}`;
    if (keywords.length > 0) {
      keywords.forEach((kw) => {
        const clean = kw.trim();
        if (clean) url += `&keywords=${encodeURIComponent(clean)}:2`;
      });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audioBlob.type || "audio/wav",
      },
      body: audioBlob,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        text: "",
        error: errJson.reason || errJson.error || `Speech transcription failed with status ${res.status}`,
      };
    }

    const data = await res.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence;
    const words = data.results?.channels?.[0]?.alternatives?.[0]?.words?.map((w: any) => ({
      text: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
    }));

    return {
      text: transcript.trim(),
      confidence,
      words,
    };
  } catch (e: any) {
    console.error("[Deepgram Sync STT] Error during transcription:", e);
    return {
      text: "",
      error: e.message || "Network error during speech transcription",
    };
  }
}
