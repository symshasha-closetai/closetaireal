import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Upload, Sparkles, Check, Camera, Shirt, Briefcase, Footprints, Circle, Flower2, Watch, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// --- Data ---
const bodyTypes = [
  { label: "Hourglass", desc: "Balanced bust & hips, defined waist" },
  { label: "Pear", desc: "Hips wider than shoulders" },
  { label: "Rectangle", desc: "Even proportions, straight silhouette" },
  { label: "Apple", desc: "Broader midsection, slimmer legs" },
  { label: "Inverted Triangle", desc: "Broad shoulders, narrow hips" },
];

const skinTones = [
  { label: "Fair", color: "#F5DEB3" },
  { label: "Light", color: "#F0C8A0" },
  { label: "Medium", color: "#D4A574" },
  { label: "Olive", color: "#B08D57" },
  { label: "Dark", color: "#8B6D4A" },
  { label: "Deep", color: "#5C3D2E" },
];

const faceShapes = [
  { label: "Oval", desc: "Slightly longer than wide" },
  { label: "Round", desc: "Equal width & length" },
  { label: "Square", desc: "Strong jawline, equal proportions" },
  { label: "Heart", desc: "Wide forehead, narrow chin" },
  { label: "Oblong", desc: "Longer face, even width" },
];

const styleOptions = [
  { label: "Casual", desc: "Relaxed & comfortable", icon: Shirt },
  { label: "Formal", desc: "Sharp & polished", icon: Briefcase },
  { label: "Streetwear", desc: "Urban & trendy", icon: Footprints },
  { label: "Minimalist", desc: "Clean & simple", icon: Circle },
  { label: "Bohemian", desc: "Free-spirited & artsy", icon: Flower2 },
  { label: "Classic", desc: "Timeless & elegant", icon: Watch },
  { label: "Sporty", desc: "Active & athletic", icon: Dumbbell },
];

const steps = ["Photo", "Body", "Style", "Done"];

// --- SVG Illustrations ---
const BodyTypeSVG = ({ type }: { type: string }) => {
  const paths: Record<string, string> = {
    Hourglass: "M20,8 Q25,8 28,12 Q30,18 26,24 Q22,28 22,32 Q22,36 26,40 Q30,46 28,52 Q25,56 20,56 Q15,56 12,52 Q10,46 14,40 Q18,36 18,32 Q18,28 14,24 Q10,18 12,12 Q15,8 20,8Z",
    Pear: "M20,8 Q24,8 26,12 Q27,16 25,20 Q23,24 23,28 Q23,32 27,36 Q32,42 30,50 Q27,56 20,56 Q13,56 10,50 Q8,42 17,36 Q17,32 17,28 Q17,24 15,20 Q13,16 14,12 Q16,8 20,8Z",
    Rectangle: "M20,8 Q25,8 27,12 Q28,18 27,24 Q26,30 26,36 Q27,42 28,48 Q27,56 20,56 Q13,56 12,48 Q13,42 14,36 Q14,30 13,24 Q12,18 13,12 Q15,8 20,8Z",
    Apple: "M20,8 Q25,8 28,12 Q31,18 30,26 Q30,34 28,38 Q26,42 25,48 Q23,56 20,56 Q17,56 15,48 Q14,42 12,38 Q10,34 10,26 Q9,18 12,12 Q15,8 20,8Z",
    "Inverted Triangle": "M20,8 Q26,8 30,12 Q33,18 31,24 Q29,28 27,32 Q25,36 24,40 Q23,46 22,52 Q21,56 20,56 Q19,56 18,52 Q17,46 16,40 Q15,36 13,32 Q11,28 9,24 Q7,18 10,12 Q14,8 20,8Z",
  };
  return (
    <svg viewBox="0 0 40 64" className="w-10 h-16 mx-auto">
      <path d={paths[type] || paths.Rectangle} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
};

const FaceShapeSVG = ({ shape }: { shape: string }) => {
  const paths: Record<string, string> = {
    Oval: "M20,4 Q32,8 32,22 Q32,36 20,40 Q8,36 8,22 Q8,8 20,4Z",
    Round: "M20,6 Q34,6 34,22 Q34,38 20,38 Q6,38 6,22 Q6,6 20,6Z",
    Square: "M8,6 L32,6 Q34,6 34,8 L34,34 Q34,40 20,40 Q6,40 6,34 L6,8 Q6,6 8,6Z",
    Heart: "M20,6 Q32,4 34,16 Q34,30 20,40 Q6,30 6,16 Q8,4 20,6Z",
    Oblong: "M20,2 Q30,4 30,20 Q30,38 20,42 Q10,38 10,20 Q10,4 20,2Z",
  };
  return (
    <svg viewBox="0 0 40 44" className="w-8 h-10 mx-auto">
      <path d={paths[shape] || paths.Oval} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
};

// --- Component ---
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

  const saveAndFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("style_profiles").upsert({
        user_id: user.id,
        body_type: bodyType,
        skin_tone: skinTone,
        face_shape: faceShape,
        style_type: selectedStyles.join(",") || null,
      }, { onConflict: "user_id" });
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile complete!");
      navigate("/", { replace: true });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("style_profiles").upsert({
        user_id: user.id,
      }, { onConflict: "user_id" });
      await refreshProfile();
      navigate("/", { replace: true });
    } catch {
      toast.error("Something went wrong");
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
            <motion.div key="body" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 space-y-6 overflow-y-auto">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">Your Body Profile</h1>
                <p className="text-sm text-muted-foreground mt-1">Help AI understand your proportions for better styling</p>
              </div>

              {/* Body Type */}
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Body Type</h3>
                <div className="grid grid-cols-3 gap-2">
                  {bodyTypes.map(t => (
                    <button
                      key={t.label}
                      onClick={() => setBodyType(t.label)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        bodyType === t.label
                          ? "border-primary bg-primary/10 shadow-soft"
                          : "border-border bg-secondary/50 hover:border-primary/40"
                      }`}
                    >
                      <BodyTypeSVG type={t.label} />
                      <span className="text-xs font-semibold text-foreground">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone */}
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Skin Tone</h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {skinTones.map(t => (
                    <button
                      key={t.label}
                      onClick={() => setSkinTone(t.label)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={`w-11 h-11 rounded-full border-[3px] transition-all ${
                          skinTone === t.label
                            ? "border-primary scale-110 shadow-soft"
                            : "border-transparent hover:border-primary/40"
                        }`}
                        style={{ backgroundColor: t.color }}
                      />
                      <span className={`text-[10px] font-medium ${skinTone === t.label ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Face Shape */}
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Face Shape</h3>
                <div className="grid grid-cols-3 gap-2">
                  {faceShapes.map(t => (
                    <button
                      key={t.label}
                      onClick={() => setFaceShape(t.label)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        faceShape === t.label
                          ? "border-primary bg-primary/10 shadow-soft"
                          : "border-border bg-secondary/50 hover:border-primary/40"
                      }`}
                    >
                      <FaceShapeSVG shape={t.label} />
                      <span className="text-xs font-semibold text-foreground">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{t.desc}</span>
                    </button>
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

              <div className="grid grid-cols-2 gap-3">
                {styleOptions.map(s => {
                  const Icon = s.icon;
                  const selected = selectedStyles.includes(s.label);
                  return (
                    <button
                      key={s.label}
                      onClick={() => toggleStyle(s.label)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        selected
                          ? "border-primary bg-primary/10 shadow-soft"
                          : "border-border bg-secondary/50 hover:border-primary/40"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? "gradient-accent" : "bg-muted"}`}>
                        <Icon size={20} className={selected ? "text-accent-foreground" : "text-muted-foreground"} />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                      {selected && <Check size={14} className="text-primary" />}
                    </button>
                  );
                })}
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
              <button onClick={saveAndFinish} disabled={saving} className="px-8 py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" /> : <Sparkles size={20} />}
                Start Styling
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : handleSkip()}
              disabled={saving}
              className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium"
            >
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
