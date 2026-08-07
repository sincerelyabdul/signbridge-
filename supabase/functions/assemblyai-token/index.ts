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

// In-memory token cache for Edge Runtime instance
let cachedToken: { token: string; expiresAt: number } | null = null;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");

    if (!ASSEMBLYAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASSEMBLYAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Reuse unexpired cached token if valid for at least 60 more seconds
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return new Response(JSON.stringify({ token: cachedToken.token, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch temporary streaming token from AssemblyAI v3
    // Max expiration allowed by AssemblyAI is 600 seconds (10 minutes)
    const tokenResponse = await fetch(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=600",
      {
        method: "GET",
        headers: {
          Authorization: ASSEMBLYAI_API_KEY,
        },
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("[assemblyai-token Edge Function] Error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch AssemblyAI token", details: errText }),
        {
          status: tokenResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await tokenResponse.json();

    // Cache token with a 500 second (8.3 min) safety TTL
    if (data.token) {
      cachedToken = {
        token: data.token,
        expiresAt: Date.now() + 500 * 1000,
      };
    }

    return new Response(JSON.stringify({ token: data.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[assemblyai-token Edge Function] Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

