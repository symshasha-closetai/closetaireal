import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Sparkles, Check, Loader2 } from "lucide-react";
import LeaderboardTab from "../components/LeaderboardTab";
import AppHeader from "../components/AppHeader";
import OutfitRatingCard from "../components/OutfitRatingCard";
import { supabase } from "@/integrations/supabase/client";
import { r2 } from "@/lib/r2Storage";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

const CLIENT_KILLER_TAGS_MALE = [
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

const CLIENT_KILLER_TAGS_FEMALE = [
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

const CLIENT_KILLER_TAGS_NEUTRAL = [
  "Main Character Mode 🎬✨", "Silent Luxury 💰🖤", "Street Icon 🔥💫", "Midnight Artist 🎨🌙",
  "Campus Legend 💼🎓", "Soft Rebel 🌸⚡", "Velvet Vision 🎭✨", "Neon Maverick 💜⚡",
  "Shadow Stylist 🖤🕶️", "Minimal Icon 👑✨", "Dark Academia Vibe 📚🖤", "Chrome Heart Drip 💎🔗",
  "Sunset Sovereign 🌅👑", "Retro Royalty 👑🪩", "Ice Cold Flex ❄️💎", "Golden Hour Glow ☀️✨",
  "Cosmic Drifter 🌌✨", "Vintage Voltage ⚡🪩", "Gilded Rebel ✨🔥", "Marble Mood 🤍🏛️",
];

function getClientKillerTags(gender?: string | null) {
  if (gender === "female") return CLIENT_KILLER_TAGS_FEMALE;
  if (gender === "male") return CLIENT_KILLER_TAGS_MALE;
  return CLIENT_KILLER_TAGS_NEUTRAL;
}

const CLIENT_PRAISE_LINES = [
  "You walked in and the room stopped scrolling 📱✨",
  "This fit said 'I woke up and chose excellence' 💅🔥",
  "You're already dressed like the main character 🎬👑",
  "Serving looks that need their own zip code 📍💫",
  "You're not dressed, you're ARMED 🗡️✨",
  "This outfit just made someone rethink their whole wardrobe 👀🔥",
  "Walking mood board energy — everything just clicks 🎨👑",
  "The mirror called, it said thank you 🪞✨",
  "Outfit so clean it should come with a warning label ⚠️✨",
  "You're giving 'I don't try, I just arrive' energy 💅👑",
  "You're dressed like success is your default setting 💼✨",
  "This fit just broke the algorithm 📈🔥",
  "You look like you own the playlist AND the venue 🎶👑",
  "This outfit has more range than your favorite artist 🎤✨",
  "You're giving 'walked in, owned it, left' energy 🚶‍♂️💨",
  "This look just unlocked a new level of drip 🎮✨",
  "You're dressed like the universe owes you a runway 🌌💃",
  "You look like you came with a soundtrack 🎧👑",
  "This outfit just won an award it didn't even enter 🏆✨",
  "You're giving 'effortlessly iconic' and it's working 💫👑",
  "You're dressed like your future self sent instructions 🔮🔥",
  "This fit has more personality than most people 🎭💎",
  "Styled like the internet's best-kept secret 🤫✨",
  "This outfit just made gravity optional — you're floating 🫧👑",
];

function clientFallbackResult(gender?: string | null): RatingResult {
  const r = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 10) / 10;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const color = r(7, 9.5), posture = r(7, 9.5), layering = r(7, 9.5), face = r(7, 9.5);
  return {
    drip_score: Math.round((color * 0.30 + posture * 0.30 + layering * 0.25 + face * 0.15) * 10) / 10,
    drip_reason: "Great color coordination that creates visual harmony",
    confidence_rating: r(7.5, 9.5),
    confidence_reason: "This look shows intentional styling choices",
    killer_tag: pick(getClientKillerTags(gender)),
    color_score: color, color_reason: "Colors complement each other beautifully",
    posture_score: posture, posture_reason: "Strong stance that conveys confidence",
    layering_score: layering, layering_reason: "Well-layered with complementary accessories",
    face_score: face, face_reason: "Great expression that ties the look together",
    advice: "Keep experimenting with your personal style — you're on the right track!",
    praise_line: pick(CLIENT_PRAISE_LINES),
  };
}

export type RatingResult = {
  drip_score: number;
  drip_reason?: string;
  confidence_rating: number;
  confidence_reason?: string;
  killer_tag?: string;
  color_score: number;
  color_reason?: string;
  posture_score: number;
  posture_reason?: string;
  layering_score: number;
  layering_reason?: string;
  face_score: number;
  face_reason?: string;
  advice: string;
  praise_line?: string;
  // Legacy fields for backward compat with old results
  style_score?: number;
  style_reason?: string;
  fit_score?: number;
  fit_reason?: string;
  occasion?: string;
  wardrobe_suggestions?: { item_name: string; category: string; reason: string; wardrobe_item_id?: string }[];
  shopping_suggestions?: { item_name: string; category: string; reason: string; image_prompt?: string }[];
};

// Persist drip analysis state across navigation
type DetectedItem = { name: string; type: string; color: string; material?: string; quality?: string; brand?: string; selected: boolean };
type Suggestion = { item_name: string; category: string; reason: string; wardrobe_item_id?: string; image_prompt?: string };

type AnalysisStep = { label: string; status: 'pending' | 'active' | 'done' };

type DripState = {
  image: string | null;
  imageBase64: string | null;
  analyzing: boolean;
  progress: number;
  stage: string;
  analysisSteps: AnalysisStep[];
  result: RatingResult | null;
  wardrobeItems: any[];
  wardrobeSuggestions: Suggestion[] | null;
  shoppingSuggestions: Suggestion[] | null;
  detectedItems: DetectedItem[] | null;
  suggestionImages: Record<number, string | null>;
  savedSuggestions: string[];
};

const ANALYSIS_STEP_LABELS = [
  "Detecting colors...",
  "Understanding outfit style...",
  "Calculating drip score...",
  "Generating confidence score...",
];

const globalDripState: DripState = {
  image: null,
  imageBase64: null,
  analyzing: false,
  progress: 0,
  stage: "",
  analysisSteps: [],
  result: null,
  wardrobeItems: [],
  wardrobeSuggestions: null,
  shoppingSuggestions: null,
  detectedItems: null,
  suggestionImages: {},
  savedSuggestions: [],
};

let globalListeners: Set<() => void> = new Set();
const notifyListeners = () => globalListeners.forEach((fn) => fn());

const updateGlobal = (patch: Partial<DripState>) => {
  Object.assign(globalDripState, patch);
  notifyListeners();
};

// Improved image hash for cache lookups — samples evenly across the string
const computeImageHash = (base64: string): string => {
  const len = base64.length;
  const sampleSize = 1000;
  let sample = "";
  const step = Math.max(1, Math.floor(len / sampleSize));
  for (let i = 0; i < len && sample.length < sampleSize; i += step) {
    sample += base64[i];
  }
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash |= 0;
  }
  return `img_${len}_${hash}`;
};

// Save drip card to DB + localStorage cache
const saveDripToHistory = async (image: string, result: RatingResult, userId?: string, imageHash?: string) => {
  const entry = {
    id: `drip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    image,
    score: result.drip_score,
    killerTag: result.killer_tag || "",
    praiseLine: result.praise_line || "",
    imageHash: imageHash || "",
    fullResult: result,
    timestamp: Date.now(),
  };

  // Save to localStorage as cache
  try {
    const existing = JSON.parse(localStorage.getItem("drip-history") || "[]");
    const updated = [entry, ...existing].slice(0, 20);
    localStorage.setItem("drip-history", JSON.stringify(updated));
  } catch { /* quota */ }

  // Save to DB if user is logged in
  if (userId) {
    try {
      // Upload image to storage
      let imageUrl: string | null = null;
      try {
        const response = await fetch(image);
        const blob = await response.blob();
        const path = `${userId}/drip-${Date.now()}.jpg`;
        const { publicUrl, error: uploadErr } = await r2.upload(path, blob, { contentType: "image/jpeg" });
        if (!uploadErr) {
          imageUrl = publicUrl;
        }
      } catch { /* storage upload failed, continue without image */ }

      await supabase.from("drip_history" as any).insert({
        user_id: userId,
        image_url: imageUrl,
        score: result.drip_score,
        killer_tag: result.killer_tag || null,
        praise_line: result.praise_line || null,
        full_result: result as any,
        image_hash: imageHash || null,
        confidence_score: result.confidence_rating || null,
      } as any);
    } catch (err) {
      console.error("Failed to save drip to DB:", err);
    }
  }
};

// Check cache for existing result by image hash
const checkCache = async (imageHash: string, userId?: string): Promise<RatingResult | null> => {
  // Check localStorage first
  try {
    const cached = JSON.parse(localStorage.getItem("drip-history") || "[]");
    const match = cached.find((e: any) => e.imageHash === imageHash);
    if (match?.fullResult) return match.fullResult;
  } catch {}

  // Check DB
  if (userId) {
    try {
      const { data } = await supabase
        .from("drip_history" as any)
        .select("full_result")
        .eq("user_id", userId)
        .eq("image_hash", imageHash)
        .order("created_at", { ascending: false })
        .limit(1) as any;
      if (data?.[0]?.full_result) return data[0].full_result as RatingResult;
    } catch {}
  }
  return null;
};

// Run analysis globally so it survives navigation
let activeAbort: AbortController | null = null;

let stageTimers: ReturnType<typeof setTimeout>[] = [];

const startStagedAnimation = () => {
  const steps: AnalysisStep[] = ANALYSIS_STEP_LABELS.map((label) => ({ label, status: 'pending' as const }));
  steps[0].status = 'active';
  updateGlobal({ analysisSteps: [...steps] });

  for (let i = 0; i < steps.length; i++) {
    const timer = setTimeout(() => {
      steps[i].status = 'done';
      if (i + 1 < steps.length) steps[i + 1].status = 'active';
      updateGlobal({ analysisSteps: [...steps] });
    }, (i + 1) * 1500);
    stageTimers.push(timer);
  }
};

const clearStageTimers = () => {
  stageTimers.forEach(clearTimeout);
  stageTimers = [];
};

const runAnalysis = async (file: File, userId: string | undefined, styleProfile: any, gender?: string | null) => {
  activeAbort = new AbortController();
  updateGlobal({ analyzing: true, progress: 5, stage: "Compressing image...", analysisSteps: [] });

  try {
    const { blob, base64: imageBase64 } = await compressImage(file, 512, 512, 0.65, 200);

    if (activeAbort?.signal.aborted) return;

    // Parallel: check cache + upload to storage
    const imageHash = computeImageHash(imageBase64);
    
    const cachePromise = checkCache(imageHash, userId);
    let uploadPromise: Promise<string | null> = Promise.resolve(null);
    if (userId) {
      const path = `${userId}/drip-${Date.now()}.jpg`;
      uploadPromise = r2.upload(path, blob, { contentType: "image/jpeg" })
        .then(({ publicUrl, error: uploadErr }) => {
          if (uploadErr) return null;
          return publicUrl;
        })
        .catch(() => null);
    }

    const [cachedResult, uploadedUrl] = await Promise.all([cachePromise, uploadPromise]);

    if (cachedResult) {
      if (activeAbort?.signal.aborted) return;
      updateGlobal({ result: cachedResult, analyzing: false, progress: 0, stage: "", analysisSteps: [] });
      toast.success("Loaded your previous rating for this photo!");
      return;
    }

    if (activeAbort?.signal.aborted) return;

    // Start staged animation and AI call in parallel
    startStagedAnimation();
    const minDelay = new Promise((r) => setTimeout(r, 5000));

    const aiCallBody: any = uploadedUrl
      ? { imageUrl: uploadedUrl, styleProfile: styleProfile || undefined }
      : { imageBase64, styleProfile: styleProfile || undefined };

    const aiCall = supabase.functions.invoke("rate-outfit", {
      body: aiCallBody,
    });

    const [{ data, error }] = await Promise.all([aiCall, minDelay]) as [any, any];

    if (activeAbort?.signal.aborted) return;
    clearStageTimers();

    if (error) {
      console.error("rate-outfit error:", error);
      toast.error("AI rating failed: " + (error.message || "Unknown error — check edge function deployment"));
    }
    if (error || data?.error || !data?.result) {
      if (data?.error) {
        console.error("rate-outfit returned error:", data.error);
        toast.error("AI returned error: " + (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)));
      }
      const fallback = clientFallbackResult(gender);
      updateGlobal({ result: fallback, analyzing: false, progress: 0, stage: "", analysisSteps: [] });
      saveDripToHistory(globalDripState.image || "", fallback, userId, imageHash);
      return;
    }
    if (data?.result) {
      updateGlobal({ result: data.result, analyzing: false, progress: 0, stage: "", analysisSteps: [] });
      saveDripToHistory(globalDripState.image || "", data.result, userId, imageHash);
      // Update streak on successful drip check (synced with HomeScreen format)
      if (userId) {
        try {
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          let newStreak = 1;
          const raw = localStorage.getItem(`streak-${userId}`);
          if (raw) {
            const { count, lastDate } = JSON.parse(raw);
            if (lastDate === yesterday) newStreak = count + 1;
            else if (lastDate === today) newStreak = count;
            else newStreak = 1;
          }
          localStorage.setItem(`streak-${userId}`, JSON.stringify({ count: newStreak, lastDate: today }));
        } catch {}
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError" || activeAbort?.signal.aborted) return;
    console.error("Rating error:", err);
    const fallback = clientFallbackResult(gender);
    updateGlobal({ result: fallback, analyzing: false, progress: 0, stage: "", analysisSteps: [] });
    saveDripToHistory(globalDripState.image || "", fallback, userId);
  } finally {
    activeAbort = null;
    clearStageTimers();
  }
};

const CameraScreen = () => {
  const { user, styleProfile } = useAuth();
  const [, forceUpdate] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);

  // Subscribe to global state changes
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    globalListeners.add(listener);
    return () => { globalListeners.delete(listener); };
  }, []);

  const { image, imageBase64, analyzing, result, wardrobeItems, analysisSteps,
    wardrobeSuggestions, shoppingSuggestions, detectedItems, suggestionImages, savedSuggestions } = globalDripState;

  // Fetch user's actual wardrobe items on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("wardrobe").select("id, name, type, color, material, image_url").eq("user_id", user.id)
      .then(({ data }) => { if (data) updateGlobal({ wardrobeItems: data }); });
  }, [user?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    updateGlobal({ image: url, imageBase64: dataUrl, result: null });
    runAnalysis(file, user?.id, styleProfile, styleProfile?.gender);
  };

  const cancelAnalysis = () => {
    if (activeAbort) activeAbort.abort();
    activeAbort = null;
    clearStageTimers();
    updateGlobal({ analyzing: false, image: null, imageBase64: null, result: null, progress: 0, stage: "", analysisSteps: [] });
  };

  const clearImage = () => {
    updateGlobal({ image: null, imageBase64: null, result: null,
      wardrobeSuggestions: null, shoppingSuggestions: null, detectedItems: null, suggestionImages: {}, savedSuggestions: [] });
  };

  const [activeTab, setActiveTab] = useState<"drip" | "leaderboard">("drip");

  return (
    <div className="min-h-screen pb-24 px-5 pt-4">
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><AppHeader /></motion.div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl bg-card shadow-soft">
          <button onClick={() => setActiveTab("drip")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "drip" ? "gradient-gold text-white shadow-sm" : "text-muted-foreground"}`}>
            Drip Check
          </button>
          <button onClick={() => setActiveTab("leaderboard")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "leaderboard" ? "gradient-gold text-white shadow-sm" : "text-muted-foreground"}`}>
            Leaderboard
          </button>
        </div>

        {activeTab === "leaderboard" ? (
          <LeaderboardTab />
        ) : (
        <>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h1 className="font-display text-2xl font-semibold text-foreground">Drip Check</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload or capture your outfit for styling insights</p>
        </motion.div>

        <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
        <input type="file" accept="image/*" capture="environment" ref={cameraFileRef} className="hidden" onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />

        <AnimatePresence mode="wait">
          {!image ? (
             <motion.div key="upload" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl bg-card border border-dashed border-gold/30 overflow-hidden shadow-card">
              <div className="aspect-[3/4] flex flex-col items-center justify-center gap-6 p-8">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center"
                >
                  <Camera size={32} className="text-gold" />
                </motion.div>
                <div className="text-center space-y-2">
                  <p className="font-display font-semibold text-foreground text-lg">Capture Your Look</p>
                  <p className="text-sm text-muted-foreground">Take a photo or upload from gallery</p>
                </div>
                <div className="flex gap-3 w-full max-w-xs">
                  <button onClick={() => cameraFileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-gold text-white font-medium text-sm glow-gold active:scale-[0.98] transition-transform">
                    <Camera size={16} /> Camera
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border text-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform">
                    <Upload size={16} /> Gallery
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
              {analyzing ? (
                <div className="rounded-2xl overflow-hidden relative">
                  <img src={image} alt="Outfit" className="w-full aspect-[3/4] object-cover" />
                  <button onClick={cancelAnalysis} className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/90 text-destructive-foreground backdrop-blur-sm text-xs font-medium active:scale-95 transition-transform">
                    <X size={14} /> Cancel
                  </button>
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-md flex items-center justify-center">
                    <div className="flex flex-col items-center gap-5 w-full max-w-[260px]">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                        <Sparkles size={32} className="text-gold drop-shadow-[0_0_12px_hsl(42_60%_55%)]" />
                      </motion.div>
                      <div className="w-full space-y-3">
                        {analysisSteps.map((step, i) => (
                          <motion.div
                            key={step.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.15 }}
                            className="flex items-center gap-3"
                          >
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                              {step.status === 'done' ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                                  <Check size={18} className="text-green-400 drop-shadow-sm" />
                                </motion.div>
                              ) : step.status === 'active' ? (
                                <Loader2 size={18} className="text-accent animate-spin" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                              )}
                            </div>
                            <span className={`text-sm font-medium transition-colors duration-300 ${
                              step.status === 'done' ? 'text-foreground' : step.status === 'active' ? 'text-foreground' : 'text-muted-foreground/50'
                            }`}>
                              {step.label}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : result ? (
                <div className="relative">
                  <button onClick={clearImage} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-foreground/60 text-primary-foreground flex items-center justify-center backdrop-blur-sm">
                    <X size={16} />
                  </button>
                  <OutfitRatingCard
                    image={image} imageBase64={imageBase64 || undefined} result={result} wardrobeItems={wardrobeItems}
                    wardrobeSuggestions={wardrobeSuggestions} shoppingSuggestions={shoppingSuggestions}
                    detectedItems={detectedItems} suggestionImages={suggestionImages} savedSuggestions={savedSuggestions}
                    onWardrobeSuggestionsChange={(v) => updateGlobal({ wardrobeSuggestions: v })}
                    onShoppingSuggestionsChange={(v) => updateGlobal({ shoppingSuggestions: v })}
                    onDetectedItemsChange={(v) => updateGlobal({ detectedItems: v })}
                    onSuggestionImagesChange={(v) => updateGlobal({ suggestionImages: v })}
                    onSavedSuggestionsChange={(v) => updateGlobal({ savedSuggestions: v })}
                  />
                  <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    onClick={clearImage}
                    className="w-full mt-4 py-3 rounded-full border border-border/40 text-foreground/70 font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 tracking-wider">
                    <Camera size={16} /> Check Another Photo
                  </motion.button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}
      </div>
    </div>
  );
};

export default CameraScreen;
