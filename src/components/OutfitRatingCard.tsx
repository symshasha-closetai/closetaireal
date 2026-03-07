import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, ShoppingBag, Shirt, Footprints, Watch, Gem, Loader2, X } from "lucide-react";
import ScoreRing from "./ScoreRing";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Suggestion = {
  item_name: string;
  category: string;
  reason: string;
  wardrobe_item_id?: string;
  image_prompt?: string;
};

type RatingResult = {
  overall_score: number;
  overall_reason?: string;
  color_score: number;
  color_reason?: string;
  style_score: number;
  style_reason?: string;
  fit_score: number;
  fit_reason?: string;
  occasion: string;
  advice: string;
  praise_line?: string;
  wardrobe_suggestions: Suggestion[];
  shopping_suggestions: Suggestion[];
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

  const handleShare = async () => {
    const praise = result.praise_line ? `\n\n${result.praise_line}` : "";
    const text = `My outfit scored ${result.overall_score}/10! 🔥\n\nColor: ${result.color_score}/10 | Style: ${result.style_score}/10 | Fit: ${result.fit_score}/10\nOccasion: ${result.occasion}${praise}\n\n"${result.advice}"\n\nRated by ClosetAI`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Outfit Rating", text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Rating copied to clipboard!");
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Rating copied to clipboard!");
      }
    } catch {
      toast.info("Couldn't share — try copying manually");
    }
  };

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

  const scores = [
    { key: "overall", score: result.overall_score, label: "Overall", reason: result.overall_reason },
    { key: "color", score: result.color_score, label: "Color", size: 70, colorClass: "stroke-fashion-sage", reason: result.color_reason },
    { key: "style", score: result.style_score, label: "Style", size: 70, colorClass: "stroke-fashion-gold", reason: result.style_reason },
    { key: "fit", score: result.fit_score, label: "Fit", size: 70, colorClass: "stroke-fashion-rose", reason: result.fit_reason },
  ];

  return (
    <div className="space-y-4">
      {/* Shareable Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated overflow-hidden">
        {/* Photo + Score Overlay */}
        <div className="relative">
          <img src={image} alt="Outfit" className="w-full aspect-[3/4] object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/80 to-transparent pt-16 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-display font-semibold text-foreground">{result.overall_score}/10</p>
                <span className="px-3 py-1 rounded-full bg-secondary text-xs font-medium text-secondary-foreground">{result.occasion}</span>
              </div>
              <button type="button" onClick={handleShare} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform">
                <Share2 size={18} className="text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="p-5 space-y-4">
          {/* Gen Z Praise Line */}
          {result.praise_line && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="text-center py-2">
              <p className="text-base font-display font-semibold text-primary">{result.praise_line}</p>
            </motion.div>
          )}

          <div className="flex justify-around relative">
            {scores.map((s) => (
              <div key={s.key} className="relative">
                <button onClick={() => toggleTooltip(s.key)} className="focus:outline-none active:scale-95 transition-transform">
                  <ScoreRing score={s.score} label={s.label} size={s.size} colorClass={s.colorClass} />
                </button>
              </div>
            ))}
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
                  {scores.find(s => s.key === activeTooltip)?.reason || "No detailed reasoning available."}
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

              // Lazy-load AI image when visible
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
    </div>
  );
};

export default OutfitRatingCard;
