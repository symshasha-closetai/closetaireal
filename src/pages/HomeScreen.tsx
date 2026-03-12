import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, ChevronRight, X, Heart, GraduationCap, PartyPopper, Shirt, Palette, Music, Church, Briefcase, Sun, Moon, Sunset, CloudRain, Thermometer, CloudSun, Snowflake, Shuffle, Leaf, Smile, Droplet, User, Loader2 } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ScoreRing from "../components/ScoreRing";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";


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

const weatherOptions = [
  { label: "Hot", icon: Thermometer, emoji: "🔥" },
  { label: "Warm", icon: CloudSun, emoji: "☀️" },
  { label: "Cool", icon: CloudSun, emoji: "🍃" },
  { label: "Cold", icon: Snowflake, emoji: "❄️" },
  { label: "Rainy", icon: CloudRain, emoji: "🌧️" },
];

type WardrobeItem = {
  id: string;
  image_url: string;
  type: string;
  name: string | null;
  color: string | null;
  material: string | null;
};

type OutfitReasoning = {
  season?: string;
  mood?: string;
  time_of_day?: string;
  color_combination?: string;
  body_type?: string;
  skin_tone?: string;
};

type ScoreBreakdown = {
  color?: number;
  occasion?: number;
  season?: number;
  body_type?: number;
  skin_tone?: number;
  fabric?: number;
};

type OutfitSuggestion = {
  name: string;
  top_id?: string;
  bottom_id?: string;
  shoes_id?: string;
  accessories?: string[];
  score: number;
  explanation: string;
  reasoning?: OutfitReasoning;
  score_breakdown?: ScoreBreakdown;
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
  const [selectedWeather, setSelectedWeather] = useState("Warm");
  const [styling, setStyling] = useState(false);
  const [surprising, setSurprising] = useState(false);
  const [outfitSuggestions, setOutfitSuggestions] = useState<OutfitSuggestion[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [fullSizeModelUrl, setFullSizeModelUrl] = useState<string | null>(null);
  const [generatingModel, setGeneratingModel] = useState(false);
  const [generatingTryOnIdx, setGeneratingTryOnIdx] = useState<number | null>(null);

  // Progress tracking
  const [progressStage, setProgressStage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);

  // Cache helpers
  const getCached = <T,>(key: string, ttlMs: number): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > ttlMs) { localStorage.removeItem(key); return null; }
      return data as T;
    } catch { return null; }
  };
  const setCache = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
  };

  useEffect(() => {
    if (user) {
      const cacheKey = `wardrobe_cache_${user.id}`;
      const cached = getCached<WardrobeItem[]>(cacheKey, 5 * 60 * 1000);
      if (cached) {
        setAllWardrobeItems(cached);
        setWardrobeItems(cached.slice(0, 6));
        setWardrobeCount(cached.length);
      }
      // Always fetch in background to keep fresh
      supabase
        .from("wardrobe")
        .select("id, image_url, type, name, color, material")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          const items = data || [];
          setAllWardrobeItems(items);
          setWardrobeItems(items.slice(0, 6));
          setWardrobeCount(items.length);
          setCache(cacheKey, items);
        });
    }
  }, [user]);

  const categoryCounts = allWardrobeItems.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const fetchStyleProfile = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle();
    return data;
  }, [user]);

  const generateModelAvatar = useCallback(async (sp: any) => {
    if (!user || !styleProfile?.model_image_url) return null;
    setGeneratingModel(true);
    try {
      const bodyAnalysis = sp?.ai_body_analysis as any;
      const desc = bodyAnalysis
        ? `${bodyAnalysis.body_type || ""} build, ${bodyAnalysis.skin_tone || ""} skin tone, ${bodyAnalysis.face_shape || ""} face`
        : "average build";

      const { data, error } = await supabase.functions.invoke("generate-model-avatar", {
        body: {
          modelDescription: desc,
          userId: user.id,
          occasion: selectedOccasion,
          gender: sp?.gender || undefined,
          facePhotoUrl: sp?.face_photo_url || sp?.body_photo_url || null,
          bodyPhotoUrl: sp?.body_photo_url || null,
        },
      });
      if (!error && data?.imageUrl) {
        setFullSizeModelUrl(data.imageUrl);
        return data.imageUrl;
      }
    } catch (err) {
      console.error("Model avatar error:", err);
    } finally {
      setGeneratingModel(false);
    }
    return null;
  }, [user, styleProfile, selectedOccasion]);

  const callStyleMe = useCallback(async (sp: any, isSurprise: boolean) => {
    return supabase.functions.invoke("style-me", {
      body: {
        wardrobeItems: allWardrobeItems,
        occasion: isSurprise ? "Surprise Me" : selectedOccasion,
        timeOfDay: isSurprise ? "Any" : selectedTime,
        weather: isSurprise ? "Any" : selectedWeather,
        styleProfile: sp,
        ...(isSurprise ? { surpriseMe: true } : {}),
      },
    });
  }, [allWardrobeItems, selectedOccasion, selectedTime, selectedWeather]);

  const handleStyleFlow = async (isSurprise: boolean) => {
    if (allWardrobeItems.length < 2) {
      toast.error("Add at least 2 items to your wardrobe first!");
      return;
    }

    isSurprise ? setSurprising(true) : setStyling(true);
    setProgressStage("Analyzing your wardrobe...");
    setProgressPercent(10);

    try {
      // Step 1: Fetch style profile (needed by both parallel calls)
      const sp = await fetchStyleProfile();
      setProgressStage("Generating outfits & AI model...");
      setProgressPercent(25);

      // Step 2: Run style-me AND model avatar generation IN PARALLEL
      const [styleResult, _modelResult] = await Promise.all([
        callStyleMe(sp, isSurprise),
        generateModelAvatar(sp),
      ]);

      setProgressPercent(75);
      setProgressStage("Preparing your results...");

      const { data, error } = styleResult;
      if (error) {
        const msg = data?.error || (error as any)?.message || "Failed to generate outfits";
        toast.error(msg);
        return;
      }
      if (data?.error) { toast.error(data.error); return; }

      if (data?.outfits?.length) {
        // Normalize scores to 1-10 range
        const normalizedOutfits = data.outfits.map((o: OutfitSuggestion) => {
          let s = Number(o.score) || 5;
          if (s > 10) s = s / 10; // Convert 0-100 scale to 0-10
          s = Math.max(1, Math.min(10, Math.round(s * 10) / 10)); // Clamp 1-10, 1 decimal
          return { ...o, score: s };
        });
        setOutfitSuggestions(normalizedOutfits);
        setShowResults(true);
        setProgressPercent(90);
        setProgressStage("Creating virtual try-on...");

        // Step 3: Generate try-on for first outfit
        if (styleProfile?.model_image_url && user) {
          await generateTryOn(data.outfits[0], 0);
        }
        setProgressPercent(100);
      } else {
        toast.error("No outfits generated. Try adding more items.");
      }
    } catch (err) {
      console.error("Style flow error:", err);
      toast.error("Failed to generate outfits. Please try again.");
    } finally {
      isSurprise ? setSurprising(false) : setStyling(false);
      setProgressStage("");
      setProgressPercent(0);
    }
  };

  const handleStyleMe = () => handleStyleFlow(false);
  const handleSurpriseMe = () => handleStyleFlow(true);

  const generateTryOn = async (outfit: OutfitSuggestion, idx: number) => {
    if (!styleProfile?.model_image_url || !user) return;
    try {
      const items = [outfit.top_id, outfit.bottom_id, outfit.shoes_id, ...(outfit.accessories || [])]
        .map(id => allWardrobeItems.find(w => w.id === id))
        .filter(Boolean);
      const desc = items.map(i => `${i!.name || i!.type} (${i!.color || ""} ${i!.material || ""})`).join(", ");
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: {
          modelImageUrl: styleProfile.model_image_url,
          outfitDescription: desc,
          occasion: selectedOccasion,
          userId: user.id,
        },
      });
      if (error) {
        const errorMsg = typeof data?.error === "string" ? data.error : "";
        if (errorMsg.includes("Rate limited") || errorMsg.includes("credits")) {
          toast.error("Try-on temporarily unavailable. Please try again later.");
          return;
        }
      }
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
  const displayModelUrl = fullSizeModelUrl || styleProfile?.model_image_url || profile?.avatar_url;
  const isProcessing = styling || surprising;

  return (
    <div className="min-h-screen pb-24 px-5 pt-8">
      <input type="file" accept="image/*" capture="user" className="hidden" />

      <div className="max-w-5xl mx-auto space-y-5">
        <div><AppHeader /></div>

        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {greeting}, {displayName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Let's find your perfect outfit today</p>
        </div>

        {/* Progress Bar */}
        <AnimatePresence>
          {isProcessing && progressStage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card-elevated p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="text-primary animate-spin" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{progressStage}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {progressPercent < 25 && "Reading your style profile..."}
                    {progressPercent >= 25 && progressPercent < 75 && "AI is picking outfits & generating your model simultaneously"}
                    {progressPercent >= 75 && progressPercent < 90 && "Almost there..."}
                    {progressPercent >= 90 && "Finishing up virtual try-on"}
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Split Layout: Controls Left, Model Right */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* LEFT PANEL: Controls */}
          <div className="flex-1 space-y-4 order-2 lg:order-1">
            {/* My Wardrobe Card */}
            <div className="glass-card-elevated p-4">
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
            </div>

            {/* Occasion Selector */}
            <div className="glass-card p-4">
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

            {/* Time of Day */}
            <div className="glass-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-2">Time of Day</h2>
              <div className="flex gap-2">
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
            </div>

            {/* Weather Selector */}
            <div className="glass-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-2">Weather</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {weatherOptions.map((w) => {
                  const isSelected = selectedWeather === w.label;
                  return (
                    <button
                      key={w.label}
                      onClick={() => setSelectedWeather(w.label)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex-shrink-0 ${
                        isSelected ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      <span>{w.emoji}</span>
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style Me Button */}
            <button onClick={handleStyleMe} disabled={isProcessing} className="w-full py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
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

            {/* Surprise Me Button */}
            <button onClick={handleSurpriseMe} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-foreground text-background font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
              {surprising ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                    <Shuffle size={20} />
                  </motion.div>
                  Surprising...
                </>
              ) : (
                <><Shuffle size={20} /> Surprise Me</>
              )}
            </button>

            {/* Check Your Drip Score */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Camera size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Check Your Drip Score</h3>
                  <p className="text-xs text-muted-foreground">Snap a photo and get AI feedback</p>
                </div>
                <button onClick={() => navigate("/camera")} className="px-4 py-2 rounded-full gradient-accent text-accent-foreground text-xs font-medium shadow-soft active:scale-95 transition-transform">
                  <Camera size={14} className="inline mr-1" /> Check
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: AI Model */}
          <div className="lg:w-[420px] flex-shrink-0 order-1 lg:order-2">
            <div className="sticky top-20">
              <div className="relative rounded-3xl overflow-hidden shadow-elevated bg-secondary">
                {displayModelUrl ? (
                  <div className="relative">
                    {generatingModel && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/70 backdrop-blur-sm">
                        <div className="relative w-32 h-48">
                          <Skeleton className="absolute inset-0 rounded-full w-16 h-16 mx-auto" />
                          <Skeleton className="absolute top-16 left-1/2 -translate-x-1/2 w-20 h-24 rounded-xl" />
                          <Skeleton className="absolute top-[120px] left-1/2 -translate-x-[26px] w-10 h-20 rounded-lg" />
                          <Skeleton className="absolute top-[120px] left-1/2 translate-x-[0px] w-10 h-20 rounded-lg" />
                        </div>
                        <p className="text-xs text-muted-foreground animate-pulse">Generating your AI model...</p>
                      </div>
                    )}
                    <img
                      src={displayModelUrl}
                      alt="Your AI Model"
                      className="w-full h-[280px] lg:h-[600px] object-contain object-top"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/60 to-transparent pt-16 pb-4 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{selectedOccasion} Look</p>
                          <p className="text-[11px] text-muted-foreground">{selectedTime} · {selectedWeather} · Your style, elevated</p>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentOccasion.color}`}>
                          <CurrentOccIcon size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : generatingModel ? (
                  <div className="w-full h-[280px] lg:h-[600px] flex flex-col items-center justify-center gap-4">
                    <div className="relative w-32 h-48">
                      <Skeleton className="absolute inset-0 rounded-full w-16 h-16 mx-auto" />
                      <Skeleton className="absolute top-16 left-1/2 -translate-x-1/2 w-20 h-24 rounded-xl" />
                      <Skeleton className="absolute top-[120px] left-1/2 -translate-x-[26px] w-10 h-20 rounded-lg" />
                      <Skeleton className="absolute top-[120px] left-1/2 translate-x-[0px] w-10 h-20 rounded-lg" />
                    </div>
                    <p className="text-xs text-muted-foreground animate-pulse">Generating your AI model...</p>
                  </div>
                ) : (
                  <div className="w-full h-[280px] lg:h-[600px] flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <CurrentOccIcon size={48} className="text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">{selectedOccasion}</p>
                      <p className="text-xs text-muted-foreground">Complete your profile to see your AI model</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Style Me Results Sheet */}
      <AnimatePresence>
        {showResults && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => { setShowResults(false); setSelectedOutfitIdx(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-card rounded-t-3xl shadow-elevated p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">AI Outfit Suggestions</h2>
                <button onClick={() => { setShowResults(false); setSelectedOutfitIdx(null); }} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{selectedOccasion} · {selectedTime} · {selectedWeather}</p>

              {outfitSuggestions.map((outfit, idx) => {
                const top = getItemById(outfit.top_id);
                const bottom = getItemById(outfit.bottom_id);
                const shoes = getItemById(outfit.shoes_id);
                const accessoryItems = (outfit.accessories || []).map(id => getItemById(id)).filter(Boolean);

                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setSelectedOutfitIdx(idx)}>
                    {outfit.tryon_image && (
                      <div className="h-48 overflow-hidden">
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
                          <div key={wi!.id} className="relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-secondary">
                            <img src={wi!.image_url} alt={wi!.name || wi!.type} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{outfit.explanation}</p>
                      <p className="text-[10px] text-primary font-medium">Tap to view details →</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Screen Outfit Detail View */}
      <AnimatePresence>
        {selectedOutfitIdx !== null && outfitSuggestions[selectedOutfitIdx] && (() => {
          const outfit = outfitSuggestions[selectedOutfitIdx];
          const top = getItemById(outfit.top_id);
          const bottom = getItemById(outfit.bottom_id);
          const shoes = getItemById(outfit.shoes_id);
          const accessoryItems = (outfit.accessories || []).map(id => getItemById(id)).filter(Boolean);
          const allItems = [top, bottom, shoes, ...accessoryItems].filter(Boolean);
          const matchPercent = Math.round(outfit.score * 10);

          return (
            <motion.div
              key="outfit-detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background overflow-y-auto"
            >
              <div className="max-w-lg mx-auto px-5 py-6 space-y-5 pb-32">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-secondary text-[10px] font-medium text-foreground">{selectedOccasion}</span>
                    <span className="px-2.5 py-1 rounded-full bg-secondary text-[10px] font-medium text-foreground">{selectedTime}</span>
                  </div>
                  <button onClick={() => setSelectedOutfitIdx(null)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                    <X size={18} className="text-foreground" />
                  </button>
                </div>

                {/* Title */}
                <div className="text-center space-y-1">
                  <h2 className="font-display text-xl font-semibold text-foreground">AI Selected the Perfect Outfit for You</h2>
                  <p className="text-xs text-muted-foreground">{outfit.name}</p>
                </div>

                {/* Overlapping Product Images */}
                <div className="flex justify-center items-end -space-x-4 py-4">
                  {allItems.map((wi, i) => (
                    <motion.div
                      key={wi!.id}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative w-24 h-28 rounded-2xl overflow-hidden bg-secondary shadow-elevated border-2 border-background"
                      style={{ zIndex: allItems.length - i }}
                    >
                      <img src={wi!.image_url} alt={wi!.name || wi!.type} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-foreground/50 backdrop-blur-sm px-1 py-0.5">
                        <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{wi!.type}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Try-on image if available */}
                {outfit.tryon_image && (
                  <div className="rounded-2xl overflow-hidden shadow-elevated">
                    <img src={outfit.tryon_image} alt="Virtual try-on" className="w-full h-72 object-cover object-top" />
                  </div>
                )}

                {/* Score Section */}
                <div className="glass-card-elevated p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground">Score: {outfit.score.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Matches better than {matchPercent}%</p>
                    </div>
                    <ScoreRing score={outfit.score} maxScore={10} size={64} label="Match" strokeColor="hsl(var(--primary))" />
                  </div>
                </div>

                {/* Explanation */}
                <div className="glass-card p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Why This Works</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{outfit.explanation}</p>
                </div>

                {/* Reasoning Grid */}
                {outfit.reasoning && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {outfit.reasoning.season && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                        <Leaf size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div><p className="text-[10px] font-semibold text-foreground">Season</p><p className="text-[9px] text-muted-foreground leading-tight">{outfit.reasoning.season}</p></div>
                      </div>
                    )}
                    {outfit.reasoning.mood && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                        <Smile size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div><p className="text-[10px] font-semibold text-foreground">Mood</p><p className="text-[9px] text-muted-foreground leading-tight">{outfit.reasoning.mood}</p></div>
                      </div>
                    )}
                    {outfit.reasoning.time_of_day && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                        <Sun size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div><p className="text-[10px] font-semibold text-foreground">Time of Day</p><p className="text-[9px] text-muted-foreground leading-tight">{outfit.reasoning.time_of_day}</p></div>
                      </div>
                    )}
                    {outfit.reasoning.color_combination && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                        <Palette size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div><p className="text-[10px] font-semibold text-foreground">Colors</p><p className="text-[9px] text-muted-foreground leading-tight">{outfit.reasoning.color_combination}</p></div>
                      </div>
                    )}
                    {outfit.reasoning.body_type && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                        <User size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div><p className="text-[10px] font-semibold text-foreground">Body Type</p><p className="text-[9px] text-muted-foreground leading-tight">{outfit.reasoning.body_type}</p></div>
                      </div>
                    )}
                    {outfit.reasoning.skin_tone && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                        <Droplet size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div><p className="text-[10px] font-semibold text-foreground">Skin Tone</p><p className="text-[9px] text-muted-foreground leading-tight">{outfit.reasoning.skin_tone}</p></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button onClick={() => navigate("/camera")} className="w-full py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                    <Camera size={18} /> Rate Your Outfit
                  </button>
                  {!outfit.tryon_image && styleProfile?.model_image_url && (
                    <button onClick={() => generateTryOn(outfit, selectedOutfitIdx)} className="w-full py-3 rounded-2xl bg-secondary text-foreground font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                      <Sparkles size={16} /> Generate Try-On Preview
                    </button>
                  )}
                  <button onClick={() => setSelectedOutfitIdx(null)} className="w-full text-center text-sm text-muted-foreground font-medium py-2">
                    ← Try a Different Look
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;