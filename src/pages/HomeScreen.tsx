import { motion } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import ScoreRing from "../components/ScoreRing";
import OutfitCard from "../components/OutfitCard";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../hooks/useAuth";
import outfitPreview from "@/assets/outfit-preview.jpg";
import sampleTop from "@/assets/sample-top.jpg";
import sampleBottom from "@/assets/sample-bottom.jpg";
import sampleShoes from "@/assets/sample-shoes.jpg";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const HomeScreen = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-lg mx-auto space-y-6">
        {/* Greeting */}
        <motion.div variants={item}>
          <p className="text-muted-foreground text-sm font-medium">{greeting},</p>
          <h1 className="font-display text-2xl font-semibold text-foreground mt-0.5">Style Explorer</h1>
        </motion.div>

        {/* AI Outfit Preview */}
        <motion.div variants={item} className="glass-card-elevated overflow-hidden">
          <div className="relative">
            <img
              src={outfitPreview}
              alt="AI Generated Outfit"
              className="w-full h-72 object-cover object-top"
              loading="lazy"
            />
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1.5 rounded-full bg-foreground/70 text-primary-foreground text-[11px] font-medium backdrop-blur-sm">
                AI Generated Outfit
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Score Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <ScoreRing score={8.7} label="Overall" />
                <ScoreRing score={9.2} label="Color" size={70} colorClass="stroke-fashion-sage" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-foreground">8.7<span className="text-sm text-muted-foreground">/10</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">Better than 82% of people</p>
              </div>
            </div>

            {/* AI Explanation */}
            <div className="bg-secondary/50 rounded-xl p-3.5">
              <p className="text-sm text-secondary-foreground leading-relaxed">
                "This outfit balances neutral tones perfectly — ideal for a casual evening event. The blue shirt creates contrast with warm chinos."
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft transition-all duration-300 hover:shadow-card active:scale-[0.98]">
                <Sparkles size={16} />
                Style Me
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm transition-all duration-300 hover:bg-secondary/80 active:scale-[0.98]">
                <RefreshCw size={16} />
                Try Another
              </button>
            </div>
          </div>
        </motion.div>

        {/* Outfit Breakdown */}
        <motion.div variants={item}>
          <h2 className="text-base font-semibold text-foreground mb-3">Today's Picks</h2>
          <div className="grid grid-cols-3 gap-3">
            <OutfitCard image={sampleTop} label="Navy T-Shirt" type="Top" />
            <OutfitCard image={sampleBottom} label="Beige Chinos" type="Bottom" />
            <OutfitCard image={sampleShoes} label="White Sneakers" type="Shoes" />
          </div>
        </motion.div>

        {/* Style Profile Teaser */}
        <motion.div variants={item} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Your Style Identity</h3>
          <p className="text-xs text-muted-foreground mb-3">Based on your wardrobe analysis</p>
          <div className="flex gap-2 flex-wrap">
            {["Smart Casual", "Minimalist", "Earth Tones"].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
