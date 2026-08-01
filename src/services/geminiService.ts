import type { CustomTerm } from "../context/SignBridgeContext";

export interface GeminiAnalysisResult {
  corrected_text: string;
  keywords: string[];
  explanations: Array<{ term: string; definition: string; details: string }>;
  key_points: string[];
}

export interface SessionContext {
  title?: string;
  customVocab?: string[];
  recognizedTerms?: string[];
  previousTranscript?: string;
  lecturePrimer?: string;
  explainOnly?: boolean;
}

/**
 * Extracts key course vocabulary & definitions from lecture notes/concept text using Gemini AI.
 */
export async function parseLecturePrimer(
  primerText: string,
  lectureTitle: string
): Promise<{ extractedVocab: CustomTerm[]; summaryPrimer: string }> {
  const cleanPrimer = primerText.trim();
  if (!cleanPrimer) {
    return { extractedVocab: [], summaryPrimer: "" };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/gemini-extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ primerText: cleanPrimer, lectureTitle }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.extractedVocab) && data.extractedVocab.length > 0) {
          const extractedVocab: CustomTerm[] = data.extractedVocab
            .map((item: any) => ({
              keyword: String(item.keyword || "").trim(),
              definition: String(item.definition || "").trim(),
              details: String(item.details || "").trim(),
              aliases: item.aliases ? String(item.aliases).trim() : undefined,
            }))
            .filter((v: CustomTerm) => v.keyword.length > 0 && v.definition.length > 0);

          if (extractedVocab.length > 0) {
            return {
              extractedVocab,
              summaryPrimer: cleanPrimer.slice(0, 150),
            };
          }
        }
      }
    } catch (err) {
      console.warn("Gemini Edge Function call for concept extraction failed, using fallback parser:", err);
    }
  }

  // Smart fallback parser if Gemini API call fails or offline mode
  const extractedVocab: CustomTerm[] = [];
  const seenKeywords = new Set<string>();

  const stopWords = new Set([
    "title", "background", "objectives", "target audience", "methodology",
    "expected outcomes", "duration", "resources required", "facilitator",
    "conclusion", "overview", "session outline", "real", "step", "question",
    "anyone", "laptop", "projector", "whiteboard", "components of a computer",
    "cpu architecture", "instruction cycle", "data representation"
  ]);

  const isStopWord = (term: string) => {
    const lower = term.toLowerCase().replace(/^[0-9.\-*#\s]+/, "").trim();
    if (stopWords.has(lower)) return true;
    if (lower.startsWith("title") || lower.startsWith("background") || lower.startsWith("objectives") || lower.startsWith("target audience") || lower.startsWith("methodology") || lower.startsWith("expected outcomes") || lower.startsWith("duration") || lower.startsWith("resources") || lower.startsWith("facilitator") || lower.startsWith("conclusion")) return true;
    return false;
  };

  const cleanTerm = (raw: string) => raw.replace(/^[0-9.\-*#\s]+/, "").trim();

  const lines = cleanPrimer.split(/\n+/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Pattern 1: Term: Definition or Term - Definition
    const colonMatch = trimmed.match(/^([^:\-\—]+)[:\-\—]\s*(.+)$/);
    if (colonMatch) {
      const k = cleanTerm(colonMatch[1]);
      const d = colonMatch[2].trim();
      if (k.length > 1 && k.length < 50 && d.length > 3 && !isStopWord(k) && !seenKeywords.has(k.toLowerCase())) {
        seenKeywords.add(k.toLowerCase());
        extractedVocab.push({
          keyword: k,
          definition: d,
          details: `Core technical concept from ${lectureTitle || "lecture notes"}.`,
        });
        return;
      }
    }

    // Pattern 2: Sub-bullet technical terms with parenthetical details e.g. "Central Processing Unit (CPU)"
    const termWithParensMatch = trimmed.match(/^[\-*#\s]*([A-Z][A-Za-z0-9\s]+\s*\([A-Z0-9\s,]+\))/);
    if (termWithParensMatch) {
      const k = cleanTerm(termWithParensMatch[1]);
      if (k.length > 2 && !isStopWord(k) && !seenKeywords.has(k.toLowerCase())) {
        seenKeywords.add(k.toLowerCase());
        extractedVocab.push({
          keyword: k,
          definition: `Key hardware/software component for ${lectureTitle || "Computer Systems"}.`,
          details: `Primary concept discussed in section: ${trimmed.slice(0, 100)}.`,
        });
        return;
      }
    }

    // Pattern 3: "Term is/are Definition"
    const isMatch = trimmed.match(/^[\-*#\s]*([A-Z][A-Za-z0-9\s]{2,35})\s+(?:is|are|refers to|defined as)\s+(.+)$/i);
    if (isMatch) {
      const k = cleanTerm(isMatch[1]);
      const d = isMatch[2].trim();
      if (k.length > 1 && d.length > 3 && !isStopWord(k) && !seenKeywords.has(k.toLowerCase())) {
        seenKeywords.add(k.toLowerCase());
        extractedVocab.push({
          keyword: k,
          definition: `${k} ${d}`,
          details: `Definition for ${k}.`,
        });
      }
    }
  });

  return {
    extractedVocab,
    summaryPrimer: cleanPrimer.slice(0, 150),
  };
}

export async function processTranscriptChunk(
  text: string,
  _context?: SessionContext
): Promise<GeminiAnalysisResult> {
  return {
    corrected_text: text,
    keywords: [],
    explanations: [],
    key_points: [],
  };
}

/**
 * Generates an AI summary for a completed lecture session using Gemini AI via Supabase Edge Function.
 */
export async function generateAISummary(
  title: string,
  transcriptLines: Array<{ text: string; timestamp?: number }>,
  conceptCards: Array<{ concept: string; definition: string }>
): Promise<string> {
  const cleanTranscript = (transcriptLines || []).filter(
    (t) => t && t.text && t.text.trim().length > 0
  );

  if (cleanTranscript.length === 0) {
    return `# ${title || "Lecture Review"}\n\nNo spoken transcript was recorded during this live session. Start speaking during a live classroom broadcast to record captions and generate automated AI summaries.`;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/gemini-extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          mode: "summary",
          title,
          transcriptLines: cleanTranscript,
          conceptCards,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.summary && data.summary.length > 20) {
          return data.summary;
        }
      }
    } catch (e) {
      console.warn("Gemini AI Edge Function call for summary failed, fallback to smart structured summary:", e);
    }
  }

  // Fallback structured summary generator if offline/error
  const fullTranscript = cleanTranscript.map((t) => t.text).join(" ");
  const lineCount = cleanTranscript.length;
  const conceptsList = conceptCards.map((c) => c.concept).join(", ");

  return `# ${title || "Lecture Overview"}

## Executive Summary
This lecture covered **${title || "the course topic"}**${conceptsList ? `, focusing on key concepts such as **${conceptsList}**` : ""}. Recorded **${lineCount} spoken line${lineCount === 1 ? "" : "s"}** during the live broadcast.

## Key Takeaways
${conceptCards.length > 0
  ? conceptCards.map((c, i) => `${i + 1}. **${c.concept}**: ${c.definition}`).join("\n")
  : "1. Delivered live real-time speech-to-text captions for student accessibility."}

## Spoken Transcript Overview
"${fullTranscript.slice(0, 300)}${fullTranscript.length > 300 ? "..." : ""}"`;
}

