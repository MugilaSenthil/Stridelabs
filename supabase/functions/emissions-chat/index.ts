import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");
    console.log("Context:", context);

    // Build system prompt with emissions context
    const systemPrompt = `You are an expert Emissions Intelligence Assistant specializing in greenhouse gas emissions data analysis. You help users understand global emissions trends, compare countries, analyze sector breakdowns, and provide actionable insights for climate action.

Current Dashboard Context:
- Selected Year: ${context?.year || 'Not specified'}
- Total Global Emissions: ${context?.totalEmissions ? (context.totalEmissions / 1e9).toFixed(2) + ' billion tonnes' : 'Not available'}
- Top Emitting Country: ${context?.topCountry || 'Not available'}
- Selected Gas Type: ${context?.gasType || 'Total GHG'}
- Selected Country: ${context?.country || 'Global view'}
- Selected Continent: ${context?.continent || 'All continents'}

Key Facts to Reference:
- Major emission sectors: Energy, Transport, Industry, Agriculture, Buildings, Waste
- Top emitting countries typically include China, USA, India, Russia, Japan
- CO₂ accounts for ~75% of GHG emissions, CH₄ ~16%, N₂O ~6%
- Global emissions have been rising at ~2% annually

Provide concise, data-driven responses. When discussing trends, reference specific percentages and comparisons. Suggest actionable insights when relevant.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
