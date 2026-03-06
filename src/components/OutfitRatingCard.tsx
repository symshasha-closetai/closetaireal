import { motion } from "framer-motion";
import { Share2, ShoppingBag, Shirt } from "lucide-react";
import ScoreRing from "./ScoreRing";
import { toast } from "sonner";

type Suggestion = {
  item_name: string;
  category: string;
  reason: string;
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

type Props = {
  image: string;
  result: RatingResult;
};

const OutfitRatingCard = ({ image, result }: Props) => {
  const handleShare = async () => {
    const text = `My outfit scored ${result.overall_score}/10! 🔥\n\nColor: ${result.color_score}/10 | Style: ${result.style_score}/10 | Fit: ${result.fit_score}/10\nOccasion: ${result.occasion}\n\n"${result.advice}"\n\nRated by ClosetAI`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Outfit Rating", text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Rating copied to clipboard!");
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
              <button onClick={handleShare} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform">
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
            {result.wardrobe_suggestions.map((s, i) => (
              <div key={i} className="bg-secondary/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{s.item_name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">{s.category}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </div>
            ))}
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
            {result.shopping_suggestions.map((s, i) => (
              <div key={i} className="bg-secondary/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{s.item_name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">{s.category}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default OutfitRatingCard;
