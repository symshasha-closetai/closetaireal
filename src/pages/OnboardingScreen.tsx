import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronRight, ChevronLeft, Upload, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const bodyTypes = ["Hourglass", "Pear", "Rectangle", "Apple", "Inverted Triangle"];
const skinTones = ["Fair", "Light", "Medium", "Olive", "Dark", "Deep"];
const faceShapes = ["Oval", "Round", "Square", "Heart", "Oblong"];
const styleOptions = ["Casual", "Formal", "Streetwear", "Minimalist", "Bohemian", "Classic", "Sporty"];

const steps = ["Photo", "Body", "Style", "Done"];

const OnboardingScreen = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bodyType, setBodyType] = useState<string | null>(null);
  const [skinTone, setSkinTone] = useState<string | null>(null);
  const [faceShape, setFaceShape] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("wardrobe").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarPreview(avatarUrl);
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      await refreshProfile();
      toast.success("Photo uploaded!");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleStyle = (s: string) => {
    setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("style_profiles").upsert({
        user_id: user.id,
        body_type: bodyType,
        skin_tone: skinTone,
        face_shape: faceShape,
        style_type: selectedStyles.join(","),
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile complete!");
      navigate("/", { replace: true });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return bodyType || skinTone || faceShape;
    if (step === 2) return selectedStyles.length > 0;
    return true;
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all duration-500 ${i <= step ? "gradient-accent" : "bg-secondary"}`} />
              <span className={`text-[10px] font-medium transition-colors ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait" custom={1}>
          {step === 0 && (
            <motion.div key="photo" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 flex flex-col items-center justify-center gap-6">
              <h1 className="font-display text-2xl font-semibold text-foreground text-center">Add Your Photo</h1>
              <p className="text-sm text-muted-foreground text-center max-w-xs">Upload a profile photo so we can personalize your AI styling experience</p>

              <div className="relative w-36 h-36 rounded-full overflow-hidden bg-secondary border-2 border-border">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera size={40} className="text-muted-foreground" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <label className="px-6 py-3 rounded-full gradient-accent text-accent-foreground text-sm font-medium cursor-pointer shadow-soft active:scale-95 transition-transform">
                <Upload size={16} className="inline mr-2" />
                {avatarPreview ? "Change Photo" : "Upload Photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="body" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 space-y-6">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">Your Body Profile</h1>
                <p className="text-sm text-muted-foreground mt-1">Help AI understand your proportions for better styling</p>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Body Type</h3>
                <div className="flex flex-wrap gap-2">
                  {bodyTypes.map(t => (
                    <button key={t} onClick={() => setBodyType(t)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${bodyType === t ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Skin Tone</h3>
                <div className="flex flex-wrap gap-2">
                  {skinTones.map(t => (
                    <button key={t} onClick={() => setSkinTone(t)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${skinTone === t ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Face Shape</h3>
                <div className="flex flex-wrap gap-2">
                  {faceShapes.map(t => (
                    <button key={t} onClick={() => setFaceShape(t)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${faceShape === t ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>{t}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="style" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 space-y-6">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">Style Preferences</h1>
                <p className="text-sm text-muted-foreground mt-1">Select the styles you love (pick multiple)</p>
              </div>

              <div className="glass-card p-4">
                <div className="flex flex-wrap gap-3">
                  {styleOptions.map(s => (
                    <button key={s} onClick={() => toggleStyle(s)} className={`px-5 py-3 rounded-2xl text-sm font-medium transition-all ${selectedStyles.includes(s) ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>
                      {selectedStyles.includes(s) && <Check size={14} className="inline mr-1" />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="done" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 flex flex-col items-center justify-center gap-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-20 h-20 rounded-full gradient-accent flex items-center justify-center shadow-elevated">
                <Sparkles size={36} className="text-accent-foreground" />
              </motion.div>
              <h1 className="font-display text-2xl font-semibold text-foreground text-center">You're All Set!</h1>
              <p className="text-sm text-muted-foreground text-center max-w-xs">Your AI stylist is ready to create personalized outfit suggestions just for you</p>
              <button onClick={handleComplete} disabled={saving} className="px-8 py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" /> : <Sparkles size={20} />}
                Start Styling
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex items-center justify-between mt-8">
            <button onClick={() => step > 0 ? setStep(step - 1) : navigate("/", { replace: true })} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
              {step === 0 ? "Skip" : <><ChevronLeft size={16} className="inline" /> Back</>}
            </button>
            <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="px-6 py-2 rounded-full gradient-accent text-accent-foreground text-sm font-medium shadow-soft disabled:opacity-50 flex items-center gap-1">
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;
