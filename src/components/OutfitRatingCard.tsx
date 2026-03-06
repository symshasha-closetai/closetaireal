import { motion } from "framer-motion";
import { Share2, ShoppingBag, Shirt, Footprints, Watch, Gem } from "lucide-react";
import ScoreRing from "./ScoreRing";
import { toast } from "sonner";

type Suggestion = {
  item_name: string;
  category: string;
  reason: string;
  wardrobe_item_id?: string;
};

type RatingResult = {
  overall_score: number;
  color_score: number;
  style_score: number;
  fit_score: number;
  occasion: string;
  advice: string;
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
  // Match by ID first
  if (suggestion.wardrobe_item_id) {
    const match = wardrobeItems.find(w => w.id === suggestion.wardrobe_item_id);
    if (match) return match;
  }
  // Fuzzy match by name/type
  const name = suggestion.item_name.toLowerCase();
  return wardrobeItems.find(w =>
    (w.name && w.name.toLowerCase().includes(name)) ||
    name.includes((w.name || "").toLowerCase()) ||
    (w.type.toLowerCase() === suggestion.category.toLowerCase())
  );
};

const OutfitRatingCard = ({ image, result, wardrobeItems = [] }: Props) => {
  const handleShare = async () => {
    const text = `My outfit scored ${result.overall_score}/10! 🔥\n\nColor: ${result.color_score}/10 | Style: ${result.style_score}/10 | Fit: ${result.fit_score}/10\nOccasion: ${result.occasion}\n\n"${result.advice}"\n\nRated by ClosetAI`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Outfit Rating", text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Rating copied to clipboard!");
      } else {
        // Fallback: create a temporary textarea
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
          <div className="flex justify-around">
            <ScoreRing score={result.overall_score} label="Overall" />
            <ScoreRing score={result.color_score} label="Color" size={70} colorClass="stroke-fashion-sage" />
            <ScoreRing score={result.style_score} label="Style" size={70} colorClass="stroke-fashion-gold" />
            <ScoreRing score={result.fit_score} label="Fit" size={70} colorClass="stroke-fashion-rose" />
          </div>

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
              return (
                <div key={i} className="bg-secondary/50 rounded-xl p-3 flex gap-3">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={22} className="text-primary" />
                  </div>
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
