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
  "This fit has its own gravitational pull 🌍💫",
  "You look like the plot twist nobody saw coming 🎭🔥",
  "Outfit so clean it should come with a warning label ⚠️✨",
  "You're giving 'I don't try, I just arrive' energy 💅👑",
  "This look just raised everyone's standards 📈🔥",
  "Styled like tomorrow already happened ⏳✨",
  "This fit walked so others could crawl 🚶‍♂️💨",
  "You're dressed like confidence has a uniform 🫡✨",
  "Somebody call the fire department because this look is blazing 🔥🚒",
  "You're already dressed like a CEO on vacation 🏝️👔",
  "This outfit is what Wi-Fi would look like if it were stylish 📶✨",
  "The drip is so real, umbrellas are jealous ☂️💧",
  "You're giving 'I own the room' without saying a word 🤫👑",
  "This fit is a whole vibe check passed with honors 🎓🔥",
  "Looking like you stepped out of a style documentary 🎥✨",
  "You just made getting dressed look like an art form 🎨💅",
  "This look has more layers than your playlist 🎵✨",
  "You're dressed like the algorithm wants to feature you 📲🔥",
  "Outfit so fire, screenshots are being taken right now 📸💥",
  "You're already dressed like the sequel everyone's been waiting for 🎬✨",
  "This fit just sent the fashion police on paid leave 👮‍♂️💫",
  "You look like confidence and comfort had a baby 👶✨",
  "This outfit radiates 'I know exactly who I am' energy 🪞🔥",
  "Styled like you've got a stylist but you ARE the stylist 💇‍♂️👑",
  "This look is giving main event, not opening act 🎤✨",
  "You're dressed like good taste runs in the family 🧬🔥",
  "You're dressed like success is your default setting 💼✨",
  "This fit just broke the algorithm 📈🔥",
  "You look like you own the playlist AND the venue 🎶👑",
  "This outfit has more range than your favorite artist 🎤✨",
  "You're giving 'walked in, owned it, left' energy 🚶‍♂️💨",
  "This look just unlocked a new level of drip 🎮✨",
  "You're dressed like the universe owes you a runway 🌌💃",
  "This fit is a whole thesis on looking good 📜🔥",
  "You look like you came with a soundtrack 🎧👑",
  "This outfit just won an award it didn't even enter 🏆✨",
  "You're giving 'effortlessly iconic' and it's working 💫👑",
  "This look said 'fashion week who?' and meant it 🤷‍♂️✨",
  "You're dressed like your future self sent instructions 🔮🔥",
  "This fit has more personality than most people 🎭💎",
  "You look like the VIP section was built for you 🥂👑",
  "Styled like the internet's best-kept secret 🤫✨",
  "This outfit just made gravity optional — you're floating 🫧👑",
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

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FALLBACK_CONFIDENCE_REASONS = [
  "Strong upright posture and relaxed shoulders project natural confidence — consistent with Cuddy's postural expansiveness research",
  "Open body language with visible hands and balanced stance signals social ease and self-assurance",
  "Relaxed jaw and neutral chin position indicate comfort and groundedness — no tension markers detected",
  "Shoulders pulled back with chest open suggests high postural confidence (Carney et al., 2010)",
  "Natural arm positioning away from torso indicates comfort in personal space — a key dominance cue",
  "Head held level with steady forward orientation projects composure and directness",
  "Balanced weight distribution and planted stance convey stability and self-possession",
  "Expansive posture with uncrossed arms signals openness — a core indicator in nonverbal confidence research",
];

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

async function callWithFallback(models: string[], apiKey: string, body: any): Promise<any> {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      console.warn(`Model ${model} returned ${response.status}, trying fallback...`);
      if (i === models.length - 1) {
        const errText = await response.text();
        throw new Error(`All models failed. Last: ${response.status} ${errText}`);
      }
      continue;
    }
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }
  throw new Error("No models available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, styleProfile } = await req.json();
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const gender = styleProfile?.gender || null;

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      console.warn("GOOGLE_AI_API_KEY not configured, using fallback");
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
      ? "Use feminine/gender-appropriate language in killer_tag — use words like Queen, Empress, Goddess, Diva, Siren, Duchess, Muse. NEVER use King, Emperor, Boss, Don, Baron."
      : gender === "male"
      ? "Use masculine/gender-appropriate language in killer_tag — use words like King, Emperor, Boss, Don, Baron, Sovereign. NEVER use Queen, Empress, Goddess, Diva."
      : "Use gender-neutral language in killer_tag — avoid gendered words like King/Queen.";

    const systemPrompt = `Fashion stylist AI.${profileContext}

Return ONLY valid JSON:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string"}

Rules:
- All scores 0-10 decimals. drip_score = Color(25%)+Style(20%)+Fit(25%)+Occasion(20%)+Accessories(10%)
- confidence_rating: Score based on SCIENTIFIC analysis of facial expression and body language visible in the photo. Evaluate these indicators:
  * Duchenne smile: genuine smile engaging orbicularis oculi (eye crinkle) vs social/forced smile
  * Eye contact: direct gaze toward camera = high confidence; averted/downcast = lower
  * Postural expansiveness (Amy Cuddy's research): open, space-occupying posture = high; closed, contracted = lower
  * Chin/jaw position: chin level or slightly raised = confidence; tucked/lowered = uncertainty
  * Shoulder positioning: relaxed, pulled back = confident; hunched, raised = tense
  * Hand positioning: visible, relaxed, open = confident; hidden, fidgeting, crossed = guarded
  * Overall body symmetry and groundedness of stance
  If face is not clearly visible, score based on body language cues only and note that in confidence_reason.
- confidence_reason: 1-2 sentences referencing the SPECIFIC scientific indicators observed. Mention which cues were detected (e.g. "Duchenne smile with eye engagement", "expansive open posture", "relaxed jaw line").
- killer_tag: 1-3 words + 1-2 emojis. ${genderInstruction} MUST be SPECIFIC to the actual outfit style/vibe detected — reference the colors, patterns, era, subculture, or energy of THIS outfit. Never use generic tags like "Looking Good" or "Nice Outfit". Think TikTok caption energy.
- praise_line: one stylish shareable sentence SPECIFIC to the outfit. Reference actual items/colors/style detected. Gen Z tone — witty, confident, emoji-sprinkled.
- STRICTLY NO profanity, cuss words, or vulgar language in any field. Keep it clean but fire 🔥
- reasons: 1-2 sentences each
- DO NOT include wardrobe_suggestions or shopping_suggestions`;

    // 7-second timeout: race AI call vs timeout
    const aiPromise = callWithFallback(
      ["gemini-2.0-flash", "gemini-2.5-flash"],
      apiKey,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt + "\n\nAnalyze this outfit. Return JSON only." },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            ],
          },
        ],
      }
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), 7000)
    );

    let result = null;
    try {
      const data = await Promise.race([aiPromise, timeoutPromise]) as any;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI response:", content);
        result = generateFallback(gender);
      }
    } catch (e) {
      console.warn("AI call failed/timed out, using fallback:", e);
      result = generateFallback(gender);
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ result: generateFallback() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
