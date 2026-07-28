// Gemini Intelligence Service
// Handles asynchronous processing of transcript chunks via Gemini Flash API
// Provides text correction, medical/technical keyword extraction, concept explanations, and smart lecture notes.

export interface GeminiAnalysisResult {
  corrected_text: string;
  keywords: string[];
  explanations: Array<{
    term: string;
    definition: string;
    details: string;
  }>;
  key_points: string[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/**
 * Common medical/technical terms dictionary for offline/heuristic fallback correction
 */
const DICTIONARY_FIXES: Record<string, { term: string; definition: string; details: string }> = {
  pitwitary: {
    term: "Pituitary gland",
    definition: "The master endocrine gland located at the base of the brain.",
    details: "Produces hormones that control growth, blood pressure, and function of other endocrine organs."
  },
  pituitary: {
    term: "Pituitary gland",
    definition: "The master endocrine gland located at the base of the brain.",
    details: "Produces hormones that control growth, blood pressure, and function of other endocrine organs."
  },
  thyroid: {
    term: "Thyroid gland",
    definition: "An endocrine gland located in the neck, secreting metabolic hormones.",
    details: "Secretes thyroxine (T4) and triiodothyronine (T3) which regulate body metabolism and temperature."
  },
  thyroxine: {
    term: "Thyroxine (T4)",
    definition: "The primary hormone produced by the thyroid gland.",
    details: "Plays an essential role in regulating body metabolic rate, heart function, and muscular control."
  },
  mitochondria: {
    term: "Mitochondria",
    definition: "Organelle known as the powerhouse of eukaryotic cells.",
    details: "Generates cellular adenosine triphosphate (ATP) via aerobic cellular respiration."
  },
  photosynthesis: {
    term: "Photosynthesis",
    definition: "Process by which autotrophs synthesize carbohydrates using light energy.",
    details: "Converts carbon dioxide and water into glucose and oxygen inside chloroplasts."
  },
  neuron: {
    term: "Neuron",
    definition: "Specialized nervous system cell transmitting electrical impulses.",
    details: "Composed of dendrites, a soma (cell body), and an axon protected by a myelin sheath."
  },
  homeostasis: {
    term: "Homeostasis",
    definition: "Maintenance of stable physiological conditions inside an organism.",
    details: "Regulates parameters such as body temperature, blood pH, and glucose concentration."
  }
};

/**
 * Fallback engine when VITE_GEMINI_API_KEY is not set or network fails
 */
function HeuristicFallback(chunk: string): GeminiAnalysisResult {
  let corrected = chunk.trim();

  // Basic capitalization
  if (corrected.length > 0) {
    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
  }
  if (!/[.!?]$/.test(corrected)) {
    corrected += ".";
  }

  // Common transcription typo fixes
  Object.keys(DICTIONARY_FIXES).forEach((wrong) => {
    const regex = new RegExp(`\\b${wrong}\\b`, "gi");
    const info = DICTIONARY_FIXES[wrong];
    corrected = corrected.replace(regex, info.term);
  });

  // Extract detected keywords from chunk
  const lowerChunk = chunk.toLowerCase();
  const foundKeywords: string[] = [];
  const explanations: Array<{ term: string; definition: string; details: string }> = [];

  Object.entries(DICTIONARY_FIXES).forEach(([key, info]) => {
    if (lowerChunk.includes(key) || lowerChunk.includes(info.term.toLowerCase())) {
      if (!foundKeywords.includes(info.term)) {
        foundKeywords.push(info.term);
        explanations.push({
          term: info.term,
          definition: info.definition,
          details: info.details
        });
      }
    }
  });

  // Extract potential capital phrases if none matched dictionary
  if (foundKeywords.length === 0) {
    const words = chunk.split(/\s+/);
    words.forEach((w) => {
      const clean = w.replace(/[^a-zA-Z]/g, "");
      if (clean.length >= 6 && /^[A-Z]/.test(clean)) {
        if (!foundKeywords.includes(clean)) {
          foundKeywords.push(clean);
          explanations.push({
            term: clean,
            definition: `Key technical concept referenced during the lecture.`,
            details: `Context: "${chunk}"`
          });
        }
      }
    });
  }

  const key_points = chunk.length > 20 ? [corrected] : [];

  return {
    corrected_text: corrected,
    keywords: foundKeywords,
    explanations,
    key_points
  };
}

/**
 * Process a raw transcript chunk using Gemini 1.5 / 2.5 Flash API
 */
export async function processTranscriptChunk(
  rawChunk: string,
  sessionContext?: { title?: string }
): Promise<GeminiAnalysisResult> {
  const cleanChunk = rawChunk.trim();
  if (!cleanChunk) {
    return {
      corrected_text: "",
      keywords: [],
      explanations: [],
      key_points: []
    };
  }

  if (!GEMINI_API_KEY) {
    return HeuristicFallback(cleanChunk);
  }

  const prompt = `You are an expert academic AI context assistant for real-time classroom lecture captioning.
Lecture Title Context: "${sessionContext?.title || "General Lecture"}"

Incoming Raw Live Transcript Chunk (from speech-to-text):
"${cleanChunk}"

Perform the following 4 tasks:
1. CORRECTED TEXT: Fix any speech-to-text typos, misspelled medical/scientific/technical terms, missing capitalization, and punctuation. Maintain exact intended meaning.
2. KEYWORDS: Identify 1 to 3 key medical, scientific, or technical terms mentioned in the chunk.
3. EXPLANATIONS: For each keyword, provide a 1-sentence plain-English definition and a concise explanation detailing its significance for students.
4. KEY POINTS: Write 1 clear summary bullet point capturing the essential takeaway of this speech chunk.

Respond strictly in valid raw JSON without markdown codeblock wrapper formatting:
{
  "corrected_text": "Polished corrected transcript string",
  "keywords": ["Term 1", "Term 2"],
  "explanations": [
    {
      "term": "Term 1",
      "definition": "Short 1-sentence definition",
      "details": "Detailed context and clinical/scientific significance"
    }
  ],
  "key_points": ["Key takeaway point"]
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      console.warn(`[Gemini API] Returned status ${response.status}. Using fallback heuristics.`);
      return HeuristicFallback(cleanChunk);
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return HeuristicFallback(cleanChunk);
    }

    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed: GeminiAnalysisResult = JSON.parse(cleanJson);

    return {
      corrected_text: parsed.corrected_text || cleanChunk,
      keywords: parsed.keywords || [],
      explanations: parsed.explanations || [],
      key_points: parsed.key_points || []
    };
  } catch (error) {
    console.error("[Gemini Service] Error calling Gemini API:", error);
    return HeuristicFallback(cleanChunk);
  }
}
