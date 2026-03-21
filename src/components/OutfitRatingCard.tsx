import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, ShoppingBag, Shirt, Footprints, Watch, Gem, Loader2, X, Info, Download, Heart, ScanLine, Check, Send } from "lucide-react";
import SendToFriendPicker from "./SendToFriendPicker";
import ScoreRing from "./ScoreRing";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RatingResult } from "@/pages/CameraScreen";

export type Suggestion = {
  item_name: string;
  category: string;
  reason: string;
  wardrobe_item_id?: string;
  image_prompt?: string;
};

export type DetectedItem = { name: string; type: string; color: string; material?: string; quality?: string; brand?: string; selected: boolean };

type WardrobeItem = {
  id: string;
  name: string | null;
  type: string;
  color: string | null;
  material: string | null;
  image_url: string;
};

type Props = {
  image: string;
  imageBase64?: string;
  result: RatingResult;
  wardrobeItems?: WardrobeItem[];
  wardrobeSuggestions: Suggestion[] | null;
  shoppingSuggestions: Suggestion[] | null;
  detectedItems: DetectedItem[] | null;
  suggestionImages: Record<number, string | null>;
  savedSuggestions: string[];
  onWardrobeSuggestionsChange: (v: Suggestion[] | null) => void;
  onShoppingSuggestionsChange: (v: Suggestion[] | null) => void;
  onDetectedItemsChange: (v: DetectedItem[] | null) => void;
  onSuggestionImagesChange: (v: Record<number, string | null>) => void;
  onSavedSuggestionsChange: (v: string[]) => void;
};

const categoryIcon = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes("top") || cat.includes("shirt") || cat.includes("jacket") || cat.includes("dress")) return Shirt;
  if (cat.includes("shoe") || cat.includes("boot") || cat.includes("sneaker") || cat.includes("bottom") || cat.includes("pant")) return Footprints;
  if (cat.includes("accessor") || cat.includes("jewelry") || cat.includes("bag")) return Gem;
  if (cat.includes("watch")) return Watch;
  return ShoppingBag;
};

const findWardrobeMatch = (suggestion: Suggestion, wardrobeItems: WardrobeItem[]): WardrobeItem | undefined => {
  if (suggestion.wardrobe_item_id) {
    const match = wardrobeItems.find(w => w.id === suggestion.wardrobe_item_id);
    if (match) return match;
  }
  const name = suggestion.item_name.toLowerCase();
  return wardrobeItems.find(w =>
    (w.name && w.name.toLowerCase().includes(name)) ||
    name.includes((w.name || "").toLowerCase()) ||
    (w.type.toLowerCase() === suggestion.category.toLowerCase())
  );
};

const OutfitRatingCard = ({ image, imageBase64, result, wardrobeItems = [],
  wardrobeSuggestions, shoppingSuggestions, detectedItems, suggestionImages, savedSuggestions,
  onWardrobeSuggestionsChange, onShoppingSuggestionsChange, onDetectedItemsChange, onSuggestionImagesChange, onSavedSuggestionsChange
}: Props) => {
  const { user } = useAuth();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // On-demand suggestion state
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);
  const [loadingShopping, setLoadingShopping] = useState(false);

  // Extract outfits state
  const [extracting, setExtracting] = useState(false);
  const [savingExtracted, setSavingExtracted] = useState(false);

  // Send to friend
  const [showSendPicker, setShowSendPicker] = useState(false);

  const fetchSuggestions = async (type: "wardrobe" | "shopping") => {
    const setLoading = type === "wardrobe" ? setLoadingWardrobe : setLoadingShopping;
    const setData = type === "wardrobe" ? onWardrobeSuggestionsChange : onShoppingSuggestionsChange;
    setLoading(true);
    try {
      const base64 = imageBase64?.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const { data, error } = await supabase.functions.invoke("generate-suggestions", {
        body: {
          imageBase64: base64,
          wardrobeItems: type === "wardrobe" ? wardrobeItems : undefined,
          styleProfile: undefined,
          type,
        },
      });
      if (error) throw error;
      setData(data?.suggestions || []);
    } catch (err) {
      console.error(`Failed to fetch ${type} suggestions:`, err);
      toast.error(`Failed to get ${type} suggestions`);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractOutfits = async () => {
    if (!imageBase64) return;
    setExtracting(true);
    try {
      const base64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const { data, error } = await supabase.functions.invoke("analyze-clothing", {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (data?.items?.length) {
        onDetectedItemsChange(data.items.map((item: any) => ({ ...item, selected: true })));
      } else {
        toast.info("No clothing items detected");
        onDetectedItemsChange([]);
      }
    } catch (err) {
      console.error("Extract outfits error:", err);
      toast.error("Failed to detect clothing items");
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveExtracted = async () => {
    if (!user || !detectedItems) return;
    const selected = detectedItems.filter(i => i.selected);
    if (!selected.length) { toast.info("Select at least one item"); return; }
    setSavingExtracted(true);
    try {
      const base64 = imageBase64?.includes(",") ? imageBase64?.split(",")[1] : imageBase64;
      for (const item of selected) {
        // Generate image for the item
        let imageUrl = "";
        try {
          const { data: imgData } = await supabase.functions.invoke("generate-clothing-image", {
            body: { name: item.name, type: item.type, color: item.color, material: item.material },
          });
          if (imgData?.imageUrl) imageUrl = imgData.imageUrl;
        } catch { /* use empty url */ }

        await supabase.from("wardrobe").insert({
          user_id: user.id,
          name: item.name,
          type: item.type,
          color: item.color || null,
          material: item.material || null,
          quality: item.quality || null,
          brand: item.brand || null,
          image_url: imageUrl || "https://placehold.co/200x200?text=Item",
        });
      }
      toast.success(`${selected.length} item(s) added to wardrobe!`);
      onDetectedItemsChange(null);
    } catch (err) {
      console.error("Save extracted error:", err);
      toast.error("Failed to save items");
    } finally {
      setSavingExtracted(false);
    }
  };

  const handleSaveSuggestion = async (type: "wardrobe" | "shopping", s: Suggestion, idx?: number) => {
    const key = `${type}-${s.item_name}`;
    if (!user || savedSuggestions.includes(key)) return;
    try {
      // Find the image URL for this suggestion
      let imageUrl: string | null = null;
      if (type === "shopping" && idx !== undefined && suggestionImages[idx]) {
        imageUrl = suggestionImages[idx];
      } else if (type === "wardrobe") {
        const match = findWardrobeMatch(s, wardrobeItems);
        if (match) imageUrl = match.image_url;
      }

      const suggestionData = {
        user_id: user.id,
        drip_score: result.drip_score,
        killer_tag: result.killer_tag || null,
        suggestion_type: type,
        item_name: s.item_name,
        category: s.category,
        reason: s.reason,
        image: imageUrl,
      };
      const { data, error } = await supabase.from("saved_suggestions" as any).insert(suggestionData as any).select().single();
      if (error) throw error;
      onSavedSuggestionsChange([...savedSuggestions, key]);
      // Sync to localStorage
      try {
        const cached = JSON.parse(localStorage.getItem("saved-suggestions") || "[]");
        cached.unshift(data);
        localStorage.setItem("saved-suggestions", JSON.stringify(cached));
      } catch {}
      toast.success("Suggestion saved!", { duration: 2000 });
    } catch {
      toast.error("Failed to save suggestion");
    }
  };

  const captureCard = useCallback(async (): Promise<Blob | null> => {
    const W = 390, H_IMG = 520, H_BOTTOM = 120;
    const canvas = document.createElement("canvas");
    canvas.width = W * 2;
    canvas.height = (H_IMG + H_BOTTOM) * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    // Draw outfit image
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = image;
    });
    ctx.drawImage(img, 0, 0, W, H_IMG);

    // Gradient overlay at bottom of image
    const grad = ctx.createLinearGradient(0, H_IMG - 120, 0, H_IMG);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, "rgba(26,26,26,0.9)");
    grad.addColorStop(1, "#1a1a1a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H_IMG - 120, W, 120);

    // Bottom panel
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, H_IMG, W, H_BOTTOM);

    // Brand text
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "500 10px Inter, sans-serif";
    ctx.letterSpacing = "5px";
    ctx.fillText("Dripd", 18, H_IMG - 90);

    // Drip score
    ctx.fillStyle = "#C9A96E";
    ctx.font = "500 36px Inter, sans-serif";
    ctx.fillText(String(result.drip_score), 24, H_IMG - 20);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "400 13px Inter, sans-serif";
    ctx.fillText("/10", 24 + ctx.measureText(String(result.drip_score)).width + 3, H_IMG - 20);
    ctx.fillStyle = "rgba(201,169,110,0.6)";
    ctx.font = "500 9px Inter, sans-serif";
    ctx.fillText("DRIP", 24, H_IMG - 8);

    // Confidence score
    ctx.fillStyle = "#A8A8A8";
    ctx.font = "500 36px Inter, sans-serif";
    const confText = String(result.confidence_rating);
    const confW = ctx.measureText(confText).width;
    ctx.fillText(confText, W - 24 - confW, H_IMG - 20);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "400 13px Inter, sans-serif";
    ctx.fillText("/10", W - 24 - confW + ctx.measureText(confText).width + 3, H_IMG - 20);
    ctx.fillStyle = "rgba(168,168,168,0.6)";
    ctx.font = "500 9px Inter, sans-serif";
    const confLabel = "CONFIDENCE";
    ctx.fillText(confLabel, W - 24 - ctx.measureText(confLabel).width, H_IMG - 8);

    // Killer tag (centered)
    if (result.killer_tag) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "500 11px Inter, sans-serif";
      const tagW = ctx.measureText(result.killer_tag).width;
      ctx.fillText(result.killer_tag, (W - tagW) / 2, H_IMG - 30);
    }

    // Sub-scores
    const subScores = [
      { label: "COLOR", score: result.color_score, color: "#8B9A7B" },
      { label: "STYLE", score: result.style_score, color: "#C9A96E" },
      { label: "FIT", score: result.fit_score, color: "#B08B8B" },
    ];
    const subY = H_IMG + 25;
    subScores.forEach((s, i) => {
      const x = W / 4 + (i * W / 4) - 10;
      ctx.fillStyle = s.color;
      ctx.font = "600 18px Inter, sans-serif";
      const scoreStr = Number.isInteger(s.score) ? String(s.score) : s.score.toFixed(1);
      const sw = ctx.measureText(scoreStr).width;
      ctx.fillText(scoreStr, x - sw / 2, subY);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "500 8px Inter, sans-serif";
      const lw = ctx.measureText(s.label).width;
      ctx.fillText(s.label, x - lw / 2, subY + 14);
    });

    // Separator line
    const sepGrad = ctx.createLinearGradient(24, 0, W - 24, 0);
    sepGrad.addColorStop(0, "transparent");
    sepGrad.addColorStop(0.3, "rgba(201,169,110,0.2)");
    sepGrad.addColorStop(0.7, "rgba(168,168,168,0.2)");
    sepGrad.addColorStop(1, "transparent");
    ctx.fillStyle = sepGrad;
    ctx.fillRect(24, H_IMG + 45, W - 48, 1);

    // Praise line
    if (result.praise_line) {
      ctx.fillStyle = "#999";
      ctx.font = "italic 400 13px Inter, sans-serif";
      const prW = ctx.measureText(result.praise_line).width;
      if (prW < W - 48) {
        ctx.fillText(result.praise_line, (W - prW) / 2, H_IMG + 68);
      } else {
        // Word wrap
        const words = result.praise_line.split(" ");
        let line = "";
        let y = H_IMG + 65;
        words.forEach(word => {
          const test = line + word + " ";
          if (ctx.measureText(test).width > W - 48) {
            const lw2 = ctx.measureText(line).width;
            ctx.fillText(line.trim(), (W - lw2) / 2, y);
            line = word + " ";
            y += 16;
          } else {
            line = test;
          }
        });
        if (line.trim()) {
          const lw2 = ctx.measureText(line).width;
          ctx.fillText(line.trim(), (W - lw2) / 2, y);
        }
      }
    }

    // CTA
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 10px Inter, sans-serif";
    const cta = "DRIPD.APP";
    const ctaW = ctx.measureText(cta).width;
    ctx.fillText(cta, (W - ctaW) / 2, H_IMG + H_BOTTOM - 10);

    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png", 1));
  }, [image, result]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await captureCard();
      if (!blob) throw new Error("Failed to create image");
      const file = new File([blob], "dripd-result.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Style Analysis — Dripd", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dripd-result.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image saved!");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.info("Couldn't share — try again");
    } finally {
      setSharing(false);
    }
  }, [sharing, captureCard]);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await captureCard();
      if (!blob) throw new Error("Failed to create image");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dripd-result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Result saved! 📸");
    } catch {
      toast.info("Couldn't download — try again");
    } finally {
      setDownloading(false);
    }
  }, [downloading, captureCard]);

  const toggleTooltip = (key: string) => {
    setActiveTooltip(prev => prev === key ? null : key);
  };

  const getCacheKey = (prompt: string) => `suggestion_img_${btoa(prompt).slice(0, 40)}`;
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  const generateSuggestionImage = async (idx: number, prompt: string) => {
    if (suggestionImages[idx] !== undefined || loadingImages[idx]) return;

    // Check localStorage cache first
    const cacheKey = getCacheKey(prompt);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { url, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && url) {
          onSuggestionImagesChange({ ...suggestionImages, [idx]: url });
          return;
        }
        localStorage.removeItem(cacheKey);
      }
    } catch { /* ignore parse errors */ }

    setLoadingImages(prev => ({ ...prev, [idx]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-suggestion-image", {
        body: { imagePrompt: prompt },
      });
      const imgUrl = data?.imageUrl || data?.imageBase64;
      if (!error && imgUrl) {
        onSuggestionImagesChange({ ...suggestionImages, [idx]: imgUrl });
        try { localStorage.setItem(cacheKey, JSON.stringify({ url: imgUrl, ts: Date.now() })); } catch { /* quota */ }
      } else {
        onSuggestionImagesChange({ ...suggestionImages, [idx]: null });
      }
    } catch {
      onSuggestionImagesChange({ ...suggestionImages, [idx]: null });
    } finally {
      setLoadingImages(prev => ({ ...prev, [idx]: false }));
    }
  };

  const subScores = [
    { key: "color", score: result.color_score, label: "Color", strokeColor: "#8B9A7B", reason: result.color_reason },
    { key: "style", score: result.style_score, label: "Style", strokeColor: "#C9A96E", reason: result.style_reason },
    { key: "fit", score: result.fit_score, label: "Fit", strokeColor: "#B08B8B", reason: result.fit_reason },
  ];

  const mainScores = [
    { key: "drip", reason: result.drip_reason },
    { key: "confidence", reason: result.confidence_reason },
  ];

  return (
    <div className="space-y-4">
      {/* Hero Photo Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl overflow-hidden shadow-lg relative">
        <img src={image} alt="Outfit" className="w-full aspect-[3/4] object-cover" />
        
        {/* ClosetAI branding */}
        <div className="absolute top-4 left-4 z-10">
          <span className="text-[10px] tracking-[0.2em] font-medium text-white/90" style={{ textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}>
            ClosetAI
          </span>
        </div>

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-20 pb-3 px-5">
          <div className="flex items-end justify-between">
            {/* Drip Score Ring */}
            <button onClick={() => toggleTooltip("drip")} className="focus:outline-none active:scale-95 transition-transform">
              <ScoreRing score={result.drip_score} size={64} strokeColor="#C9A96E" light />
              <p className="text-[9px] uppercase tracking-[0.15em] text-white/70 mt-1 text-center" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>Drip</p>
            </button>

            {/* Killer Tag */}
            {result.killer_tag && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              >
                <span className="text-[11px] font-medium tracking-wider text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)" }}>
                  {result.killer_tag}
                </span>
              </motion.div>
            )}

            {/* Confidence Ring */}
            <button onClick={() => toggleTooltip("confidence")} className="focus:outline-none active:scale-95 transition-transform">
              <ScoreRing score={result.confidence_rating} size={64} strokeColor="#A8A8A8" light />
              <p className="text-[9px] uppercase tracking-[0.15em] text-white/70 mt-1 text-center" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>Confidence</p>
            </button>
          </div>

          {/* Occasion Badge - inside photo */}
          {result.occasion && (
            <div className="flex justify-center mt-2">
              <span className="text-[10px] uppercase tracking-wider border border-white/30 rounded-full px-3 py-1 text-white/80" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                {result.occasion}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Analysis Section */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-card border border-border/30 p-6 space-y-5">
        {/* Drip/Confidence Tooltip */}
        <AnimatePresence>
          {(activeTooltip === "drip" || activeTooltip === "confidence") && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-card border border-border/50 rounded-xl p-3 relative shadow-sm"
            >
              <button onClick={() => setActiveTooltip(null)} className="absolute top-2 right-2">
                <X size={12} className="text-muted-foreground" />
              </button>
              <p className="text-xs font-medium text-foreground capitalize mb-1">
                {activeTooltip === "drip" ? "Drip Analysis" : "Confidence Analysis"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mainScores.find(s => s.key === activeTooltip)?.reason || "No detailed reasoning available."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-Score Rings */}
        <div className="flex justify-center gap-6">
          {subScores.map((s) => (
            <button key={s.key} onClick={() => toggleTooltip(s.key)} className="focus:outline-none active:scale-95 transition-transform flex flex-col items-center">
              <ScoreRing score={s.score} size={44} strokeColor={s.strokeColor} />
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mt-1">{s.label}</p>
            </button>
          ))}
        </div>
        <p className="text-[9px] text-center text-muted-foreground/40 -mt-1">Tap for details</p>

        {/* Sub-Score Tooltip */}
        <AnimatePresence>
          {subScores.some(s => s.key === activeTooltip) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-card border border-border/50 rounded-xl p-3 relative shadow-sm"
            >
              <button onClick={() => setActiveTooltip(null)} className="absolute top-2 right-2">
                <X size={12} className="text-muted-foreground" />
              </button>
              <p className="text-xs font-medium text-foreground capitalize mb-1">
                {subScores.find(s => s.key === activeTooltip)?.label} Analysis
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {subScores.find(s => s.key === activeTooltip)?.reason || "No detailed reasoning available."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Praise Line */}
        {result.praise_line && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center">
            <p className="text-sm italic text-foreground/70 leading-relaxed font-serif">
              {result.praise_line}
            </p>
          </motion.div>
        )}


        {/* Advice */}
        {result.advice && (
          <div className="border-t border-border/20 pt-4">
            <p className="text-sm text-foreground/60 leading-relaxed">{result.advice}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="border border-border/40 rounded-full px-5 py-2 text-xs tracking-wider text-foreground/70 flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            Share Result
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-9 h-9 rounded-full border border-border/40 flex items-center justify-center text-foreground/50 active:scale-95 transition-transform disabled:opacity-50"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setShowSendPicker(true)}
            className="w-9 h-9 rounded-full border border-border/40 flex items-center justify-center text-foreground/50 active:scale-95 transition-transform"
          >
            <Send size={14} />
          </button>
        </div>

        <SendToFriendPicker
          open={showSendPicker}
          onOpenChange={setShowSendPicker}
          contentType="drip_card"
          content={`Drip Score: ${result.drip_score}/10`}
          metadata={{ image_url: image, score: result.drip_score, killer_tag: result.killer_tag }}
        />
      </motion.div>

      {/* Extract Outfits Button */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
        {detectedItems === null ? (
          <button
            onClick={handleExtractOutfits}
            disabled={extracting}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl gradient-accent text-accent-foreground text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {extracting ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
            {extracting ? "Detecting items..." : "Extract Outfits to Wardrobe"}
          </button>
        ) : detectedItems.length > 0 ? (
          <div className="rounded-2xl bg-card border border-border/30 p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50">Detected Items</h3>
            <div className="space-y-2">
              {detectedItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onDetectedItemsChange(detectedItems?.map((d, j) => j === i ? { ...d, selected: !d.selected } : d) || null)}
                  className={`w-full border rounded-xl p-3 flex items-center gap-3 text-left transition-colors ${item.selected ? "border-primary/50 bg-primary/5" : "border-border/20"}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.selected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {item.selected && <Check size={12} className="text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type} · {item.color}{item.brand ? ` · ${item.brand}` : ""}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveExtracted}
              disabled={savingExtracted || !detectedItems.some(i => i.selected)}
              className="w-full py-3 rounded-xl gradient-accent text-accent-foreground text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {savingExtracted ? <Loader2 size={16} className="animate-spin inline mr-2" /> : null}
              {savingExtracted ? "Adding to wardrobe..." : `Add ${detectedItems.filter(i => i.selected).length} item(s) to Wardrobe`}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border/30 p-5 text-center">
            <p className="text-xs text-muted-foreground">No clothing items detected in this photo</p>
          </div>
        )}
      </motion.div>

      {/* On-Demand Suggestion Buttons */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
        {wardrobeSuggestions === null ? (
          <button
            onClick={() => fetchSuggestions("wardrobe")}
            disabled={loadingWardrobe}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-card border border-border/30 text-sm font-medium text-foreground/80 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loadingWardrobe ? <Loader2 size={16} className="animate-spin" /> : <Shirt size={16} />}
            {loadingWardrobe ? "Finding matches..." : "Get Wardrobe Suggestions"}
          </button>
        ) : wardrobeSuggestions.length > 0 ? (
          <div className="rounded-2xl bg-card border border-border/30 p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50">From Your Wardrobe</h3>
            <div className="space-y-2">
              {wardrobeSuggestions.map((s, i) => {
                const match = findWardrobeMatch(s, wardrobeItems);
                return (
                  <div key={i} className="border border-border/20 rounded-xl p-4 flex gap-3">
                    {match ? (
                      <img src={match.image_url} alt={s.item_name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Shirt size={18} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{s.item_name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 border border-border/30 rounded-full px-2 py-0.5 flex-shrink-0">{s.category}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.reason}</p>
                    </div>
                    <button onClick={() => handleSaveSuggestion("wardrobe", s)} className="flex-shrink-0 self-center active:scale-90 transition-transform">
                      <Heart size={16} className={savedSuggestions.includes(`wardrobe-${s.item_name}`) ? "fill-primary text-primary" : "text-muted-foreground"} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border/30 p-5 text-center">
            <p className="text-xs text-muted-foreground">No wardrobe suggestions found</p>
          </div>
        )}

        {shoppingSuggestions === null ? (
          <button
            onClick={() => fetchSuggestions("shopping")}
            disabled={loadingShopping}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-card border border-border/30 text-sm font-medium text-foreground/80 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loadingShopping ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
            {loadingShopping ? "Finding items..." : "Get Shopping Suggestions"}
          </button>
        ) : shoppingSuggestions.length > 0 ? (
          <div className="rounded-2xl bg-card border border-border/30 p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50">Shopping Suggestions</h3>
            <div className="space-y-2">
              {shoppingSuggestions.map((s, i) => {
                const Icon = categoryIcon(s.category);
                const imgSrc = suggestionImages[i];
                const isLoading = loadingImages[i];
                if (s.image_prompt && suggestionImages[i] === undefined && !loadingImages[i]) {
                  generateSuggestionImage(i, s.image_prompt);
                }
                return (
                  <div key={i} className="border border-border/20 rounded-xl p-4 flex gap-3">
                    {isLoading ? (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : imgSrc ? (
                      <img src={imgSrc} alt={s.item_name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{s.item_name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 border border-border/30 rounded-full px-2 py-0.5 flex-shrink-0">{s.category}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.reason}</p>
                    </div>
                    <button onClick={() => handleSaveSuggestion("shopping", s, i)} className="flex-shrink-0 self-center active:scale-90 transition-transform">
                      <Heart size={16} className={savedSuggestions.includes(`shopping-${s.item_name}`) ? "fill-primary text-primary" : "text-muted-foreground"} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border/30 p-5 text-center">
            <p className="text-xs text-muted-foreground">No shopping suggestions found</p>
          </div>
        )}
      </motion.div>

    </div>
  );
};

export default OutfitRatingCard;
