import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Sparkles, RefreshCw, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionImage } from "@/hooks/useOptionImage";

const bodyTypes = [
  { label: "Hourglass", emoji: "⏳" },
  { label: "Pear", emoji: "🍐" },
  { label: "Rectangle", emoji: "▬" },
  { label: "Apple", emoji: "🍎" },
  { label: "Inverted Triangle", emoji: "🔻" },
  { label: "Athletic", emoji: "💪" },
  { label: "Slim", emoji: "🧍" },
  { label: "Plus Size", emoji: "🌸" },
];

const skinTones = [
  { label: "Fair", color: "#F5DEB3" },
  { label: "Light", color: "#F0C8A0" },
  { label: "Medium", color: "#D4A574" },
  { label: "Olive", color: "#B08D57" },
  { label: "Dark", color: "#8B6D4A" },
  { label: "Deep", color: "#5C3D2E" },
];

const faceShapes = ["Oval", "Round", "Square", "Heart", "Oblong", "Diamond"];

const styleOptions = [
  "Casual", "Formal", "Streetwear", "Minimalist", "Bohemian", "Classic", "Sporty",
];

// Hook for lazy-loading option images
const useOptionImage = (category: string, label: string) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadImage = async () => {
      // Check cache first via public URL pattern
      const cachePath = `option-images/${category}/${label.toLowerCase().replace(/\s+/g, "-")}.png`;
      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(cachePath);
      
      // Try fetching cached image
      try {
        const res = await fetch(urlData.publicUrl, { method: "HEAD" });
        if (res.ok) {
          if (!cancelled) setImageUrl(urlData.publicUrl);
          return;
        }
      } catch {}

      // Generate via edge function
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-option-images", {
          body: { category, label },
        });
        if (!error && data?.imageUrl && !cancelled) {
          setImageUrl(data.imageUrl);
        }
        // Silently ignore 402/429 — just show no thumbnail
      } catch {
        // Silently fail — UI shows emoji/text fallback
      }
      if (!cancelled) setLoading(false);
    };

    loadImage();
    return () => { cancelled = true; };
  }, [category, label]);

  return { imageUrl, loading };
};

const OptionImageThumbnail = ({ category, label }: { category: string; label: string }) => {
  const { imageUrl, loading } = useOptionImage(category, label);

  if (loading) return <Skeleton className="w-10 h-10 rounded-lg" />;
  if (!imageUrl) return null;

  return (
    <img src={imageUrl} alt={label} className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
  );
};

const StyleProfileEditor = () => {
  const { user, styleProfile, refreshProfile } = useAuth();

  const [bodyType, setBodyType] = useState(styleProfile?.body_type || "");
  const [skinTone, setSkinTone] = useState(styleProfile?.skin_tone || "");
  const [faceShape, setFaceShape] = useState(styleProfile?.face_shape || "");
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    styleProfile?.style_type?.split(",").filter(Boolean) || []
  );
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const faceRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLInputElement>(null);

  const modelImageUrl = styleProfile?.model_image_url;

  const toggleStyle = (s: string) => {
    setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSaveAndRegenerate = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await supabase.from("style_profiles").upsert({
        user_id: user.id,
        body_type: bodyType || null,
        skin_tone: skinTone || null,
        face_shape: faceShape || null,
        style_type: selectedStyles.join(",") || null,
      }, { onConflict: "user_id" });

      setRegenerating(true);
      const modelDesc = `A person with ${skinTone || "medium"} skin tone, ${bodyType || "average"} body type, ${faceShape || "oval"} face shape. Standing pose, full body.`;

      const { data: spData } = await supabase.from("style_profiles").select("face_photo_url, body_photo_url").eq("user_id", user.id).single();

      const { data, error } = await supabase.functions.invoke("generate-model-avatar", {
        body: { 
          modelDescription: modelDesc, 
          userId: user.id,
          facePhotoUrl: spData?.face_photo_url || null,
          bodyPhotoUrl: spData?.body_photo_url || null,
        },
      });

      if (error) console.error("Model regen error:", error);

      await refreshProfile();
      toast.success("Style profile updated & model regenerated! ✨");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update style profile");
    } finally {
      setSaving(false);
      setRegenerating(false);
    }
  };

  const handleReuploadPhotos = async (faceFile: File | null, bodyFile: File | null) => {
    if (!user || (!faceFile && !bodyFile)) return;
    setReanalyzing(true);

    try {
      const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      let faceUrl: string | null = null;
      let bodyUrl: string | null = null;

      if (faceFile) {
        const ext = faceFile.name.split(".").pop();
        const path = `${user.id}/face.${ext}`;
        await supabase.storage.from("wardrobe").upload(path, faceFile, { upsert: true });
        const { data } = supabase.storage.from("wardrobe").getPublicUrl(path);
        faceUrl = `${data.publicUrl}?t=${Date.now()}`;
      }

      if (bodyFile) {
        const ext = bodyFile.name.split(".").pop();
        const path = `${user.id}/body.${ext}`;
        await supabase.storage.from("wardrobe").upload(path, bodyFile, { upsert: true });
        const { data } = supabase.storage.from("wardrobe").getPublicUrl(path);
        bodyUrl = `${data.publicUrl}?t=${Date.now()}`;
      }

      const faceB64 = faceFile ? await fileToBase64(faceFile) : null;
      const bodyB64 = bodyFile ? await fileToBase64(bodyFile) : null;

      const { data, error } = await supabase.functions.invoke("analyze-body-profile", {
        body: { faceImageBase64: faceB64, bodyImageBase64: bodyB64 },
      });

      if (error) throw error;

      if (data.face_analysis) {
        if (data.face_analysis.face_shape) setFaceShape(data.face_analysis.face_shape);
        if (data.face_analysis.skin_tone) setSkinTone(data.face_analysis.skin_tone);
      }
      if (data.body_analysis?.body_type) setBodyType(data.body_analysis.body_type);

      await supabase.from("style_profiles").upsert({
        user_id: user.id,
        face_photo_url: faceUrl,
        body_photo_url: bodyUrl,
        ai_face_analysis: data.face_analysis || null,
        ai_body_analysis: data.body_analysis || null,
      }, { onConflict: "user_id" });

      await refreshProfile();
      toast.success("Photos re-analyzed! Review and save below.");
    } catch (err) {
      console.error(err);
      toast.error("Re-analysis failed");
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Model Preview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles size={16} className="text-primary" /> AI Model
        </h3>
        {modelImageUrl ? (
          <div className="w-full h-48 rounded-xl overflow-hidden bg-secondary">
            <img src={modelImageUrl} alt="AI Model" className="w-full h-full object-cover object-top" />
          </div>
        ) : (
          <div className="w-full h-32 rounded-xl bg-secondary flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No model generated yet</p>
          </div>
        )}
      </motion.div>

      {/* Re-upload Photos */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Re-upload Photos</h3>
        <p className="text-xs text-muted-foreground">Upload new photos to re-run AI analysis</p>
        <div className="flex gap-2">
          <label className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer text-center active:scale-95 transition-transform">
            <Camera size={14} className="inline mr-1" /> Face
            <input type="file" accept="image/*" className="hidden" ref={faceRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleReuploadPhotos(file, null);
              }} />
          </label>
          <label className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer text-center active:scale-95 transition-transform">
            <User size={14} className="inline mr-1" /> Body
            <input type="file" accept="image/*" className="hidden" ref={bodyRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleReuploadPhotos(null, file);
              }} />
          </label>
        </div>
        {reanalyzing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Analyzing...
          </div>
        )}
      </motion.div>

      {/* Body Type - with AI images */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Body Type</h3>
        <div className="grid grid-cols-2 gap-2">
          {bodyTypes.map(t => (
            <button key={t.label} onClick={() => setBodyType(t.label)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${
                bodyType === t.label ? "border-primary bg-primary/10" : "border-border bg-secondary/50"
              }`}>
              <OptionImageThumbnail category="body_type" label={t.label} />
              <div>
                <span className="text-xs font-semibold text-foreground block">{t.label}</span>
                <span className="text-lg">{t.emoji}</span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Skin Tone */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Skin Tone</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          {skinTones.map(t => (
            <button key={t.label} onClick={() => setSkinTone(t.label)} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full border-[3px] transition-all ${
                skinTone === t.label ? "border-primary scale-110" : "border-transparent"
              }`} style={{ backgroundColor: t.color }} />
              <span className={`text-[9px] font-medium ${skinTone === t.label ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Face Shape - with AI images */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Face Shape</h3>
        <div className="grid grid-cols-3 gap-2">
          {faceShapes.map(s => (
            <button key={s} onClick={() => setFaceShape(s)}
              className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                faceShape === s ? "border-primary bg-primary/10 text-foreground" : "border-border bg-secondary/50 text-muted-foreground"
              }`}>
              <OptionImageThumbnail category="face_shape" label={s} />
              {s}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Style Preferences - with AI images */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Style Preferences</h3>
        <div className="grid grid-cols-2 gap-2">
          {styleOptions.map(s => (
            <button key={s} onClick={() => toggleStyle(s)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                selectedStyles.includes(s) ? "border-primary bg-primary/10 text-foreground" : "border-border bg-secondary/50 text-muted-foreground"
              }`}>
              <OptionImageThumbnail category="style" label={s} />
              {s}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Save & Regenerate */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <button
          onClick={handleSaveAndRegenerate}
          disabled={saving || regenerating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {regenerating ? (
            <><Loader2 size={16} className="animate-spin" /> Regenerating Model...</>
          ) : saving ? (
            <><Loader2 size={16} className="animate-spin" /> Saving...</>
          ) : (
            <><RefreshCw size={16} /> Save & Regenerate Model</>
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default StyleProfileEditor;
