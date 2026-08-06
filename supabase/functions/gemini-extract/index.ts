// Deno global type declaration for IDE type checking in non-Deno TypeScript workspace
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { mode, primerText, lectureTitle, title, transcriptLines, conceptCards } = body;

    // Diagnostic mode: query Google AI Studio for available models
    if (mode === "list_models") {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const listData = await listRes.json();
      return new Response(
        JSON.stringify({ status: listRes.status, listData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let prompt = "";

    if (mode === "summary") {
      const topicName = title || lectureTitle || "Lecture Session";
      const fullTranscript = Array.isArray(transcriptLines) && transcriptLines.length > 0
        ? transcriptLines.map((t: any) => `- ${t.text || t}`).join("\n")
        : "No live transcript recorded.";

      const cardsText = Array.isArray(conceptCards) && conceptCards.length > 0
        ? conceptCards.map((c: any) => `- ${c.concept || c.keyword}: ${c.definition}`).join("\n")
        : "None.";

      prompt = `You are an expert educational assistant for a live classroom platform.
Generate a comprehensive, beautifully structured lecture review summary for the session: "${topicName}".

Live Spoken Transcript:
"""
${fullTranscript}
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
    } else {
      // Default: concept extraction mode
      const topicName = lectureTitle || title || "General Lecture";
      const textToExtract = primerText || "";

      if (!textToExtract || typeof textToExtract !== "string") {
        return new Response(
          JSON.stringify({ error: "primerText is required for extraction mode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      prompt = `You are an educational AI context assistant for a live classroom captioning system.
Extract 4 to 8 key technical terms, domain-specific academic concepts, or specialized vocabulary from the following document for the lecture topic "${topicName}".

CRITICAL INSTRUCTIONS:
- Extract ONLY actual course concepts, technical terms, hardware/software acronyms, or academic subject matter (e.g. "Central Processing Unit (CPU)", "Arithmetic Logic Unit (ALU)", "Instruction Cycle", "RAM & ROM", "Binary Representation").
- DO NOT extract administrative section headings, document metadata, target audience descriptions, or generic action words like "Title", "Background", "Methodology", "Real", "Step", "Question", "Laptop", "Overview", "Expected Outcomes".
- Each item must have a clear, concise 1-sentence definition suitable for a student concept card.

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "keyword": "Concept Name",
    "definition": "Clear 1-sentence explanation for students",
    "details": "Context, analogy, or formula",
    "aliases": "Acronyms or shorthand (optional)"
  }
]

Document Text:
"""
${textToExtract.trim()}
"""`;
    }

    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-2.0-flash-lite",
    ];
    let response: Response | null = null;
    let lastErrText = "";
    const attemptErrors: Array<{ model: string; status: number; error: string }> = [];

    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            ...(mode === "summary" ? {} : { responseMimeType: "application/json" }),
          },
        }),
      });

      if (res.ok) {
        response = res;
        break;
      } else {
        lastErrText = await res.text();
        attemptErrors.push({ model, status: res.status, error: lastErrText });
        console.error(`[gemini-extract ERROR] Model ${model} failed (${res.status}):`, lastErrText);
      }
    }

    if (!response || !response.ok) {
      console.error("[gemini-extract CRITICAL ERROR] All Gemini models failed or rate limited:", JSON.stringify(attemptErrors));
      return new Response(
        JSON.stringify({
          error: "Gemini API rate limited or unavailable on candidate models",
          fallback: true,
          attempts: attemptErrors,
          extractedVocab: [],
          summary: "",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (mode === "summary") {
      return new Response(
        JSON.stringify({ summary: rawText || "Failed to generate summary text." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extractedVocab: any[] = [];
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          extractedVocab = parsed;
        }
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ extractedVocab }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[gemini-extract Edge Function] Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
