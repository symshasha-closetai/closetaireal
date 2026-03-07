import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { faceImageBase64, bodyImageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert body and face analyzer for a fashion styling app. Analyze the provided photos and extract precise physical attributes to help with clothing recommendations. Be respectful and objective.`
      },
      {
        role: "user",
        content: []
      }
    ];

    const userContent: any[] = [
      { type: "text", text: "Analyze these photos. The first is a face photo and the second is a full body photo. Extract detailed physical attributes for fashion styling purposes." }
    ];

    if (faceImageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${faceImageBase64}` }
      });
    }

    if (bodyImageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${bodyImageBase64}` }
      });
    }

    messages[1].content = userContent;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "analyze_body_profile",
            description: "Return detailed face and body analysis from photos",
            parameters: {
              type: "object",
              properties: {
                face_analysis: {
                  type: "object",
                  properties: {
                    face_shape: { type: "string", enum: ["Oval", "Round", "Square", "Heart", "Oblong", "Diamond", "Triangle"], description: "Detected face shape" },
                    skin_tone: { type: "string", enum: ["Fair", "Light", "Medium", "Olive", "Dark", "Deep"], description: "Detected skin tone" },
                    skin_undertone: { type: "string", enum: ["Warm", "Cool", "Neutral"], description: "Skin undertone" },
                    hair_color: { type: "string", description: "Detected hair color" },
                    eye_color: { type: "string", description: "Detected eye color" },
                    facial_features: { type: "string", description: "Brief description of notable facial features for styling" },
                  },
                  required: ["face_shape", "skin_tone", "skin_undertone"],
                  additionalProperties: false,
                },
                body_analysis: {
                  type: "object",
                  properties: {
                    body_type: { type: "string", enum: ["Hourglass", "Pear", "Rectangle", "Apple", "Inverted Triangle", "Athletic", "Slim", "Plus Size"], description: "Detected body type" },
                    build: { type: "string", enum: ["Slim", "Average", "Athletic", "Curvy", "Plus Size"], description: "Overall build" },
                    height_estimate: { type: "string", enum: ["Petite", "Average", "Tall"], description: "Estimated height category" },
                    proportions: { type: "string", description: "Description of body proportions (e.g., long torso, long legs, balanced)" },
                    shoulder_type: { type: "string", enum: ["Narrow", "Average", "Broad"], description: "Shoulder width" },
                    best_features: { type: "string", description: "Physical features that can be highlighted through clothing" },
                    styling_notes: { type: "string", description: "Key notes for AI stylist about what styles would flatter this body" },
                  },
                  required: ["body_type", "build", "height_estimate"],
                  additionalProperties: false,
                },
                model_description: {
                  type: "string",
                  description: "A detailed visual description of the person for generating an AI fashion model avatar that resembles them. Include skin tone, body shape, height, hair, and distinguishing features. Be specific enough to generate a realistic avatar."
                },
              },
              required: ["face_analysis", "body_analysis", "model_description"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_body_profile" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = {};
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-body-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
