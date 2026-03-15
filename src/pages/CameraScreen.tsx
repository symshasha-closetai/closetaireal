import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import AppHeader from "../components/AppHeader";
import OutfitRatingCard from "../components/OutfitRatingCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

export type RatingResult = {
  drip_score: number;
  drip_reason?: string;
  confidence_rating: number;
  confidence_reason?: string;
  killer_tag?: string;
  color_score: number;
  color_reason?: string;
  style_score: number;
  style_reason?: string;
  fit_score: number;
  fit_reason?: string;
  occasion: string;
  advice: string;
  praise_line?: string;
  wardrobe_suggestions?: { item_name: string; category: string; reason: string; wardrobe_item_id?: string }[];
  shopping_suggestions?: { item_name: string; category: string; reason: string; image_prompt?: string }[];
};

// Persist drip analysis state across navigation
type DripState = {
  image: string | null;
  imageBase64: string | null;
  analyzing: boolean;
  progress: number;
  stage: string;
  result: RatingResult | null;
  wardrobeItems: any[];
};

const globalDripState: DripState = {
  image: null,
  imageBase64: null,
  analyzing: false,
  progress: 0,
  stage: "",
  result: null,
  wardrobeItems: [],
};

let globalListeners: Set<() => void> = new Set();
const notifyListeners = () => globalListeners.forEach((fn) => fn());

const updateGlobal = (patch: Partial<DripState>) => {
  Object.assign(globalDripState, patch);
  notifyListeners();
};

// Simple image hash for cache lookups
const computeImageHash = (base64: string): string => {
  const sample = base64.substring(0, 200) + base64.substring(base64.length - 200);
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash |= 0;
  }
  return `img_${base64.length}_${hash}`;
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
        const { error: uploadErr } = await supabase.storage.from("wardrobe").upload(path, blob, { contentType: "image/jpeg" });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(path);
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

const runAnalysis = async (file: File, userId: string | undefined, styleProfile: any) => {
  activeAbort = new AbortController();
  updateGlobal({ analyzing: true, progress: 5, stage: "Compressing image..." });

  try {
    const { base64: imageBase64 } = await compressImage(file, 800, 800);

    if (activeAbort?.signal.aborted) return;

    // Check cache for consistent scores
    const imageHash = computeImageHash(imageBase64);
    updateGlobal({ progress: 15, stage: "Checking for previous analysis..." });

    const cachedResult = await checkCache(imageHash, userId);
    if (cachedResult) {
      if (activeAbort?.signal.aborted) return;
      updateGlobal({ result: cachedResult, analyzing: false, progress: 0, stage: "" });
      toast.success("Loaded your previous rating for this photo!");
      return;
    }

    if (activeAbort?.signal.aborted) return;
    updateGlobal({ progress: 20, stage: "Analyzing your style..." });

    if (activeAbort?.signal.aborted) return;
    updateGlobal({ progress: 50, stage: "Rating your drip..." });

    const { data, error } = await supabase.functions.invoke("rate-outfit", {
      body: { imageBase64, styleProfile: styleProfile || undefined },
    });

    if (activeAbort?.signal.aborted) return;
    updateGlobal({ progress: 90, stage: "Almost done..." });

    if (error) throw error;
    if (data?.error) { toast.error(data.error); updateGlobal({ analyzing: false, progress: 0, stage: "" }); return; }
    if (data?.result) {
      updateGlobal({ result: data.result, analyzing: false, progress: 0, stage: "" });
      saveDripToHistory(globalDripState.image || "", data.result, userId, imageHash);
    }
  } catch (err: any) {
    if (err?.name === "AbortError" || activeAbort?.signal.aborted) return;
    console.error("Rating error:", err);
    toast.error("Failed to analyze outfit. Please try again.");
    updateGlobal({ analyzing: false, progress: 0, stage: "" });
  } finally {
    activeAbort = null;
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

  const { image, imageBase64, analyzing, progress, stage, result, wardrobeItems } = globalDripState;

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
    runAnalysis(file, user?.id, styleProfile);
  };

  const cancelAnalysis = () => {
    if (activeAbort) activeAbort.abort();
    activeAbort = null;
    updateGlobal({ analyzing: false, image: null, imageBase64: null, result: null, progress: 0, stage: "" });
  };

  const clearImage = () => {
    updateGlobal({ image: null, imageBase64: null, result: null });
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><AppHeader /></motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h1 className="font-display text-2xl font-semibold text-foreground">Drip Check</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload or capture your outfit for styling insights</p>
        </motion.div>

        <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
        <input type="file" accept="image/*" capture="environment" ref={cameraFileRef} className="hidden" onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />

        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div key="upload" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl bg-card border border-border/30 overflow-hidden">
              <div className="aspect-[3/4] flex flex-col items-center justify-center gap-6 p-8">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                  <Camera size={32} className="text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium text-foreground">Capture Your Look</p>
                  <p className="text-sm text-muted-foreground">Take a photo or upload from gallery</p>
                </div>
                <div className="flex gap-3 w-full max-w-xs">
                  <button onClick={() => cameraFileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform">
                    <Camera size={16} /> Camera
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm active:scale-[0.98] transition-transform">
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
                  <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 w-full max-w-[200px]">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                        <Sparkles size={36} className="text-accent drop-shadow-[0_0_12px_hsl(var(--accent))]" />
                      </motion.div>
                      <div className="w-full space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs font-medium text-foreground drop-shadow-sm text-center">{stage}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : result ? (
                <div className="relative">
                  <button onClick={clearImage} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-foreground/60 text-primary-foreground flex items-center justify-center backdrop-blur-sm">
                    <X size={16} />
                  </button>
                  <OutfitRatingCard image={image} imageBase64={imageBase64 || undefined} result={result} wardrobeItems={wardrobeItems} />
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
      </div>
    </div>
  );
};

export default CameraScreen;
