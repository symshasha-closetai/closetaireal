import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, ChevronRight, X, Shirt } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ScoreRing from "../components/ScoreRing";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const occasions = ["Party", "Casual", "Formal", "Date Night"];
const timeOfDay = ["Day", "Evening", "Night"];

type WardrobeItem = {
  id: string;
  image_url: string;
  type: string;
  name: string | null;
  color: string | null;
  material: string | null;
};

type OutfitSuggestion = {
  name: string;
  top_id?: string;
  bottom_id?: string;
  shoes_id?: string;
  accessories?: string[];
  score: number;
  explanation: string;
};

const HomeScreen = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const { profile, user } = useAuth();
  const displayName = profile?.name || "there";
  const navigate = useNavigate();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [allWardrobeItems, setAllWardrobeItems] = useState<WardrobeItem[]>([]);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [selectedOccasion, setSelectedOccasion] = useState("Party");
  const [selectedTime, setSelectedTime] = useState("Evening");
  const [styling, setStyling] = useState(false);
  const [outfitSuggestions, setOutfitSuggestions] = useState<OutfitSuggestion[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from("wardrobe")
        .select("id, image_url, type, name, color, material")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setAllWardrobeItems(data || []);
          setWardrobeItems((data || []).slice(0, 6));
        });
      supabase
        .from("wardrobe")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .then(({ count }) => setWardrobeCount(count || 0));
    }
  }, [user]);

  const categoryCounts = wardrobeItems.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleStyleMe = async () => {
    if (allWardrobeItems.length < 2) {
      toast.error("Add at least 2 items to your wardrobe first!");
      return;
    }
    setStyling(true);
    try {
      // Fetch style profile
      let styleProfile = null;
      if (user) {
        const { data } = await supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle();
        styleProfile = data;
      }

      const { data, error } = await supabase.functions.invoke("style-me", {
        body: {
          wardrobeItems: allWardrobeItems,
          occasion: selectedOccasion,
          timeOfDay: selectedTime,
          styleProfile,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.outfits?.length) {
        setOutfitSuggestions(data.outfits);
        setShowResults(true);
      } else {
        toast.error("No outfits generated. Try adding more items.");
      }
    } catch (err) {
      console.error("Style me error:", err);
      toast.error("Failed to generate outfits. Please try again.");
    } finally {
      setStyling(false);
    }
  };

  const getItemById = (id?: string) => allWardrobeItems.find(i => i.id === id);

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <input type="file" accept="image/*" capture="user" className="hidden" />

      <motion.div variants={container} initial="hidden" animate="show" className="max-w-lg mx-auto space-y-5">
        <motion.div variants={item}><AppHeader /></motion.div>

        <motion.div variants={item} className="text-center">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {greeting}, {displayName}!
          </h1>
        </motion.div>

        {/* My Wardrobe */}
        <motion.div variants={item} className="glass-card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">My Wardrobe</h2>
            <span className="text-sm text-muted-foreground font-medium">{wardrobeCount}</span>
          </div>
          {wardrobeItems.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {wardrobeItems.slice(0, 5).map((wi) => (
                <div key={wi.id} className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-secondary">
                  <img src={wi.image_url} alt={wi.name || wi.type} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 bg-foreground/40 backdrop-blur-sm px-1 py-0.5">
                    <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{wi.type}</p>
                  </div>
                </div>
              ))}
              <button onClick={() => navigate("/wardrobe")} className="flex-shrink-0 w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button onClick={() => navigate("/wardrobe")} className="w-full py-4 rounded-xl bg-secondary text-sm text-muted-foreground">
              Add your first clothing item →
            </button>
          )}
          <div className="flex gap-3 mt-3">
            {["Tops", "Bottoms", "Dresses", "Shoes"].map((cat) => (
              <div key={cat} className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">{cat}</span>
                <span className="text-[11px] font-semibold text-foreground">{categoryCounts[cat] || 0}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Occasion */}
        <motion.div variants={item} className="glass-card p-4">
          <h2 className="text-base font-semibold text-foreground mb-3">Pick an Occasion</h2>
          <div className="flex gap-2 flex-wrap">
            {occasions.map((occ) => (
              <button key={occ} onClick={() => setSelectedOccasion(occ)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ${selectedOccasion === occ ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>{occ}</button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {timeOfDay.map((t) => (
              <button key={t} onClick={() => setSelectedTime(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ${selectedTime === t ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{t}</button>
            ))}
          </div>
        </motion.div>

        {/* Person / Style Me Preview */}
        <motion.div variants={item} className="glass-card-elevated overflow-hidden">
          {profile?.avatar_url ? (
            <div className="relative h-64 overflow-hidden">
              <img src={profile.avatar_url} alt="Your photo" className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-sm font-medium text-foreground">Your style, elevated by AI</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedOccasion} · {selectedTime}</p>
              </div>
            </div>
          ) : (
            <div className="h-48 bg-secondary flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Upload a profile photo</p>
                <p className="text-xs text-muted-foreground mt-1">to see AI makeover suggestions</p>
                <button onClick={() => navigate("/profile")} className="mt-3 px-4 py-2 rounded-full bg-foreground/10 text-xs font-medium text-foreground">Go to Profile</button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Rate Your Outfit */}
        <motion.div variants={item} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Camera size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Rate Your Outfit</h3>
              <p className="text-xs text-muted-foreground">Snap a photo and get AI feedback</p>
            </div>
            <button onClick={() => navigate("/camera")} className="px-4 py-2 rounded-full gradient-accent text-accent-foreground text-xs font-medium shadow-soft active:scale-95 transition-transform">
              <Camera size={14} className="inline mr-1" /> Rate
            </button>
          </div>
        </motion.div>

        {/* Style Me Button */}
        <motion.div variants={item}>
          <button onClick={handleStyleMe} disabled={styling} className="w-full py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
            {styling ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                  <Sparkles size={20} />
                </motion.div>
                Styling...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Style Me
              </>
            )}
          </button>
        </motion.div>
      </motion.div>

      {/* Style Me Results Sheet */}
      <AnimatePresence>
        {showResults && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setShowResults(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-card rounded-t-3xl shadow-elevated p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">AI Outfit Suggestions</h2>
                <button onClick={() => setShowResults(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{selectedOccasion} · {selectedTime}</p>

              {outfitSuggestions.map((outfit, idx) => {
                const top = getItemById(outfit.top_id);
                const bottom = getItemById(outfit.bottom_id);
                const shoes = getItemById(outfit.shoes_id);
                const accessoryItems = (outfit.accessories || []).map(id => getItemById(id)).filter(Boolean);

                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">{outfit.name}</h3>
                      <div className="flex items-center gap-1">
                        <Sparkles size={14} className="text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{outfit.score}/10</span>
                      </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {[top, bottom, shoes, ...accessoryItems].filter(Boolean).map((wi) => (
                        <div key={wi!.id} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-secondary">
                          <img src={wi!.image_url} alt={wi!.name || wi!.type} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-foreground/40 backdrop-blur-sm px-1 py-0.5">
                            <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{wi!.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{outfit.explanation}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
