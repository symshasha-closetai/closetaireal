import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KILLER_TAGS_MALE = [
  "Urban Samurai 🗡️✨", "Silent Billionaire 💰🖤", "Street Alpha 🔥👑", "Midnight Artist 🎨🌙",
  "Campus CEO 💼🎓", "Velvet Operator 🎭✨", "Neon Maverick 💜⚡", "Shadow Stylist 🖤🕶️",
  "Minimal King 👑✨", "Dark Academia Don 📚🖤", "Chrome Heart Drip 💎🔗", "Sunset Sovereign 🌅👑",
  "Retro Royalty 👑🪩", "Ice Cold Flex ❄️💎", "Golden Hour Glow ☀️✨", "Main Character Mode 🎬✨",
  "Quiet Luxury King 🤫👑", "Concrete Runway 🏙️💫", "Denim Dynasty 👖👑", "Monochrome Monarch 🖤🤍",
  "Drip Architect 🏛️💧", "Phantom Flex 👻💪", "Zen Drip Master 🧘💧", "Royal Misfit 👑🃏",
  "Twilight Baron 🌆🎩", "Ivory Tower King 🏰👑", "Digital Nomad Drip 💻🌍", "Obsidian Oracle 🖤🔮",
  "Champagne Casualty 🥂💫", "Cosmic Drifter 🌌✨", "Vintage Voltage ⚡🪩", "Luxe Outlaw 🤠💎",
  "Sapphire Sovereign 💙👑", "Arctic Aristocrat 🧊👑", "Jade Emperor 🟢👑", "Onyx Operator 🖤🎯",
  "Gilded Rebel ✨🔥", "Marble Mood 🤍🏛️", "Boulevard Boss 🛣️👔", "Polo Club Captain 🏇✨",
  "Night Shift Drip 🌃💧", "Stealth Drip 🥷💧", "Grunge Royalty 🎸👑", "Silk Road Style 🧣✨",
  "Electric Elegance ⚡✨", "Crimson Catalyst ❤️‍🔥⚡",
];

const KILLER_TAGS_FEMALE = [
  "Main Character Energy 🎬✨", "Silent Luxury Queen 💰👑", "Street Goddess 🔥💫", "Midnight Muse 🎨🌙",
  "Campus Queen 💼🎓", "Soft Power Femme 🌸⚡", "Velvet Vixen 🎭✨", "Neon Empress 💜⚡",
  "Shadow Siren 🖤🕶️", "Minimal Goddess 👑✨", "Dark Academia Diva 📚🖤", "Chrome Heart Queen 💎🔗",
  "Sunset Empress 🌅👑", "Retro Diva 👑🪩", "Ice Cold Elegance ❄️💎", "Golden Hour Goddess ☀️✨",
  "Quiet Luxury Queen 🤫👑", "Concrete Runway Diva 🏙️💫", "Denim Diva 👖✨", "Monochrome Muse 🖤🤍",
  "Drip Duchess 🏛️💧", "Phantom Femme 👻💅", "Vogue Empress 🦹✨", "Zen Drip Queen 🧘💧",
  "Royal Rebel 👑🃏", "Twilight Duchess 🌆👑", "Ivory Empress 🏰👑", "Digital Diva 💻🌍",
  "Obsidian Goddess 🖤🔮", "Champagne Royalty 🥂💫", "Cosmic Diva 🌌✨", "Vintage Vibe Queen ⚡🪩",
  "Luxe Siren 💎🌹", "Sapphire Empress 💙👑", "Crimson Queen ❤️‍🔥👑", "Arctic Empress 🧊👑",
  "Jade Goddess 🟢✨", "Onyx Enchantress 🖤🎯", "Gilded Femme ✨🔥", "Marble Muse 🤍🏛️",
  "Boulevard Diva 🛣️👠", "Polo Club Princess 🏇✨", "Night Shift Glam 🌃💅", "Stealth Siren 🥷💧",
  "Grunge Goddess 🎸👑", "Silk Dream Diva 🧣✨", "Electric Empress ⚡✨", "Pastel Powerhouse 🍬💪",
];

const KILLER_TAGS_NEUTRAL = [
  "Main Character Mode 🎬✨", "Silent Luxury 💰🖤", "Street Icon 🔥💫", "Midnight Artist 🎨🌙",
  "Campus Legend 💼🎓", "Soft Rebel 🌸⚡", "Velvet Vision 🎭✨", "Neon Maverick 💜⚡",
  "Shadow Stylist 🖤🕶️", "Minimal Icon 👑✨", "Dark Academia Vibe 📚🖤", "Chrome Heart Drip 💎🔗",
  "Sunset Sovereign 🌅👑", "Retro Royalty 👑🪩", "Ice Cold Flex ❄️💎", "Golden Hour Glow ☀️✨",
  "Cosmic Drifter 🌌✨", "Vintage Voltage ⚡🪩", "Gilded Rebel ✨🔥", "Marble Mood 🤍🏛️",
];

const FALLBACK_REASONS = [
  "Great color coordination that creates visual harmony",
  "Strong silhouette choices that flatter your frame",
  "Excellent fabric and texture pairing",
  "Smart layering that adds depth to the look",
  "Well-balanced proportions throughout the outfit",
  "Clean lines and thoughtful styling details",
  "Colors complement each other beautifully",
  "The overall vibe is cohesive and intentional",
];

const OCCASIONS = ["Casual", "Smart Casual", "Street Style", "Date Night", "Work", "Weekend", "Night Out", "Brunch"];

const PRAISE_LINES = [
  "You walked in and the room stopped scrolling 📱✨",
  "This fit said 'I woke up and chose excellence' 💅🔥",
  "You're not dressed, you're ARMED 🗡️✨",
  "Serving looks that need their own zip code 📍💫",
  "You're already dressed like the main character 🎬👑",
  "This outfit just made someone rethink their whole wardrobe 👀🔥",
  "You didn't get ready, you stayed ready 💎✨",
  "Walking mood board energy — everything just clicks 🎨👑",
  "The mirror called, it said thank you 🪞✨",
  "Outfit so clean it should come with a warning label ⚠️✨",
  "You're giving 'I don't try, I just arrive' energy 💅👑",
  "This fit just broke the algorithm 📈🔥",
  "You're dressed like success is your default setting 💼✨",
  "This outfit just won an award it didn't even enter 🏆✨",
  "You're giving 'effortlessly iconic' and it's working 💫👑",
  "You're dressed like your future self sent instructions 🔮🔥",
  "This fit has more personality than most people 🎭💎",
  "Styled like the internet's best-kept secret 🤫✨",
  "This outfit just made gravity optional — you're floating 🫧👑",
];

const FALLBACK_CONFIDENCE_REASONS = [
  "Strong upright posture and relaxed shoulders project natural confidence",
  "Open body language with visible hands and balanced stance signals self-assurance",
  "Relaxed jaw and neutral chin position indicate comfort and groundedness",
  "Shoulders pulled back with chest open suggests high postural confidence",
  "Natural arm positioning away from torso indicates comfort in personal space",
  "Head held level with steady forward orientation projects composure",
  "Balanced weight distribution and planted stance convey stability",
  "Expansive posture with uncrossed arms signals openness and confidence",
];

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getKillerTags(gender?: string | null) {
  if (gender === "female") return KILLER_TAGS_FEMALE;
  if (gender === "male") return KILLER_TAGS_MALE;
  return KILLER_TAGS_NEUTRAL;
}

function generateFallback(gender?: string | null) {
  const color = randomBetween(7.0, 9.5);
  const style = randomBetween(7.0, 9.5);
  const fit = randomBetween(7.0, 9.5);
  const drip = Math.round((color * 0.25 + style * 0.20 + fit * 0.25 + randomBetween(7, 9.5) * 0.20 + randomBetween(7, 9.5) * 0.10) * 10) / 10;

  return {
    drip_score: drip,
    drip_reason: pick(FALLBACK_REASONS),
    confidence_rating: randomBetween(6.0, 9.5),
    confidence_reason: pick(FALLBACK_CONFIDENCE_REASONS),
    killer_tag: pick(getKillerTags(gender)),
    color_score: color,
    color_reason: pick(FALLBACK_REASONS),
    style_score: style,
    style_reason: pick(FALLBACK_REASONS),
    fit_score: fit,
    fit_reason: pick(FALLBACK_REASONS),
    occasion: pick(OCCASIONS),
    advice: "Keep experimenting with your personal style — you're on the right track!",
    praise_line: pick(PRAISE_LINES),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile } = await req.json();

    // Resolve image base64: either provided directly or fetched from URL
    let imageBase64 = rawBase64;
    if (!imageBase64 && imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
        const arrayBuf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        imageBase64 = btoa(binary);
      } catch (fetchErr) {
        console.error("Failed to fetch image from URL:", fetchErr);
        return new Response(JSON.stringify({ error: "Failed to fetch image from URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const gender = styleProfile?.gender || null;

    // Collect all available API keys for rotation
    const apiKeys: string[] = [];
    for (const name of ["GOOGLE_AI_API_KEY", "GOOGLE_AI_API_KEY_2", "GOOGLE_AI_API_KEY_3", "GOOGLE_AI_API_KEY_4"]) {
      const k = Deno.env.get(name);
      if (k) apiKeys.push(k);
    }

    if (apiKeys.length === 0) {
      console.warn("No GOOGLE_AI_API_KEY configured, using fallback");
      return new Response(JSON.stringify({ result: generateFallback(gender) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = ` Profile: ${parts.join(", ")}.`;
    }

    const genderInstruction = gender === "female"
      ? "Use feminine killer_tag (Queen, Empress, Goddess)."
      : gender === "male"
      ? "Use masculine killer_tag (King, Emperor, Boss)."
      : "Use gender-neutral killer_tag.";

    const prompt = `Fashion stylist AI.${profileContext}

Return ONLY valid JSON:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string"}

Rules:
- All scores 0-10 decimals. drip_score = Color(25%)+Style(20%)+Fit(25%)+Occasion(20%)+Accessories(10%)
- confidence_rating: Score posture/body language 0-10.
- killer_tag: 1-3 words + 1-2 emojis. ${genderInstruction}
- praise_line: witty shareable sentence, Gen Z tone, emojis.
- reasons: 1 sentence each. NO profanity.

Analyze this outfit. Return JSON only.`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    // Multi-key rotation with 8s global timeout
    let result = null;
    const startTime = Date.now();
    const GLOBAL_TIMEOUT = 8000;

    for (let i = 0; i < apiKeys.length; i++) {
      if (Date.now() - startTime > GLOBAL_TIMEOUT) {
        console.warn("Global 8s timeout reached, using fallback");
        break;
      }

      const remainingMs = GLOBAL_TIMEOUT - (Date.now() - startTime);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeys[i]}`;

      try {
        const response = await Promise.race([
          fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), remainingMs)),
        ]) as Response;

        if (response.status === 429 || response.status >= 500) {
          console.warn(`Key ${i + 1} returned ${response.status}, trying next key...`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Key ${i + 1} error: ${response.status} ${errText}`);
          continue;
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          result = JSON.parse(cleaned);
        } catch {
          console.error("Failed to parse Gemini response:", content);
          continue;
        }
        // Success — break out of key rotation
        break;
      } catch (e) {
        console.warn(`Key ${i + 1} failed:`, e instanceof Error ? e.message : e);
        continue;
      }
    }

    if (!result) result = generateFallback(gender);

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ result: generateFallback() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
