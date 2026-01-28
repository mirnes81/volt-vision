import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supported languages with their display names and codes
const SUPPORTED_LANGUAGES: Record<string, { name: string; code: string }> = {
  fr: { name: "Français", code: "fr" },
  en: { name: "English", code: "en" },
  de: { name: "Deutsch", code: "de" },
  it: { name: "Italiano", code: "it" },
  es: { name: "Español", code: "es" },
  pt: { name: "Português", code: "pt" },
  auto: { name: "Auto-detect", code: "auto" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType, targetLanguage = "fr", sourceLanguage = "auto" } = await req.json();

    if (!audioBase64) {
      throw new Error("No audio data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the system prompt based on language preferences
    const targetLangName = SUPPORTED_LANGUAGES[targetLanguage]?.name || "Français";
    const sourceLangInfo = sourceLanguage === "auto" 
      ? "Détecte automatiquement la langue parlée."
      : `La langue source est: ${SUPPORTED_LANGUAGES[sourceLanguage]?.name || sourceLanguage}`;

    const systemPrompt = `Tu es un assistant de transcription audio professionnel multilingue. Ta tâche est de:
1. Écouter l'audio et transcrire EXACTEMENT ce qui est dit
2. ${sourceLangInfo}
3. Traduis et écris le résultat final en ${targetLangName} avec une grammaire et orthographe correctes
4. Corrige automatiquement la grammaire et la ponctuation
5. Ne rajoute AUCUN commentaire, SEULEMENT le texte transcrit
6. Si l'audio est inaudible ou vide, réponds simplement: "[Audio inaudible]"
7. Si tu détectes plusieurs locuteurs, sépare leurs interventions par des retours à la ligne`;

    // Use Gemini model which supports audio input
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Transcris cet audio et traduis-le en ${targetLangName}:`
              },
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: mimeType?.includes("webm") ? "webm" : "wav"
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédit épuisé, veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content || "[Transcription impossible]";

    return new Response(JSON.stringify({ 
      text: transcription.trim(),
      targetLanguage,
      sourceLanguage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Transcription error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});