import { useState, useEffect, useCallback, useRef } from "react";
import { getCache, setCache, invalidateCache, CACHE_KEYS } from "@/lib/deviceCache";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, ChevronRight, ChevronLeft, X, Heart, GraduationCap, PartyPopper, Shirt, Palette, Briefcase, Sun, Moon, Sunset, CloudRain, Thermometer, CloudSun, Snowflake, Shuffle, Leaf, Smile, Droplet, User, Loader2, Bookmark, BookmarkCheck, Pin, Download, Music, Flag, CalendarDays, RefreshCw } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import ScoreRing from "../components/ScoreRing";
import { Progress } from "@/components/ui/progress";
import { precacheImages } from "@/lib/imageCache";


const occasions = [
  { label: "Casual", icon: Shirt, color: "bg-blue-100 text-blue-600" },
  { label: "Party", icon: Music, color: "bg-pink-100 text-pink-600" },
  { label: "Formal", icon: Briefcase, color: "bg-gray-100 text-gray-600" },
  { label: "Date Night", icon: Heart, color: "bg-red-100 text-red-600" },
  { label: "College", icon: GraduationCap, color: "bg-green-100 text-green-600" },
  { label: "Cultural", icon: Flag, color: "bg-red-100 text-red-600" },
  { label: "Festival", icon: PartyPopper, color: "bg-purple-100 text-purple-600" },
  { label: "Creative", icon: Palette, color: "bg-teal-100 text-teal-600" },
];

const timeOfDay = [
  { label: "Day", icon: Sun, emoji: "☀️" },
  { label: "Evening", icon: Sunset, emoji: "🌅" },
  { label: "Night", icon: Moon, emoji: "🌙" },
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
  pinned?: boolean;
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
  best_choice?: boolean;
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
  const [selectedOccasion, setSelectedOccasion] = useState("Casual");
  const [selectedTime, setSelectedTime] = useState("Day");
  const [selectedWeather, setSelectedWeather] = useState("Warm");
  const [styling, setStyling] = useState(false);
  const [surprising, setSurprising] = useState(false);
  const [outfitSuggestions, setOutfitSuggestions] = useState<OutfitSuggestion[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(null);
  const [savedOutfitIds, setSavedOutfitIds] = useState<Set<number>>(new Set());

  // Calendar outfit planner
  type CalendarOutfit = { id?: string; outfit_date: string; outfit_data: { name: string; items: string[]; occasion: string; explanation: string } };
  const [calendarOutfits, setCalendarOutfits] = useState<CalendarOutfit[]>([]);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);
  const [showCalendarAll, setShowCalendarAll] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarOutfit, setSelectedCalendarOutfit] = useState<CalendarOutfit | null>(null);
  const [monthOutfits, setMonthOutfits] = useState<CalendarOutfit[]>([]);



  // Dripd Observation
  type DripdObservation = { works: string; off: string; fix: string[]; observation: string };
  const [dripdObservation, setDripdObservation] = useState<DripdObservation | null>(null);
  const [loadingObservation, setLoadingObservation] = useState(false);
  const observationFetchedRef = useRef(false);



  // Fetch Dripd Observation
  useEffect(() => {
    if (!user || observationFetchedRef.current) return;
    observationFetchedRef.current = true;

    const OBSERVATION_CACHE_KEY = "dripd-observation";
    const cached = getCache<DripdObservation>(OBSERVATION_CACHE_KEY, user.id, 7 * 24 * 60 * 60 * 1000);
    if (cached) { setDripdObservation(cached); return; }

    const fetchObservation = async () => {
      setLoadingObservation(true);
      try {
        const { data: history } = await supabase
          .from("drip_history")
          .select("score, killer_tag, praise_line, created_at, mode")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!history || history.length < 2) { setLoadingObservation(false); return; }

        const sp = await supabase.from("style_profiles").select("gender").eq("user_id", user.id).maybeSingle();

        const { data, error } = await supabase.functions.invoke("generate-dripd-observation", {
          body: { dripHistory: history, gender: sp?.data?.gender || "unknown" },
        });

        if (!error && data?.observation) {
          setDripdObservation(data.observation);
          setCache(OBSERVATION_CACHE_KEY, user.id, data.observation);
        }
      } catch (e) { console.error("Observation fetch failed:", e); }
      setLoadingObservation(false);
    };
    fetchObservation();
  }, [user]);



  const handleSaveOutfit = async (outfit: OutfitSuggestion, idx: number) => {
    if (!user || savedOutfitIds.has(idx)) return;
    try {
      const items = [
        outfit.top_id && { id: outfit.top_id, type: "top" },
        outfit.bottom_id && { id: outfit.bottom_id, type: "bottom" },
        outfit.shoes_id && { id: outfit.shoes_id, type: "shoes" },
        ...(outfit.accessories || []).map(id => ({ id, type: "accessory" })),
      ].filter(Boolean);

      const outfitData = {
        user_id: user.id,
        name: outfit.name,
        occasion: selectedOccasion,
        score: outfit.score,
        explanation: outfit.explanation,
        items: items as any,
        score_breakdown: outfit.score_breakdown || null,
        reasoning: outfit.reasoning || null,
      };
      const { data, error } = await supabase.from("saved_outfits" as any).insert(outfitData as any).select().single();
      if (error) throw error;
      setSavedOutfitIds(prev => new Set(prev).add(idx));
      try {
        const cached = JSON.parse(localStorage.getItem("saved-outfits") || "[]");
        cached.unshift(data);
        localStorage.setItem("saved-outfits", JSON.stringify(cached));
      } catch {}
      toast.success("Outfit saved! Find it in your profile history.", { duration: 2000 });
    } catch (err) {
      console.error("Save outfit error:", err);
      toast.error("Failed to save outfit");
    }
  };

  // Progress tracking
  const [progressStage, setProgressStage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (user) {
      const cached = getCache<WardrobeItem[]>(CACHE_KEYS.WARDROBE, user.id);
      if (cached) {
        setAllWardrobeItems(cached);
        setWardrobeItems(cached.slice(0, 6));
        setWardrobeCount(cached.length);
      }
      supabase
        .from("wardrobe")
        .select("id, image_url, type, name, color, material, pinned")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          const items = ((data || []) as any[]).map(i => ({ ...i, pinned: !!i.pinned })) as WardrobeItem[];
          // Sort pinned first
          items.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
          setAllWardrobeItems(items);
          setWardrobeItems(items.slice(0, 6));
          setWardrobeCount(items.length);
          setCache(CACHE_KEYS.WARDROBE, user.id, items);
          precacheImages(items.map((i: any) => i.image_url).filter(Boolean));
        });
    }
  }, [user]);

  // Calendar outfit planner — fetch and auto-generate
  const generateCalendarOutfits = useCallback(async () => {
    if (!user || allWardrobeItems.length < 2) return;
    setGeneratingCalendar(true);
    try {
      const sp = await supabase.from("style_profiles").select("body_type, skin_tone, gender, style_type").eq("user_id", user.id).maybeSingle();
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.functions.invoke("generate-outfit-calendar", {
        body: { wardrobeItems: allWardrobeItems, styleProfile: sp?.data, startDate: today },
      });
      if (error || !data?.outfits) { toast.error("Failed to generate weekly plan"); return; }
      const rows = data.outfits.map((o: any) => {
        const d = new Date();
        d.setDate(d.getDate() + (o.day_offset || 0));
        return { user_id: user.id, outfit_date: d.toISOString().split("T")[0], outfit_data: { name: o.name, items: o.items, occasion: o.occasion, explanation: o.explanation } };
      });
      for (const row of rows) {
        await supabase.from("outfit_calendar" as any).upsert(row as any, { onConflict: "user_id,outfit_date" });
      }
      setCalendarOutfits(rows);
      setCache(CACHE_KEYS.CALENDAR, user.id, rows);
      localStorage.setItem(`dripd-calendar-last-gen-${user.id}`, String(Date.now()));
      toast.success("Weekly outfit plan generated! 📅");
    } catch (e) { console.error(e); toast.error("Failed to plan outfits"); }
    setGeneratingCalendar(false);
  }, [user, allWardrobeItems]);

  const generateCalendarRef = useRef(generateCalendarOutfits);
  useEffect(() => { generateCalendarRef.current = generateCalendarOutfits; }, [generateCalendarOutfits]);
  const hasTriggeredGenRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    // Restore from cache instantly
    const cached = getCache<CalendarOutfit[]>(CACHE_KEYS.CALENDAR, user.id);
    if (cached && cached.length > 0) setCalendarOutfits(cached);

    // Cache-first: if cache has ≥3 items, skip DB fetch
    if (cached && cached.length >= 3) return;

    const fetchCalendar = async () => {
      const today = new Date().toISOString().split("T")[0];
      const end = new Date(); end.setDate(end.getDate() + 7);
      const endStr = end.toISOString().split("T")[0];
      const { data } = await supabase.from("outfit_calendar" as any).select("*").eq("user_id", user.id).gte("outfit_date", today).lte("outfit_date", endStr).order("outfit_date", { ascending: true });
      const items = (data || []) as unknown as CalendarOutfit[];
      setCalendarOutfits(items);
      setCache(CACHE_KEYS.CALENDAR, user.id, items);

      // Only auto-generate if <3 items AND no generation in last 24h AND hasn't triggered this mount
      if (items.length < 3 && allWardrobeItems.length >= 2 && !hasTriggeredGenRef.current) {
        const lastGenKey = `dripd-calendar-last-gen-${user.id}`;
        const lastGen = localStorage.getItem(lastGenKey);
        const cooldown = 24 * 60 * 60 * 1000;
        if (!lastGen || Date.now() - Number(lastGen) > cooldown) {
          hasTriggeredGenRef.current = true;
          generateCalendarRef.current();
        }
      }
    };
    if (allWardrobeItems.length > 0) fetchCalendar();
  }, [user, allWardrobeItems]);

  useEffect(() => {
    if (!user || !showCalendarAll) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1).toISOString().split("T")[0];
    const end = new Date(year, month + 1, 0).toISOString().split("T")[0];
    supabase.from("outfit_calendar" as any).select("*").eq("user_id", user.id).gte("outfit_date", start).lte("outfit_date", end).order("outfit_date", { ascending: true })
      .then(({ data }) => setMonthOutfits((data || []) as unknown as CalendarOutfit[]));
  }, [user, showCalendarAll, calendarMonth]);

  const getCalendarDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.getTime() === today.getTime()) return "Today";
    if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const categoryCounts = allWardrobeItems.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const fetchStyleProfile = useCallback(async () => {
    if (!user) return null;
    const cacheKey = `style_profile_cache`;
    const cached = getCache<any>(cacheKey, user.id);
    if (cached) return cached;
    const { data } = await supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setCache(cacheKey, user.id, data);
    return data;
  }, [user]);

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
      const sp = await fetchStyleProfile();
      setProgressStage("Generating outfits...");
      setProgressPercent(30);

      const { data, error } = await callStyleMe(sp, isSurprise);

      setProgressPercent(80);
      setProgressStage("Preparing your results...");

      if (error) {
        const msg = data?.error || (error as any)?.message || "Failed to generate outfits";
        toast.error(msg);
        return;
      }
      if (data?.error) { toast.error(data.error); return; }

      if (data?.outfits?.length) {
        const normalizedOutfits = data.outfits.map((o: OutfitSuggestion) => {
          let s = Number(o.score) || 5;
          if (s > 10) s = s / 10;
          s = Math.max(1, Math.min(10, Math.round(s * 10) / 10));
          return { ...o, score: s };
        });
        setOutfitSuggestions(normalizedOutfits);
        setShowResults(true);
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

  const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const getItemById = (id?: string) => allWardrobeItems.find(i => i.id === id);
  const getItemLabel = (wi: WardrobeItem) => (wi.name && !isUUID(wi.name)) ? wi.name : wi.type;
  const isProcessing = styling || surprising;

  return (
    <div className="min-h-screen pb-24 px-5 pt-4">
      <input type="file" accept="image/*" capture="user" ref={photoFileRef} className="hidden" onChange={handleTodayPhotoUpload} />
      {pendingCropImage && (
        <ImageCropper
          imageSrc={pendingCropImage}
          open={!!pendingCropImage}
          onConfirm={handleCroppedPhoto}
          onCancel={() => setPendingCropImage(null)}
          aspectRatio={4 / 5}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-5">
        <div><AppHeader /></div>

        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
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
                    {progressPercent < 30 && "Reading your style profile..."}
                    {progressPercent >= 30 && progressPercent < 80 && "AI is picking the best outfits for you"}
                    {progressPercent >= 80 && "Almost there..."}
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="space-y-4">
          {/* Today's Look Card */}
          <div className="glass-card-elevated overflow-hidden">
            {todayPhoto ? (
              <div className="relative">
                <img src={todayPhoto} alt="Today's look" className="w-full aspect-[4/5] object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-gold/90 text-white text-[10px] font-semibold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>Today's Look</span>
                  {streak > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-orange-500/90 text-white text-[10px] font-semibold flex items-center gap-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                      <Flame size={10} /> {streak} day{streak > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={handleShareTodayLook}
                    disabled={sharingLook}
                    className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"
                  >
                    {sharingLook ? <Loader2 size={14} className="text-white animate-spin" /> : <Share2 size={14} className="text-white" />}
                  </button>
                  <button
                    onClick={handleRecropPhoto}
                    className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"
                  >
                    <Crop size={14} className="text-white" />
                  </button>
                  <button
                    onClick={() => photoFileRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"
                  >
                    <Camera size={14} className="text-white" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white font-bold text-lg" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{getDailyTag()}</p>
                  <p className="text-white/80 text-[10px] mt-0.5" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => photoFileRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full py-10 flex flex-col items-center gap-3 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  {uploadingPhoto ? <Loader2 size={24} className="text-primary animate-spin" /> : <ImagePlus size={24} className="text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Add Today's Look</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Snap your outfit & get a daily killer tag</p>
                </div>
              </button>
            )}
          </div>

          {/* Dripd Observation Card */}
          {(dripdObservation || loadingObservation) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card-elevated p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Dripd Observation</h2>
              </div>
              {loadingObservation && !dripdObservation ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 size={14} className="text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Analyzing your style journey...</p>
                </div>
              ) : dripdObservation ? (
                <div className="space-y-2">
                  {dripdObservation.works && (
                    <div>
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">What Works</p>
                      <p className="text-xs text-foreground leading-relaxed">{dripdObservation.works}</p>
                    </div>
                  )}
                  {dripdObservation.off && (
                    <div>
                      <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">What's Off</p>
                      <p className="text-xs text-foreground leading-relaxed">{dripdObservation.off}</p>
                    </div>
                  )}
                  {dripdObservation.fix?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Upgrade Moves</p>
                      <ul className="space-y-0.5">
                        {dripdObservation.fix.map((f, i) => (
                          <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">→</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {dripdObservation.observation && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">"{dripdObservation.observation}"</p>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}

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

          {/* Dripd Calendar Section */}
          <div className="glass-card-elevated p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-foreground">Dripd Calendar</h2>
                {calendarOutfits.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-bold text-foreground">{calendarOutfits.length} days</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={generateCalendarOutfits} disabled={generatingCalendar || allWardrobeItems.length < 2} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center disabled:opacity-40">
                  <RefreshCw size={13} className={`text-muted-foreground ${generatingCalendar ? "animate-spin" : ""}`} />
                </button>
                {calendarOutfits.length > 0 && (
                  <button onClick={() => setShowCalendarAll(true)} className="flex items-center gap-0.5 text-xs font-medium text-primary">
                    View all <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {generatingCalendar ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 size={24} className="text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">Planning your week...</p>
              </div>
            ) : calendarOutfits.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {calendarOutfits.map((co) => {
                  const od = co.outfit_data;
                  const itemImages = (od.items || []).map((id: string) => allWardrobeItems.find(w => w.id === id)).filter(Boolean);
                  return (
                    <motion.div
                      key={co.outfit_date}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex-shrink-0 w-52 rounded-2xl bg-secondary overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
                      onClick={() => setSelectedCalendarOutfit(co)}
                    >
                      <div className={`grid gap-1 p-2 ${itemImages.length <= 2 ? 'grid-cols-2' : itemImages.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {itemImages.map((wi: any) => (
                          <div key={wi.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                            <img src={wi.image_url} alt={wi.name || wi.type} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[10px] font-semibold text-primary">{getCalendarDayLabel(co.outfit_date)}</p>
                        <p className="text-xs font-medium text-foreground truncate">{od.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{od.occasion}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : allWardrobeItems.length < 2 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Add at least 2 wardrobe items to get daily outfit plans</p>
            ) : (
              <button onClick={generateCalendarOutfits} className="w-full py-6 rounded-xl bg-secondary text-sm text-muted-foreground flex items-center justify-center gap-2">
                <CalendarDays size={16} /> Generate Week Plan
              </button>
            )}
          </div>

          {/* Occasion Selector */}
          <div className="glass-card p-4">
            <h2 className="text-base font-display font-semibold text-foreground mb-3">Pick an Occasion</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {occasions.map((occ) => {
                const OccIcon = occ.icon;
                const isSelected = selectedOccasion === occ.label;
                return (
                  <button
                    key={occ.label}
                    onClick={() => setSelectedOccasion(occ.label)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0 transition-all ${
                      isSelected ? "bg-card border-2 border-gold shadow-soft" : "bg-secondary border-2 border-transparent"
                    }`}
                  >
                    <OccIcon size={18} className={isSelected ? "text-gold" : "text-muted-foreground"} />
                    <span className={`text-[10px] font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{occ.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time of Day - Card style matching occasions */}
          <div className="glass-card p-4">
            <h2 className="text-base font-display font-semibold text-foreground mb-3">Time of Day</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {timeOfDay.map((t) => {
                const isSelected = selectedTime === t.label;
                return (
                  <button
                    key={t.label}
                    onClick={() => setSelectedTime(t.label)}
                    className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl flex-shrink-0 transition-all ${
                      isSelected ? "bg-card border-2 border-gold shadow-soft" : "bg-secondary border-2 border-transparent"
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weather Selector - Card style matching occasions */}
          <div className="glass-card p-4">
            <h2 className="text-base font-display font-semibold text-foreground mb-3">Weather</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {weatherOptions.map((w) => {
                const isSelected = selectedWeather === w.label;
                return (
                  <button
                    key={w.label}
                    onClick={() => setSelectedWeather(w.label)}
                    className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl flex-shrink-0 transition-all ${
                      isSelected ? "bg-card border-2 border-gold shadow-soft" : "bg-secondary border-2 border-transparent"
                    }`}
                  >
                    <span className="text-lg">{w.emoji}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style Me Button */}
          <button onClick={handleStyleMe} disabled={isProcessing} className="w-full py-4 rounded-2xl gradient-gold text-white font-semibold text-base glow-gold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
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
          <button onClick={handleSurpriseMe} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-foreground text-background font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60 border border-gold/20">
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
              <button onClick={() => navigate("/camera")} className="px-4 py-2 rounded-full gradient-gold text-white text-xs font-medium glow-gold active:scale-95 transition-transform">
                <Camera size={14} className="inline mr-1" /> Check
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Calendar Month View Overlay */}
      <AnimatePresence>
        {showCalendarAll && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background overflow-y-auto">
            <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">Outfit Calendar</h2>
                <button onClick={() => setShowCalendarAll(false)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                  <X size={18} className="text-foreground" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() - 1); setCalendarMonth(d); }} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <ChevronLeft size={16} className="text-foreground" />
                </button>
                <span className="text-sm font-semibold text-foreground">{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                <button onClick={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() + 1); setCalendarMonth(d); }} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <ChevronRight size={16} className="text-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <span key={d} className="text-[10px] font-medium text-muted-foreground">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const year = calendarMonth.getFullYear();
                  const month = calendarMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const outfit = monthOutfits.find(o => o.outfit_date === dateStr);
                    const isToday = dateStr === new Date().toISOString().split("T")[0];
                    const outfitItems = outfit ? ((outfit.outfit_data as any).items || []).map((id: string) => allWardrobeItems.find(w => w.id === id)).filter(Boolean) : [];
                    cells.push(
                      <button
                        key={d}
                        onClick={() => outfit && setSelectedCalendarOutfit(outfit)}
                        className={`rounded-xl flex flex-col items-center gap-0.5 py-1.5 min-h-[5rem] transition-all ${isToday ? "ring-2 ring-primary bg-primary/10" : outfit ? "bg-secondary cursor-pointer active:scale-95" : "bg-transparent"}`}
                      >
                        <span className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-foreground"}`}>{d}</span>
                        {outfitItems.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-[2px] px-0.5">
                            {outfitItems.slice(0, 3).map((wi: any) => (
                              <div key={wi.id} className="w-4 h-4 rounded-sm overflow-hidden bg-muted">
                                <img src={wi.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              </div>
                            ))}
                          </div>
                        ) : outfit ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ) : null}
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Outfit Detail */}
      <AnimatePresence>
        {selectedCalendarOutfit && (() => {
          const od = selectedCalendarOutfit.outfit_data;
          const outfitItems = (od.items || []).map((id: string) => allWardrobeItems.find(w => w.id === id)).filter(Boolean) as WardrobeItem[];
          return (
            <motion.div key="cal-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-background overflow-y-auto">
              <div className="max-w-lg mx-auto px-5 py-6 space-y-5 pb-32">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-secondary text-[10px] font-medium text-foreground">{getCalendarDayLabel(selectedCalendarOutfit.outfit_date)}</span>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-[10px] font-medium text-primary">{od.occasion}</span>
                  </div>
                  <button onClick={() => setSelectedCalendarOutfit(null)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                    <X size={18} className="text-foreground" />
                  </button>
                </div>
                <div className="text-center space-y-1">
                  <h2 className="font-display text-xl font-semibold text-foreground">{od.name}</h2>
                  <p className="text-xs text-muted-foreground">{selectedCalendarOutfit.outfit_date}</p>
                </div>
                <div className="flex justify-center items-end -space-x-4 py-4">
                  {outfitItems.map((wi, i) => (
                    <motion.div key={wi.id} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.1 }} className="relative w-24 h-28 rounded-2xl overflow-hidden bg-secondary shadow-elevated border-2 border-background" style={{ zIndex: outfitItems.length - i }}>
                      <img src={wi.image_url} alt={getItemLabel(wi)} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-foreground/50 backdrop-blur-sm px-1 py-0.5">
                        <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{getItemLabel(wi)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="glass-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Items in this outfit</h3>
                  <div className="space-y-2">
                    {outfitItems.map((wi) => (
                      <div key={wi.id} className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                          <img src={wi.image_url} alt={getItemLabel(wi)} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{getItemLabel(wi)}</p>
                          <p className="text-[10px] text-muted-foreground">{wi.type}{wi.color ? ` · ${wi.color}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Why This Works</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{od.explanation}</p>
                </div>
                <button onClick={() => setSelectedCalendarOutfit(null)} className="w-full text-center text-sm text-muted-foreground font-medium py-2">← Back</button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

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

              {[...outfitSuggestions].sort((a, b) => (b.best_choice ? 1 : 0) - (a.best_choice ? 1 : 0) || b.score - a.score).map((outfit, idx) => {
                const top = getItemById(outfit.top_id);
                const bottom = getItemById(outfit.bottom_id);
                const shoes = getItemById(outfit.shoes_id);
                const accessoryItems = (outfit.accessories || []).map(id => getItemById(id)).filter(Boolean);
                const isBest = outfit.best_choice || idx === 0;

                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className={`glass-card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform ${isBest ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedOutfitIdx(outfitSuggestions.indexOf(outfit))}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{outfit.name}</h3>
                          {isBest && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Best Choice ✨</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Sparkles size={14} className="text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{outfit.score}/10</span>
                        </div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {[top, bottom, shoes, ...accessoryItems].filter(Boolean).map((wi) => (
                          <div key={wi!.id} className="relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-secondary">
                            <img src={wi!.image_url} alt={getItemLabel(wi!)} className="w-full h-full object-cover" />
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
                      <img src={wi!.image_url} alt={getItemLabel(wi!)} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-foreground/50 backdrop-blur-sm px-1 py-0.5">
                        <p className="text-[8px] text-primary-foreground truncate text-center font-medium">{getItemLabel(wi!)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

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

                {/* Score Breakdown */}
                {outfit.score_breakdown && (
                  <div className="glass-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Score Breakdown</h3>
                    <div className="space-y-2">
                      {([
                        { key: "color", label: "Color Harmony", icon: Palette },
                        { key: "occasion", label: "Occasion Fit", icon: Briefcase },
                        { key: "season", label: "Season", icon: Leaf },
                        { key: "body_type", label: "Body Type", icon: User },
                        { key: "skin_tone", label: "Skin Tone", icon: Droplet },
                        { key: "fabric", label: "Fabric", icon: Shirt },
                      ] as const).map(({ key, label, icon: Icon }) => {
                        const val = Number(outfit.score_breakdown![key as keyof ScoreBreakdown]) || 0;
                        const clamped = Math.max(0, Math.min(10, val));
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <Icon size={12} className="text-primary flex-shrink-0" />
                            <span className="text-[10px] text-foreground w-20 flex-shrink-0">{label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${clamped * 10}%` }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="h-full rounded-full bg-primary"
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-foreground w-8 text-right">{clamped.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                  <button
                    onClick={() => handleSaveOutfit(outfit, selectedOutfitIdx!)}
                    disabled={savedOutfitIds.has(selectedOutfitIdx!)}
                    className="w-full py-3 rounded-2xl border border-border/40 text-foreground font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    {savedOutfitIds.has(selectedOutfitIdx!) ? (
                      <><BookmarkCheck size={16} className="text-primary" /> Outfit Saved</>
                    ) : (
                      <><Bookmark size={16} /> Save Outfit</>
                    )}
                  </button>
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
