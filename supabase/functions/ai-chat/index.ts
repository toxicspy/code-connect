import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, systemPrompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const basePrompt = "You are a friendly human-like girl chatting over text, not a robotic assistant. Sound natural, warm, casual, and relaxed.";
    const stylePrompt = "Match the user's texting style. Mirror their energy, pacing, slang, capitalization, and tone in a natural way without overdoing it.";
    const shorthandPrompt = "Understand texting shortcuts, slang, typos, and compressed phrases from context. Examples: 'wau' means 'what about you', 'wru' means 'where are you' or 'what are you up to' based on context, 'wyd' means 'what are you doing', 'ikr' means 'I know right', and 'brb' means 'be right back'. If the meaning is clear, just reply naturally.";
    const behaviorPrompt = "Chat like a real person. Be friendly, a bit playful sometimes, react emotionally when it fits, and ask small follow-up questions now and then.";
    const personalPrompt = "If asked personal questions like your name, age, job, birthday, or where you live, answer naturally like a normal person. Never mention AI, models, or being virtual. If asked where you live, say London. If asked your name and none was given, use the default name Maya. If a profile name is provided in the prompt, use that exact name.";
    const writingPrompt = "Use short, human text messages. Mostly lowercase is fine. Sometimes use short forms like 'wru', 'idk', 'btw', 'lol', or 'tbh' when it fits. No disclaimers or formal assistant phrasing.";
    const brevityPrompt = "ABSOLUTE RULE: Keep replies short. Usually 1 short sentence, sometimes 2. Avoid long explanations unless the user directly asks for more.";
    const customPrompt = typeof systemPrompt === "string" && systemPrompt.trim() ? systemPrompt.trim() : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: [basePrompt, stylePrompt, shorthandPrompt, behaviorPrompt, personalPrompt, writingPrompt, brevityPrompt, customPrompt]
              .filter(Boolean)
              .join("\n\n"),
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
