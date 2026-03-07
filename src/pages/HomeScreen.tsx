import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, ChevronRight, X, Heart, GraduationCap, PartyPopper, Shirt, Palette, Music, Church, Briefcase, Sun, Moon, Sunset } from "lucide-react";
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

const occasions = [
  { label: "Casual", icon: Shirt, color: "bg-blue-100 text-blue-600" },
  { label: "Party", icon: PartyPopper, color: "bg-pink-100 text-pink-600" },
  { label: "Formal", icon: Briefcase, color: "bg-gray-100 text-gray-600" },
  { label: "Date Night", icon: Heart, color: "bg-red-100 text-red-600" },
  { label: "College", icon: GraduationCap, color: "bg-green-100 text-green-600" },
  { label: "Cultural", icon: Church, color: "bg-amber-100 text-amber-600" },
  { label: "Festival", icon: Music, color: "bg-purple-100 text-purple-600" },
  { label: "Creative", icon: Palette, color: "bg-teal-100 text-teal-600" },
];

const timeOfDay = [
  { label: "Day", icon: Sun },
  { label: "Evening", icon: Sunset },
  { label: "Night", icon: Moon },
];

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
  tryon_image?: string;
};

const HomeScreen = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const { profile, styleProfile, user } = useAuth();
  const displayName = profile?.name || "there";
  const navigate = useNavigate();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [allWardrobeItems, setAllWardrobeItems] = useState<WardrobeItem[]>([]);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [selectedOccasion, setSelectedOccasion] = useState("Casual");
  const [selectedTime, setSelectedTime] = useState("Day");
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

  const categoryCounts = allWardrobeItems.reduce((acc, it) => {
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
      let sp = null;
      if (user) {
        const { data } = await supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle();
        sp = data;
      }

      const { data, error } = await supabase.functions.invoke("style-me", {
        body: {
          wardrobeItems: allWardrobeItems,
          occasion: selectedOccasion,
          timeOfDay: selectedTime,
          styleProfile: sp,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      if (data?.outfits?.length) {
        setOutfitSuggestions(data.outfits);
        setShowResults(true);

        // Generate virtual try-on for the first outfit
        if (styleProfile?.model_image_url && user) {
          generateTryOn(data.outfits[0], 0);
        }
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

  const generateTryOn = async (outfit: OutfitSuggestion, idx: number) => {
    if (!styleProfile?.model_image_url || !user) return;
    try {
      const items = [outfit.top_id, outfit.bottom_id, outfit.shoes_id, ...(outfit.accessories || [])]
        .map(id => allWardrobeItems.find(w => w.id === id))
        .filter(Boolean);

      const desc = items.map(i => `${i!.name || i!.type} (${i!.color || ""} ${i!.material || ""})`).join(", ");

      const { data } = await supabase.functions.invoke("virtual-tryon", {
        body: {
          modelImageUrl: styleProfile.model_image_url,
          outfitDescription: desc,
          occasion: selectedOccasion,
          userId: user.id,
        },
      });

      if (data?.imageUrl || data?.imageBase64) {
        setOutfitSuggestions(prev =>
          prev.map((o, i) => i === idx ? { ...o, tryon_image: data.imageUrl || data.imageBase64 } : o)
        );
      }
    } catch (err) {
      console.error("Try-on error:", err);
    }
  };

  const getItemById = (id?: string) => allWardrobeItems.find(i => i.id === id);
  const currentOccasion = occasions.find(o => o.label === selectedOccasion) || occasions[0];
  const CurrentOccIcon = currentOccasion.icon;

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <input type="file" accept="image/*" capture="user" className="hidden" />

      <motion.div variants={container} initial="hidden" animate="show" className="max-w-lg mx-auto space-y-5">
        <motion.div variants={item}><AppHeader /></motion.div>

        {/* Greeting */}
        <motion.div variants={item}>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {greeting}, {displayName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Let's find your perfect outfit today</p>
        </motion.div>

        {/* My Wardrobe Card */}
        <motion.div variants={item} className="glass-card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">My Wardrobe</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-xs font-bold text-foreground">{wardrobeCount}</span>
          </div>
          {wardrobeItems.length > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {wardrobeItems.slice(0, 4).map((wi) => (
                  <div key={wi.id} className="relative aspect-square rounded-xl overflow-hidden bg-secondary">
                    <img src={wi.image_url} alt={wi.name || wi.type} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute bottom-0 left-0 right-0 bg-foreground/40 backdrop-blur-sm px-1 py-0.5">
                      <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{wi.type}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  {["Tops", "Bottoms", "Dresses", "Shoes"].map((cat) => (
                    <div key={cat} className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{cat}</span>
                      <span className="text-[10px] font-bold text-foreground">{categoryCounts[cat] || 0}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate("/wardrobe")} className="flex items-center gap-0.5 text-xs font-medium text-primary">
                  View all <ChevronRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => navigate("/wardrobe")} className="w-full py-6 rounded-xl bg-secondary text-sm text-muted-foreground">
              Add your first clothing item →
            </button>
          )}
        </motion.div>

        {/* Pick an Occasion */}
        <motion.div variants={item} className="glass-card overflow-hidden">
          <div className="p-4 pb-3">
            <h2 className="text-base font-semibold text-foreground mb-3">Pick an Occasion</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {occasions.map((occ) => {
                const OccIcon = occ.icon;
                const isSelected = selectedOccasion === occ.label;
                return (
                  <button
                    key={occ.label}
                    onClick={() => setSelectedOccasion(occ.label)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0 transition-all ${
                      isSelected ? "gradient-accent shadow-soft" : "bg-secondary"
                    }`}
                  >
                    <OccIcon size={18} className={isSelected ? "text-accent-foreground" : "text-muted-foreground"} />
                    <span className={`text-[10px] font-medium ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`}>{occ.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Image + Occasion */}
          <div className="relative h-52 bg-secondary overflow-hidden">
            {styleProfile?.model_image_url ? (
              <img src={styleProfile.model_image_url} alt="Your AI Model" className="w-full h-full object-cover object-top" />
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="You" className="w-full h-full object-cover object-top" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <CurrentOccIcon size={48} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{selectedOccasion}</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/60 to-transparent pt-10 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedOccasion} Look</p>
                  <p className="text-[11px] text-muted-foreground">{selectedTime} · Your style, elevated</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentOccasion.color}`}>
                  <CurrentOccIcon size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* Time of Day */}
          <div className="px-4 py-3 flex gap-2">
            {timeOfDay.map((t) => {
              const TIcon = t.icon;
              return (
                <button
                  key={t.label}
                  onClick={() => setSelectedTime(t.label)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                    selectedTime === t.label ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <TIcon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>
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
              <><Sparkles size={20} /> Style Me</>
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
                  <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card overflow-hidden">
                    {/* Try-on Image */}
                    {outfit.tryon_image && (
                      <div className="h-64 overflow-hidden">
                        <img src={outfit.tryon_image} alt="Virtual try-on" className="w-full h-full object-cover object-top" />
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{outfit.name}</h3>
                        <div className="flex items-center gap-1">
                          <Sparkles size={14} className="text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{outfit.score}/10</span>
                        </div>
                      </div>

                      <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {[top, bottom, shoes, ...accessoryItems].filter(Boolean).map((wi) => (
                          <div key={wi!.id} className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-secondary">
                            <img src={wi!.image_url} alt={wi!.name || wi!.type} className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 left-0 right-0 bg-foreground/40 backdrop-blur-sm px-1 py-0.5">
                              <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{wi!.type}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{outfit.explanation}</p>

                      {/* Generate try-on for this outfit */}
                      {!outfit.tryon_image && styleProfile?.model_image_url && (
                        <button
                          onClick={() => generateTryOn(outfit, idx)}
                          className="text-xs font-medium text-primary flex items-center gap-1"
                        >
                          <Sparkles size={12} /> Generate try-on preview
                        </button>
                      )}
                    </div>
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
