import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Sparkles, Check, Loader2 } from "lucide-react";
import LeaderboardTab from "../components/LeaderboardTab";
import AppHeader from "../components/AppHeader";
import OutfitRatingCard from "../components/OutfitRatingCard";
import SignUpPromptDialog from "../components/SignUpPromptDialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { r2 } from "@/lib/r2Storage";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

const FALLBACK_TAGS = ["Clean Fit", "Solid Look", "Got Potential", "Quiet Flex", "Vibe Check"];
const FALLBACK_PRAISE = [
  "you showed up and that's already half the battle",
  "this fit has more going for it than you think",
  "not bad at all — keep building on this energy",
];

function clientFallbackResult(_gender?: string | null): RatingResult {
  const r = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 10) / 10;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const color = r(7, 9.5), posture = r(7, 9.5), layering = r(7, 9.5), face = r(7, 9.5);
  return {
    drip_score: Math.round((color * 0.30 + posture * 0.30 + layering * 0.25 + face * 0.15) * 10) / 10,
    drip_reason: "Great color coordination that creates visual harmony",
    confidence_rating: r(7.5, 9.5),
    confidence_reason: "This look shows intentional styling choices",
    killer_tag: pick(FALLBACK_TAGS),
    color_score: color, color_reason: "Colors complement each other beautifully",
    posture_score: posture, posture_reason: "Strong stance that conveys confidence",
    layering_score: layering, layering_reason: "Well-layered with complementary accessories",
    face_score: face, face_reason: "Great expression that ties the look together",
    advice: "Keep experimenting with your personal style — you're on the right track!",
    praise_line: pick(FALLBACK_PRAISE),
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
  // Roast mode fields (no human detected)
  error?: string;
  roast_line?: string;
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
  unfiltered: boolean;
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
  unfiltered: false,
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
const saveDripToHistory = async (image: string, result: RatingResult, userId?: string, imageHash?: string, unfiltered?: boolean) => {
  const entry = {
    id: `drip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    image,
    score: result.drip_score,
    killerTag: result.killer_tag || "",
    praiseLine: result.praise_line || "",
    imageHash: imageHash || "",
    mode: unfiltered ? "savage" : "standard",
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

      const { error: dbErr } = await supabase.from("drip_history").insert({
        user_id: userId,
        image_url: imageUrl,
        score: result.drip_score,
        killer_tag: result.killer_tag || null,
        praise_line: result.praise_line || null,
        full_result: result as any,
        image_hash: imageHash || null,
        confidence_score: result.confidence_rating || null,
      });
      if (dbErr) {
        console.error("Failed to save drip to DB:", dbErr);
        toast.error("Score saved locally but failed to sync to leaderboard");
      } else {
        // Invalidate all leaderboard caches (device + module)
        try {
          localStorage.removeItem("leaderboard-daily-cache");
          // Clear device cache entries for leaderboard
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (key.startsWith("dripd_leaderboard")) {
              localStorage.removeItem(key);
            }
          }
        } catch {}
        // Signal to LeaderboardTab to force refresh
        window.dispatchEvent(new CustomEvent("drip-saved"));
      }
    } catch (err) {
      console.error("Failed to save drip to DB:", err);
      toast.error("Score saved locally but failed to sync");
    }
  }
};

// Check cache for existing result by image hash — MODE-AWARE
const checkCache = async (imageHash: string, userId?: string, unfiltered?: boolean): Promise<RatingResult | null> => {
  const modeKey = unfiltered ? "savage" : "standard";
  // Check localStorage first
  try {
    const cached = JSON.parse(localStorage.getItem("drip-history") || "[]");
    const match = cached.find((e: any) => e.imageHash === imageHash && (e.mode || "standard") === modeKey);
    if (match?.fullResult) return match.fullResult;
  } catch {}

  // Skip DB cache for mode-aware lookups (DB doesn't store mode)
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

const runAnalysis = async (file: File, userId: string | undefined, styleProfile: any, gender?: string | null, unfiltered?: boolean) => {
  activeAbort = new AbortController();
  updateGlobal({ analyzing: true, progress: 5, stage: "Compressing image...", analysisSteps: [] });

  try {
    const { blob, base64: imageBase64 } = await compressImage(file, 1024, 1024, 0.7, 300);

    if (activeAbort?.signal.aborted) return;

    // Parallel: check cache + upload to storage
    const imageHash = computeImageHash(imageBase64);
    
    const cachePromise = checkCache(imageHash, userId, unfiltered);
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

    const aiCallBody = { imageBase64, styleProfile: styleProfile || undefined, unfiltered: !!unfiltered };

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

    // Roast mode now returns a full result card (scores at 0, with killer_tag + praise_line)
    // No special interception needed — flows through as normal result

    if (error || data?.error || !data?.result) {
      if (data?.error) {
        console.error("rate-outfit returned error:", data.error);
        toast.error("AI returned error: " + (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)));
      }
      const fallback = clientFallbackResult(gender);
      updateGlobal({ result: fallback, analyzing: false, progress: 0, stage: "", analysisSteps: [] });
      saveDripToHistory(globalDripState.image || "", fallback, userId, imageHash, unfiltered);
      return;
    }
    if (data?.result) {
      updateGlobal({ result: data.result, analyzing: false, progress: 0, stage: "", analysisSteps: [] });
      if (userId) {
        saveDripToHistory(globalDripState.image || "", data.result, userId, imageHash, unfiltered);
      }
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
  const { user, styleProfile, isGuest } = useAuth();
  const [, forceUpdate] = useState(0);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
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

  // Show sign-up prompt for guests after result loads
  useEffect(() => {
    if (isGuest && result && !analyzing) {
      const timer = setTimeout(() => setShowSignUpPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isGuest, result, analyzing]);
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
    runAnalysis(file, user?.id, styleProfile, styleProfile?.gender, globalDripState.unfiltered);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Drip Check</h1>
              <p className="text-sm text-muted-foreground mt-1">Upload or capture your outfit for styling insights</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Savage Mode 😏</span>
              <Switch
                checked={globalDripState.unfiltered}
                onCheckedChange={(v) => updateGlobal({ unfiltered: v })}
              />
            </div>
          </div>
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
                  <img src={image} alt="Outfit" className="w-full object-contain" />
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
                    className="w-full mt-4 py-3 rounded-full bg-card border border-border/40 text-foreground/70 font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 tracking-wider shadow-lg shadow-black/30">
                    <Camera size={16} /> Try With Different Outfit
                  </motion.button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}
      </div>
      <SignUpPromptDialog open={showSignUpPrompt} onOpenChange={setShowSignUpPrompt} variant="drip" />
    </div>
  );
};

export default CameraScreen;
