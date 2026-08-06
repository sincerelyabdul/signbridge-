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
 * Helper to call Gemini API directly if Supabase Edge Function is unavailable or 502
 */
async function callDirectGeminiAPI(prompt: string, apiKey: string, isJson: boolean = false): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: isJson ? { responseMimeType: "application/json" } : {},
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (_) {
    return null;
  }
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
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;
  const directGeminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${supabaseUrl}/functions/v1/gemini-extract`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ primerText: cleanPrimer, lectureTitle }),
      });
      clearTimeout(timeout);

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
      } else {
        console.info(`[geminiService] gemini-extract returned ${response.status} — using fallback generator.`);
      }
    } catch (err: any) {
      const reason = err?.name === "AbortError" ? "request timed out" : String(err);
      console.info(`[geminiService] gemini-extract unavailable (${reason}) — using fallback generator.`);
    }
  }

  // Direct client Gemini API fallback if VITE_GEMINI_API_KEY is available
  if (directGeminiKey) {
    const prompt = `Extract 4 to 8 key course terms and definitions for topic "${lectureTitle}" from this text: "${cleanPrimer.slice(0, 2000)}". Return JSON array of objects with keys "keyword", "definition", "details".`;
    const directResult = await callDirectGeminiAPI(prompt, directGeminiKey, true);
    if (directResult) {
      try {
        const parsed = JSON.parse(directResult);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const extractedVocab = parsed.map((item: any) => ({
            keyword: String(item.keyword || "").trim(),
            definition: String(item.definition || "").trim(),
            details: String(item.details || "").trim(),
          })).filter(v => v.keyword && v.definition);
          if (extractedVocab.length > 0) {
            return { extractedVocab, summaryPrimer: cleanPrimer.slice(0, 150) };
          }
        }
      } catch (_) {}
    }
  }

  // ── Intelligent Local NLP & Heuristic Parser ────────────────────────────────
  const extractedVocab: CustomTerm[] = [];
  const seenKeywords = new Set<string>();

  const stopWords = new Set([
    "title", "background", "objectives", "target audience", "methodology",
    "expected outcomes", "duration", "resources required", "facilitator",
    "conclusion", "overview", "session outline", "real", "step", "question",
    "anyone", "laptop", "projector", "whiteboard", "components", "introduction",
    "summary", "table of contents", "agenda", "prerequisites", "notes"
  ]);

  const isStopWord = (term: string) => {
    const lower = term.toLowerCase().replace(/^[0-9.\-*#\s]+/, "").trim();
    if (stopWords.has(lower)) return true;
    if (
      lower.startsWith("title") ||
      lower.startsWith("background") ||
      lower.startsWith("objectives") ||
      lower.startsWith("target audience") ||
      lower.startsWith("methodology") ||
      lower.startsWith("expected outcomes") ||
      lower.startsWith("duration") ||
      lower.startsWith("resources") ||
      lower.startsWith("facilitator") ||
      lower.startsWith("conclusion") ||
      lower.startsWith("table of")
    ) return true;
    return false;
  };

  const cleanTerm = (raw: string) => raw.replace(/^[0-9.\-*#\s]+/, "").trim();

  // Helper: Find contextual sentence for a keyword from primer text
  const findContextualSentence = (keyword: string): string => {
    const sentences = cleanPrimer.split(/(?<=[.!?])\s+|\n+/);
    const kwLower = keyword.toLowerCase();
    const match = sentences.find((s) => s.toLowerCase().includes(kwLower) && s.trim().length > 15);
    if (match) {
      return match.trim().replace(/^[\-*#\s]+/, "");
    }
    return `Core academic concept discussed in ${lectureTitle || "lecture notes"}.`;
  };

  const lines = cleanPrimer.split(/\n+/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Pattern 1: Term: Definition or Term - Definition
    const colonMatch = trimmed.match(/^([^:\-\—]+)[:\-\—]\s*(.+)$/);
    if (colonMatch) {
      let k = cleanTerm(colonMatch[1]);
      const d = colonMatch[2].trim();

      // Extract alias in parentheses if present e.g. "Central Processing Unit (CPU)"
      let alias: string | undefined = undefined;
      const parensInKey = k.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parensInKey) {
        k = parensInKey[1].trim();
        alias = parensInKey[2].trim();
      }

      if (k.length > 1 && k.length < 50 && d.length > 3 && !isStopWord(k) && !seenKeywords.has(k.toLowerCase())) {
        seenKeywords.add(k.toLowerCase());
        extractedVocab.push({
          keyword: k,
          definition: d,
          aliases: alias,
          details: `Topic concept from ${lectureTitle || "course notes"}.`,
        });
        return;
      }
    }

    // Pattern 2: Sub-bullet technical terms with parenthetical acronyms e.g. "Deoxyribonucleic Acid (DNA)"
    const termWithParensMatch = trimmed.match(/^[\-*#\s]*([A-Z][A-Za-z0-9\s]{2,40})\s*\(([A-Z0-9\s,-]{2,15})\)/);
    if (termWithParensMatch) {
      const k = cleanTerm(termWithParensMatch[1]);
      const alias = termWithParensMatch[2].trim();
      if (k.length > 2 && !isStopWord(k) && !seenKeywords.has(k.toLowerCase())) {
        seenKeywords.add(k.toLowerCase());
        const definition = findContextualSentence(k);
        extractedVocab.push({
          keyword: k,
          definition: definition,
          aliases: alias,
          details: `Technical concept (${alias}) in ${lectureTitle || "lecture"}.`,
        });
        return;
      }
    }

    // Pattern 3: "Term is/are Definition" or "Term refers to Definition"
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
        return;
      }
    }
  });

  // Pattern 4: Noun Phrase & Academic Concept Mining (Fallback if few terms extracted)
  if (extractedVocab.length < 4) {
    const conceptRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    let m: RegExpExecArray | null;
    while ((m = conceptRegex.exec(cleanPrimer)) !== null && extractedVocab.length < 8) {
      const concept = m[1].trim();
      if (concept.length > 3 && !isStopWord(concept) && !seenKeywords.has(concept.toLowerCase())) {
        seenKeywords.add(concept.toLowerCase());
        const contextualDef = findContextualSentence(concept);
        extractedVocab.push({
          keyword: concept,
          definition: contextualDef,
          details: `Extracted course concept for ${lectureTitle || "study"}.`,
        });
      }
    }
  }

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
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;
  const directGeminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${supabaseUrl}/functions/v1/gemini-extract`, {
        method: "POST",
        signal: controller.signal,
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
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.summary && data.summary.length > 20) {
          return data.summary;
        }
      } else {
        console.info(`[geminiService] gemini-extract returned ${response.status} — using local summary fallback.`);
      }
    } catch (e: any) {
      const reason = e?.name === "AbortError" ? "request timed out" : String(e);
      console.info(`[geminiService] gemini-extract failed (${reason}) — using local summary fallback.`);
    }
  }

  // Direct client Gemini API fallback if VITE_GEMINI_API_KEY is defined
  if (directGeminiKey) {
    const fullText = cleanTranscript.map(t => t.text).join("\n");
    const prompt = `Generate a structured markdown lecture summary for "${title}". Transcript:\n${fullText.slice(0, 3000)}`;
    const directResult = await callDirectGeminiAPI(prompt, directGeminiKey, false);
    if (directResult) return directResult;
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

