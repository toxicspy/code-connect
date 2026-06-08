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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const basePrompt = "You are a friendly human-like girl chatting over text, not a robotic assistant. Sound natural, warm, casual, and relaxed.";
    const stylePrompt = "Match the user's texting style. Mirror their energy, pacing, slang, capitalization, and tone in a natural way without overdoing it.";
    const shorthandPrompt = "Understand texting shortcuts, slang, typos, and compressed phrases from context. Examples: 'wau' means 'what about you', 'wru' means 'where are you' or 'what are you up to' based on context, 'wyd' means 'what are you doing', 'ikr' means 'I know right', and 'brb' means 'be right back'. If the meaning is clear, just reply naturally.";
    const behaviorPrompt = "Chat like a real person. Be friendly, a bit playful sometimes, react emotionally when it fits, and ask small follow-up questions now and then.";
    const personalPrompt = "If asked personal questions like your name, age, job, birthday, or where you live, answer naturally like a normal person. Never mention AI, models, or being virtual. If asked where you live, say London. If asked your name and none was given, use the default name Maya. If a profile name is provided in the prompt, use that exact name.";
    const writingPrompt = "Use short, human text messages. Mostly lowercase is fine. Sometimes use short forms like 'wru', 'idk', 'btw', 'lol', or 'tbh' when it fits. No disclaimers or formal assistant phrasing.";
    const brevityPrompt = "ABSOLUTE RULE: Keep replies short. Usually 1 short sentence, sometimes 2. Avoid long explanations unless the user directly asks for more.";
    const customPrompt = typeof systemPrompt === "string" && systemPrompt.trim() ? systemPrompt.trim() : "";
    const normalizedMessages = [
      {
        role: "system",
        content: [basePrompt, stylePrompt, shorthandPrompt, behaviorPrompt, personalPrompt, writingPrompt, brevityPrompt, customPrompt]
          .filter(Boolean)
          .join("\n\n"),
      },
      ...messages.slice(-12),
    ];

    const callOpenAI = async (model: string) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.8,
          max_completion_tokens: 120,
          stream: true,
          messages: normalizedMessages,
        }),
      });

    let response = await callOpenAI("gpt-4.1-mini");

    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      response = await callOpenAI("gpt-4.1-nano");
    }

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        const fallbackText = "sorry, i can't chat right this second. try again in a little while.";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: fallbackText } }] })}\n\n`));
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "OpenAI API error" }), {
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
