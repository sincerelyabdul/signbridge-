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

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (apiKey && apiKey.length > 5 && !apiKey.includes("your-gemini-key")) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `You are an educational AI context assistant.
Extract key technical terms, specialized vocabulary, or concepts from the following lecture notes for the topic "${lectureTitle || "General Lecture"}".

Return ONLY a JSON array of 3 to 8 objects with this exact structure:
[
  {
    "keyword": "Term Name",
    "definition": "Clear, concise 1-sentence definition for students",
    "details": "Memorable analogy, context, or formula",
    "aliases": "Acronyms or alternative terms (optional)"
  }
]

Lecture Notes:
"""
${cleanPrimer}
"""`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed)) {
            const extractedVocab: CustomTerm[] = parsed
              .map((item: any) => ({
                keyword: String(item.keyword || "").trim(),
                definition: String(item.definition || "").trim(),
                details: String(item.details || "").trim(),
                aliases: item.aliases ? String(item.aliases).trim() : undefined,
              }))
              .filter((v) => v.keyword.length > 0 && v.definition.length > 0);

            if (extractedVocab.length > 0) {
              return {
                extractedVocab,
                summaryPrimer: cleanPrimer.slice(0, 150),
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn("Gemini API call for concept extraction failed, using fallback parser:", err);
    }
  }

  // Smart fallback parser if Gemini API call fails or offline mode
  const extractedVocab: CustomTerm[] = [];
  const lines = cleanPrimer.split("\n");
  lines.forEach((line) => {
    const parts = line.split(":");
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const d = parts.slice(1).join(":").trim();
      if (k.length > 2 && d.length > 3) {
        extractedVocab.push({
          keyword: k,
          definition: d,
          details: "Extracted from lecture primer.",
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
