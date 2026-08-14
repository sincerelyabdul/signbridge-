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
 * In-House Direct Gemini API Orchestrator (Client / App-Level Execution)
 */
export async function callDirectGeminiAPI(prompt: string, apiKey?: string, isJson: boolean = false): Promise<string | null> {
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];

  for (const model of candidateModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              ...(isJson ? { responseMimeType: "application/json" } : {}),
            },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (_) {
      // try next model
    }
  }
  return null;
}

/**
 * Retrieves configured Gemini API Key (User Settings > Environment Variable)
 */
export function getInHouseGeminiKey(): string | null {
  if (typeof window !== "undefined") {
    const userKey = localStorage.getItem("sb_user_gemini_key");
    if (userKey && userKey.trim().length > 10) return userKey.trim();
  }
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return envKey && envKey.trim().length > 10 ? envKey.trim() : null;
}

/**
 * Extracts key course vocabulary & definitions from lecture notes using In-House Hybrid Architecture.
 */
export async function parseLecturePrimer(
  primerText: string,
  lectureTitle: string
): Promise<{ extractedVocab: CustomTerm[]; summaryPrimer: string }> {
  const cleanPrimer = primerText.trim();
  if (!cleanPrimer) {
    return { extractedVocab: [], summaryPrimer: "" };
  }

  // ── TIER 1: In-House Direct Gemini AI (App-Layer Execution) ─────────────────
  const directApiKey = getInHouseGeminiKey();
  if (directApiKey) {
    const prompt = `You are an educational AI assistant. Extract 4 to 8 key technical terms and definitions for the lecture topic "${lectureTitle}".
CRITICAL: Return ONLY a JSON array of objects with keys "keyword", "definition", "details", "aliases".

Document Text:
"""
${cleanPrimer.slice(0, 3000)}
"""`;
    const directResult = await callDirectGeminiAPI(prompt, directApiKey, true);
    if (directResult) {
      try {
        const parsed = JSON.parse(directResult);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const extractedVocab: CustomTerm[] = parsed
            .map((item: any) => ({
              keyword: String(item.keyword || "").trim(),
              definition: String(item.definition || "").trim(),
              details: String(item.details || `Concept for ${lectureTitle}`).trim(),
              aliases: item.aliases ? String(item.aliases).trim() : undefined,
            }))
            .filter((v) => v.keyword.length > 0 && v.definition.length > 0);

          if (extractedVocab.length > 0) {
            return { extractedVocab, summaryPrimer: cleanPrimer.slice(0, 150) };
          }
        }
      } catch (_) {}
    }
  }

  // ── TIER 2: Intelligent Local NLP & Heuristic Parser Fallback ───────────────
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
 * Generates an AI summary for a completed lecture session using In-House Hybrid Architecture.
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

  const topicName = title || "Lecture Session";
  const fullTranscript = cleanTranscript.map((t) => `- ${t.text}`).join("\n");
  const cardsText = conceptCards.length > 0
    ? conceptCards.map((c) => `- ${c.concept}: ${c.definition}`).join("\n")
    : "None.";

  // ── TIER 1: In-House Direct Gemini AI (App-Layer Execution) ─────────────────
  const directApiKey = getInHouseGeminiKey();
  if (directApiKey) {
    const prompt = `You are an expert educational assistant for a live classroom platform.
Generate a comprehensive, beautifully structured lecture review summary for the session: "${topicName}".

Live Spoken Transcript:
"""
${fullTranscript.slice(0, 5000)}
"""

Key Course Concepts Triggered:
"""
${cardsText}
"""

Format your response in clean, professional Markdown with these exact sections:
# Lecture Executive Summary
Provide a 2-3 sentence overview of what was taught.

## Key Concepts & Takeaways
List 3-5 major takeaways or key definitions.

## Main Topics Covered
Group the discussion into clear, bulleted sub-topics.

## Student Study & Review Recommendations
Provide 2-3 actionable study recommendations for students reviewing this lecture.`;

    const directSummary = await callDirectGeminiAPI(prompt, directApiKey, false);
    if (directSummary && directSummary.length > 20) {
      return directSummary;
    }
  }

  // ── TIER 2: Local Structured Summary Fallback ───────────────────────────────
  const fullTranscriptText = cleanTranscript.map((t) => t.text).join(" ");
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
"${fullTranscriptText.slice(0, 300)}${fullTranscriptText.length > 300 ? "..." : ""}"`;
}

