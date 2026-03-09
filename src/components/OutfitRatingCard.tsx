import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, ShoppingBag, Shirt, Footprints, Watch, Gem, Loader2, X, Info } from "lucide-react";
import ScoreRing from "./ScoreRing";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import type { RatingResult } from "@/pages/CameraScreen";

type Suggestion = {
  item_name: string;
  category: string;
  reason: string;
  wardrobe_item_id?: string;
  image_prompt?: string;
};

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
  result: RatingResult;
  wardrobeItems?: WardrobeItem[];
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

const OutfitRatingCard = ({ image, result, wardrobeItems = [] }: Props) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [suggestionImages, setSuggestionImages] = useState<Record<number, string | null>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [sharing, setSharing] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // Convert blob/object URL to base64 for html2canvas
  const imageToBase64 = useCallback(async (url: string): Promise<string> => {
    if (url.startsWith("data:")) return url;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }, []);

  const [shareImageBase64, setShareImageBase64] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);

    // Convert image to base64 first
    const base64 = await imageToBase64(image);
    setShareImageBase64(base64);
    setShowShareCard(true);

    // Wait for the hidden share card to render
    await new Promise(r => setTimeout(r, 500));

    try {
      if (!shareRef.current) throw new Error("Share card not ready");

      const canvas = await html2canvas(shareRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2,
      });

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, "image/png", 1)
      );

      if (!blob) throw new Error("Failed to create image");

      const file = new File([blob], "drip-check.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "My Drip Check",
          files: [file],
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "drip-check.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image saved!");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.info("Couldn't share — try again");
      }
    } finally {
      setShowShareCard(false);
      setSharing(false);
    }
  }, [sharing, result, image]);

  const toggleTooltip = (key: string) => {
    setActiveTooltip(prev => prev === key ? null : key);
  };

  const generateSuggestionImage = async (idx: number, prompt: string) => {
    if (suggestionImages[idx] !== undefined || loadingImages[idx]) return;
    setLoadingImages(prev => ({ ...prev, [idx]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-suggestion-image", {
        body: { imagePrompt: prompt },
      });
      if (!error && data?.imageBase64) {
        setSuggestionImages(prev => ({ ...prev, [idx]: data.imageBase64 }));
      } else {
        setSuggestionImages(prev => ({ ...prev, [idx]: null }));
      }
    } catch {
      setSuggestionImages(prev => ({ ...prev, [idx]: null }));
    } finally {
      setLoadingImages(prev => ({ ...prev, [idx]: false }));
    }
  };

  const subScores = [
    { key: "color", score: result.color_score, label: "Color", colorClass: "stroke-fashion-sage", reason: result.color_reason },
    { key: "style", score: result.style_score, label: "Style", colorClass: "stroke-fashion-gold", reason: result.style_reason },
    { key: "fit", score: result.fit_score, label: "Fit", colorClass: "stroke-fashion-rose", reason: result.fit_reason },
  ];

  return (
    <div className="space-y-4">
      {/* Main Shareable Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated overflow-hidden">
        {/* Photo with Killer Tag Overlay */}
        <div className="relative">
          <img src={image} alt="Outfit" className="w-full aspect-[3/4] object-cover" />
          
          {/* App name top-left */}
          <div className="absolute top-3 left-3">
            <span className="text-xs font-bold tracking-wider text-white/90 drop-shadow-lg bg-foreground/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
              ClosetAI
            </span>
          </div>

          {/* Killer Tag — bold overlay on photo */}
          {result.killer_tag && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: -6 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
              className="absolute bottom-24 right-4 z-10"
            >
              <div className="bg-accent/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg transform">
                <span className="text-base font-display font-bold text-accent-foreground tracking-wide">
                  {result.killer_tag} 🔥
                </span>
              </div>
            </motion.div>
          )}

          {/* Bottom gradient with Drip Score + Confidence */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/80 to-transparent pt-16 pb-4 px-4">
            <div className="flex items-end justify-between">
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-display font-bold text-foreground">{result.drip_score}</span>
                  <span className="text-sm text-muted-foreground font-medium">/10</span>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drip Score</p>
              </div>
              <div className="text-right space-y-1.5">
                <div className="flex items-baseline gap-1.5 justify-end">
                  <span className="text-3xl font-display font-bold text-foreground">{result.confidence_rating}</span>
                  <span className="text-sm text-muted-foreground font-medium">/10</span>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confidence</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="px-3 py-1 rounded-full bg-secondary text-xs font-medium text-secondary-foreground">{result.occasion}</span>
              <button type="button" onClick={handleShare} disabled={sharing} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                {sharing ? <Loader2 size={18} className="animate-spin text-foreground" /> : <Share2 size={18} className="text-foreground" />}
              </button>
            </div>
          </div>
        </div>

        {/* Scores Section */}
        <div className="p-5 space-y-4">
          {/* Praise Line */}
          {result.praise_line && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="text-center py-2">
              <p className="text-base font-display font-semibold text-primary">"{result.praise_line}"</p>
            </motion.div>
          )}

          {/* Sub-scores with tap hint */}
          <div className="relative">
            <div className="flex justify-around">
              {subScores.map((s) => (
                <div key={s.key} className="relative">
                  <button onClick={() => toggleTooltip(s.key)} className="focus:outline-none active:scale-95 transition-transform">
                    <ScoreRing score={s.score} label={s.label} size={70} colorClass={s.colorClass} />
                  </button>
                </div>
              ))}
            </div>
            {/* Tap for details hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="flex items-center justify-center gap-1 mt-2"
            >
              <Info size={10} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Tap scores for details</span>
            </motion.div>
          </div>

          {/* Score Tooltip */}
          <AnimatePresence>
            {activeTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-foreground/80 backdrop-blur-md rounded-xl p-3 relative"
              >
                <button onClick={() => setActiveTooltip(null)} className="absolute top-2 right-2">
                  <X size={12} className="text-background/60" />
                </button>
                <p className="text-xs font-semibold text-background capitalize mb-1">{activeTooltip}</p>
                <p className="text-xs text-background/80 leading-relaxed">
                  {subScores.find(s => s.key === activeTooltip)?.reason || "No detailed reasoning available."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-secondary/50 rounded-xl p-3.5">
            <p className="text-sm text-secondary-foreground leading-relaxed">"{result.advice}"</p>
          </div>
        </div>
      </motion.div>

      {/* Wardrobe Suggestions */}
      {result.wardrobe_suggestions?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shirt size={18} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">From Your Wardrobe</h3>
          </div>
          <div className="space-y-2">
            {result.wardrobe_suggestions.map((s, i) => {
              const match = findWardrobeMatch(s, wardrobeItems);
              return (
                <div key={i} className="bg-secondary/50 rounded-xl p-3 flex gap-3">
                  {match ? (
                    <img src={match.image_url} alt={s.item_name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Shirt size={20} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{s.item_name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground flex-shrink-0">{s.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Shopping Suggestions */}
      {result.shopping_suggestions?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Shopping Suggestions</h3>
          </div>
          <div className="space-y-2">
            {result.shopping_suggestions.map((s, i) => {
              const Icon = categoryIcon(s.category);
              const imgSrc = suggestionImages[i];
              const isLoading = loadingImages[i];

              if (s.image_prompt && suggestionImages[i] === undefined && !loadingImages[i]) {
                generateSuggestionImage(i, s.image_prompt);
              }

              return (
                <div key={i} className="bg-secondary/50 rounded-xl p-3 flex gap-3">
                  {isLoading ? (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : imgSrc ? (
                    <img src={imgSrc} alt={s.item_name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon size={22} className="text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{s.item_name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground flex-shrink-0">{s.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Hidden Share Card for html2canvas capture */}
      {showShareCard && (
        <div
          ref={shareRef}
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: 390,
            zIndex: -1,
            background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            borderRadius: 24,
            overflow: "hidden",
            fontFamily: "'Inter', 'Montserrat', sans-serif",
          }}
        >
          {/* Photo with overlay */}
          <div style={{ position: "relative" }}>
            <img src={image} alt="Outfit" style={{ width: 390, height: 520, objectFit: "cover", display: "block" }} crossOrigin="anonymous" />
            
            {/* Brand top-left */}
            <div style={{ position: "absolute", top: 16, left: 16 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.9)",
                background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
                padding: "5px 12px", borderRadius: 20,
              }}>
                ClosetAI
              </span>
            </div>

            {/* Killer Tag */}
            {result.killer_tag && (
              <div style={{
                position: "absolute", top: 60, right: 16,
                background: "rgba(232,121,249,0.9)", backdropFilter: "blur(8px)",
                padding: "8px 16px", borderRadius: 14, transform: "rotate(-6deg)",
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
                  {result.killer_tag} 🔥
                </span>
              </div>
            )}

            {/* Bottom gradient with scores */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(to top, #1a1a2e 0%, rgba(26,26,46,0.85) 60%, transparent 100%)",
              padding: "60px 20px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{result.drip_score}</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>/10</span>
                  </div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginTop: 2 }}>Drip Score</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{result.confidence_rating}</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>/10</span>
                  </div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginTop: 2 }}>Confidence</p>
                </div>
              </div>
              {result.occasion && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: 20 }}>
                    {result.occasion}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sub-scores */}
          <div style={{ display: "flex", justifyContent: "space-around", padding: "20px 16px 12px" }}>
            {[
              { label: "Color", score: result.color_score, color: "#86efac" },
              { label: "Style", score: result.style_score, color: "#fbbf24" },
              { label: "Fit", score: result.fit_score, color: "#f9a8d4" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  border: `3px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto",
                }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                    {Number.isInteger(s.score) ? s.score : s.score.toFixed(1)}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 500, marginTop: 6, display: "block" }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "0 20px" }} />

          {/* Praise line */}
          {result.praise_line && (
            <div style={{ padding: "16px 20px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#e0e7ff", fontStyle: "italic", lineHeight: 1.5 }}>
                🔥 "{result.praise_line}" ✨
              </p>
            </div>
          )}

          {/* CTA */}
          <div style={{ padding: "8px 20px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
              Check your drip score → <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>closetaireal.lovable.app</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutfitRatingCard;
