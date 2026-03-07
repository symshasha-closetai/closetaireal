import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Sparkles } from "lucide-react";
import AppHeader from "../components/AppHeader";
import OutfitRatingCard from "../components/OutfitRatingCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  wardrobe_suggestions: { item_name: string; category: string; reason: string; wardrobe_item_id?: string }[];
  shopping_suggestions: { item_name: string; category: string; reason: string; image_prompt?: string }[];
};

const CameraScreen = () => {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RatingResult | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setResult(null);
    await analyzeOutfit(file);
  };

  const analyzeOutfit = async (file: File) => {
    setAnalyzing(true);
    try {
      const imageBase64 = await toBase64(file);

      // Fetch wardrobe items for context
      let fetchedWardrobe: any[] = [];
      if (user) {
        const { data } = await supabase.from("wardrobe").select("id, name, type, color, material, image_url").eq("user_id", user.id);
        fetchedWardrobe = data || [];
        setWardrobeItems(fetchedWardrobe);
      }

      const { data, error } = await supabase.functions.invoke("rate-outfit", {
        body: { imageBase64, wardrobeItems: fetchedWardrobe },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.result) {
        setResult(data.result);
      }
    } catch (err: any) {
      console.error("Rating error:", err);
      toast.error("Failed to analyze outfit. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <AppHeader />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h1 className="font-display text-2xl font-semibold text-foreground">Rate My Outfit</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload or capture your outfit for AI analysis</p>
        </motion.div>

        <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
        <input type="file" accept="image/*" capture="environment" ref={cameraFileRef} className="hidden" onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />

        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div key="upload" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card-elevated overflow-hidden">
              <div className="aspect-[3/4] flex flex-col items-center justify-center gap-6 p-8">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                  <Camera size={32} className="text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium text-foreground">Capture Your Look</p>
                  <p className="text-sm text-muted-foreground">Take a photo or upload from gallery</p>
                </div>
                <div className="flex gap-3 w-full max-w-xs">
                  <button onClick={() => cameraFileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform">
                    <Camera size={16} /> Camera
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm active:scale-[0.98] transition-transform">
                    <Upload size={16} /> Gallery
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
              {analyzing ? (
                <div className="glass-card-elevated overflow-hidden relative">
                  <img src={image} alt="Outfit" className="w-full aspect-[3/4] object-cover" />
                  <button onClick={clearImage} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-foreground/60 text-primary-foreground flex items-center justify-center backdrop-blur-sm">
                    <X size={16} />
                  </button>
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                        <Sparkles size={28} className="text-accent" />
                      </motion.div>
                      <p className="text-sm font-medium text-foreground">Analyzing your outfit...</p>
                    </div>
                  </div>
                </div>
              ) : result ? (
                <div className="relative">
                  <button onClick={clearImage} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-foreground/60 text-primary-foreground flex items-center justify-center backdrop-blur-sm">
                    <X size={16} />
                  </button>
                  <OutfitRatingCard image={image} result={result} wardrobeItems={wardrobeItems} />
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CameraScreen;
