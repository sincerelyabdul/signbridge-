import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ASSEMBLYAI_API_KEY =
      Deno.env.get("ASSEMBLYAI_API_KEY") ||
      Deno.env.get("VITE_ASSEMBLYAI_API_KEY") ||
      "4855b8d0e4e54751a8462938c0b445e5";

    if (!ASSEMBLYAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASSEMBLYAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
