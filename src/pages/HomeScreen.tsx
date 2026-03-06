import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, Camera, Heart, ChevronRight } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

const occasions = ["Party", "Casual", "Formal", "Date Night"];
const timeOfDay = ["Day", "Evening", "Night"];

type WardrobeItem = {
  id: string;
  image_url: string;
  type: string;
  name: string | null;
};

const HomeScreen = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const { profile, user } = useAuth();
  const displayName = profile?.name || "there";
  const navigate = useNavigate();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [selectedOccasion, setSelectedOccasion] = useState("Party");
  const [selectedTime, setSelectedTime] = useState("Evening");
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("wardrobe")
        .select("id, image_url, type, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6)
        .then(({ data }) => {
          setWardrobeItems(data || []);
        });
      supabase
        .from("wardrobe")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .then(({ count }) => {
          setWardrobeCount(count || 0);
        });
    }
  }, [user]);

  const categoryCounts = wardrobeItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleRateOutfit = () => {
    if (cameraRef.current) {
      cameraRef.current.click();
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Navigate to camera screen - the file will be handled there
      navigate("/camera");
    }
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <input type="file" accept="image/*" capture="user" ref={cameraRef} className="hidden" onChange={handleCameraCapture} />
      
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <motion.div variants={item}>
          <AppHeader />
        </motion.div>

        {/* Greeting */}
        <motion.div variants={item} className="text-center">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {greeting}, {displayName}!
          </h1>
        </motion.div>

        {/* My Wardrobe Section */}
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
              <button
                onClick={() => navigate("/wardrobe")}
                className="flex-shrink-0 w-16 h-16 rounded-xl bg-secondary flex items-center justify-center"
              >
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/wardrobe")}
              className="w-full py-4 rounded-xl bg-secondary text-sm text-muted-foreground"
            >
              Add your first clothing item →
            </button>
          )}

          {/* Category counts */}
          <div className="flex gap-3 mt-3">
            {["Tops", "Bottoms", "Dresses", "Shoes"].map((cat) => (
              <div key={cat} className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">{cat}</span>
                <span className="text-[11px] font-semibold text-foreground">{categoryCounts[cat] || 0}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pick an Occasion */}
        <motion.div variants={item} className="glass-card p-4">
          <h2 className="text-base font-semibold text-foreground mb-3">Pick an Occasion</h2>
          <div className="flex gap-2 flex-wrap">
            {occasions.map((occ) => (
              <button
                key={occ}
                onClick={() => setSelectedOccasion(occ)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                  selectedOccasion === occ
                    ? "gradient-accent text-accent-foreground shadow-soft"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {occ}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {timeOfDay.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ${
                  selectedTime === t
                    ? "bg-foreground text-background"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Person / Style Me Section */}
        <motion.div variants={item} className="glass-card-elevated overflow-hidden">
          {profile?.avatar_url ? (
            <div className="relative h-64 overflow-hidden">
              <img
                src={profile.avatar_url}
                alt="Your photo"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-sm font-medium text-foreground">Your style, elevated by AI</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedOccasion} · {selectedTime}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-48 bg-secondary flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Upload a profile photo</p>
                <p className="text-xs text-muted-foreground mt-1">to see AI makeover suggestions</p>
                <button
                  onClick={() => navigate("/profile")}
                  className="mt-3 px-4 py-2 rounded-full bg-foreground/10 text-xs font-medium text-foreground"
                >
                  Go to Profile
                </button>
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
            <button
              onClick={() => navigate("/camera")}
              className="px-4 py-2 rounded-full gradient-accent text-accent-foreground text-xs font-medium shadow-soft active:scale-95 transition-transform"
            >
              <Camera size={14} className="inline mr-1" />
              Rate
            </button>
          </div>
        </motion.div>

        {/* Style Me Button */}
        <motion.div variants={item}>
          <button
            onClick={() => navigate("/camera")}
            className="w-full py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Sparkles size={20} />
            Style Me
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
