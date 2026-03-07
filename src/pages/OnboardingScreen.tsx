import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles, Check, Camera, Upload, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const bodyTypes = [
  { label: "Hourglass", desc: "Balanced bust & hips, defined waist", emoji: "⏳" },
  { label: "Pear", desc: "Hips wider than shoulders", emoji: "🍐" },
  { label: "Rectangle", desc: "Even proportions, straight silhouette", emoji: "▬" },
  { label: "Apple", desc: "Broader midsection, slimmer legs", emoji: "🍎" },
  { label: "Inverted Triangle", desc: "Broad shoulders, narrow hips", emoji: "🔻" },
  { label: "Athletic", desc: "Muscular, well-defined build", emoji: "💪" },
  { label: "Slim", desc: "Lean frame, narrow build", emoji: "🧍" },
  { label: "Plus Size", desc: "Fuller, curvier figure", emoji: "🌸" },
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
  { label: "Square", desc: "Strong jawline" },
  { label: "Heart", desc: "Wide forehead, narrow chin" },
  { label: "Oblong", desc: "Longer face" },
  { label: "Diamond", desc: "Narrow forehead & chin" },
];

const styleOptions = [
  { label: "Casual", desc: "Relaxed & comfortable" },
  { label: "Formal", desc: "Sharp & polished" },
  { label: "Streetwear", desc: "Urban & trendy" },
  { label: "Minimalist", desc: "Clean & simple" },
  { label: "Bohemian", desc: "Free-spirited & artsy" },
  { label: "Classic", desc: "Timeless & elegant" },
  { label: "Sporty", desc: "Active & athletic" },
];

type AnalysisResult = {
  face_analysis?: {
    face_shape?: string;
    skin_tone?: string;
    skin_undertone?: string;
    hair_color?: string;
    eye_color?: string;
    facial_features?: string;
  };
  body_analysis?: {
    body_type?: string;
    build?: string;
    height_estimate?: string;
    proportions?: string;
    shoulder_type?: string;
    best_features?: string;
    styling_notes?: string;
  };
  model_description?: string;
};

const OnboardingScreen = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Steps: 0=Photos, 1=Body(conditional), 2=Style, 3=ModelGen+Done
  const [step, setStep] = useState(0);

  // Photo state
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [bodyPreview, setBodyPreview] = useState<string | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [bodyFile, setBodyFile] = useState<File | null>(null);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [uploadingBody, setUploadingBody] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [photosProvided, setPhotosProvided] = useState(false);

  // Manual selection state
  const [bodyType, setBodyType] = useState<string | null>(null);
  const [skinTone, setSkinTone] = useState<string | null>(null);
  const [faceShape, setFaceShape] = useState<string | null>(null);

  // Style state
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Final state
  const [saving, setSaving] = useState(false);
  const [generatingModel, setGeneratingModel] = useState(false);
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);

  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaceFile(file);
    setFacePreview(URL.createObjectURL(file));
  };

  const handleBodyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBodyFile(file);
    setBodyPreview(URL.createObjectURL(file));
  };

  const uploadPhotosAndAnalyze = async () => {
    if (!user || (!faceFile && !bodyFile)) return;
    setAnalyzing(true);

    try {
      // Upload photos to storage
      let faceUrl: string | null = null;
      let bodyUrl: string | null = null;

      if (faceFile) {
        setUploadingFace(true);
        const ext = faceFile.name.split(".").pop();
        const path = `${user.id}/face.${ext}`;
        await supabase.storage.from("wardrobe").upload(path, faceFile, { upsert: true });
        const { data } = supabase.storage.from("wardrobe").getPublicUrl(path);
        faceUrl = `${data.publicUrl}?t=${Date.now()}`;
        setUploadingFace(false);
      }

      if (bodyFile) {
        setUploadingBody(true);
        const ext = bodyFile.name.split(".").pop();
        const path = `${user.id}/body.${ext}`;
        await supabase.storage.from("wardrobe").upload(path, bodyFile, { upsert: true });
        const { data } = supabase.storage.from("wardrobe").getPublicUrl(path);
        bodyUrl = `${data.publicUrl}?t=${Date.now()}`;
        setUploadingBody(false);
      }

      // Also set as avatar if face photo provided
      if (faceUrl) {
        await supabase.from("profiles").update({ avatar_url: faceUrl }).eq("user_id", user.id);
      }

      // Call AI analysis
      const faceB64 = faceFile ? await fileToBase64(faceFile) : null;
      const bodyB64 = bodyFile ? await fileToBase64(bodyFile) : null;

      const { data, error } = await supabase.functions.invoke("analyze-body-profile", {
        body: { faceImageBase64: faceB64, bodyImageBase64: bodyB64 },
      });

      if (error) throw error;

      setAnalysisResult(data);
      setPhotosProvided(true);

      // Auto-fill from analysis
      if (data.face_analysis) {
        if (data.face_analysis.face_shape) setFaceShape(data.face_analysis.face_shape);
        if (data.face_analysis.skin_tone) setSkinTone(data.face_analysis.skin_tone);
      }
      if (data.body_analysis) {
        if (data.body_analysis.body_type) setBodyType(data.body_analysis.body_type);
      }

      // Save photo URLs and analysis to DB
      await supabase.from("style_profiles").upsert({
        user_id: user.id,
        face_photo_url: faceUrl,
        body_photo_url: bodyUrl,
        ai_face_analysis: data.face_analysis || null,
        ai_body_analysis: data.body_analysis || null,
      }, { onConflict: "user_id" });

      toast.success("AI analysis complete! ✨");
      // Go to body profile step so user can review/edit AI results
      setStep(1);
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Analysis failed. You can set preferences manually.");
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleStyle = (s: string) => {
    setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const generateModelAndFinish = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Save style profile
      await supabase.from("style_profiles").upsert({
        user_id: user.id,
        body_type: bodyType,
        skin_tone: skinTone,
        face_shape: faceShape,
        style_type: selectedStyles.join(",") || null,
      }, { onConflict: "user_id" });

      // Generate model avatar
      setGeneratingModel(true);
      const modelDesc = analysisResult?.model_description || 
        `A person with ${skinTone || "medium"} skin tone, ${bodyType || "average"} body type, ${faceShape || "oval"} face shape. Standing pose, full body.`;

      const { data, error } = await supabase.functions.invoke("generate-model-avatar", {
        body: { modelDescription: modelDesc, userId: user.id },
      });

      if (error) {
        console.error("Model generation error:", error);
        // Continue anyway
      } else if (data?.imageUrl) {
        setModelImageUrl(data.imageUrl);
      }

      setGeneratingModel(false);
      await refreshProfile();
      toast.success("Your AI stylist is ready! 🎨");
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete setup");
      // Try to navigate anyway
      await refreshProfile();
      navigate("/", { replace: true });
    } finally {
      setSaving(false);
      setGeneratingModel(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("style_profiles").upsert({ user_id: user.id }, { onConflict: "user_id" });
      await refreshProfile();
      navigate("/", { replace: true });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = 4; // Always 4 steps: Photos, Body, Style, Done

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
          {["Photos", "Body", "Style", "Done"].map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all duration-500 ${i <= step ? "gradient-accent" : "bg-secondary"}`} />
              <span className={`text-[10px] font-medium transition-colors ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait" custom={1}>
          {/* Step 0: Photo Upload */}
          {step === 0 && (
            <motion.div key="photos" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 flex flex-col gap-6">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">Let's Get to Know You</h1>
                <p className="text-sm text-muted-foreground mt-1">Upload photos for AI body & face analysis, or skip to set preferences manually</p>
              </div>

              {analyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Sparkles size={40} className="text-primary" />
                  </motion.div>
                  <p className="text-base font-medium text-foreground">AI is analyzing your photos...</p>
                  <p className="text-sm text-muted-foreground text-center">Detecting body type, skin tone, face shape & more</p>
                  <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full gradient-accent rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 8, ease: "linear" }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Face Photo */}
                  <div className="glass-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Face Photo</h3>
                      <span className="text-[10px] text-muted-foreground ml-auto">For skin tone & face shape</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      {facePreview ? (
                        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-secondary flex-shrink-0">
                          <img src={facePreview} alt="Face" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                          <Camera size={28} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <label className="px-4 py-2.5 rounded-xl gradient-accent text-accent-foreground text-xs font-medium cursor-pointer text-center active:scale-95 transition-transform">
                          <Camera size={14} className="inline mr-1.5" />
                          {facePreview ? "Retake" : "Take Selfie"}
                          <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFaceUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
                        </label>
                        <label className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer text-center active:scale-95 transition-transform">
                          <Upload size={14} className="inline mr-1.5" />
                          Gallery
                          <input type="file" accept="image/*" className="hidden" onChange={handleFaceUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} ref={faceInputRef} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Body Photo */}
                  <div className="glass-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Full Body Photo</h3>
                      <span className="text-[10px] text-muted-foreground ml-auto">For body type & proportions</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      {bodyPreview ? (
                        <div className="w-24 h-32 rounded-2xl overflow-hidden bg-secondary flex-shrink-0">
                          <img src={bodyPreview} alt="Body" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-24 h-32 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                          <User size={32} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <label className="px-4 py-2.5 rounded-xl gradient-accent text-accent-foreground text-xs font-medium cursor-pointer text-center active:scale-95 transition-transform">
                          <Camera size={14} className="inline mr-1.5" />
                          {bodyPreview ? "Retake" : "Take Photo"}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBodyUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
                        </label>
                        <label className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer text-center active:scale-95 transition-transform">
                          <Upload size={14} className="inline mr-1.5" />
                          Gallery
                          <input type="file" accept="image/*" className="hidden" onChange={handleBodyUpload} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} ref={bodyInputRef} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {(faceFile || bodyFile) && (
                    <button
                      onClick={uploadPhotosAndAnalyze}
                      className="w-full py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <Sparkles size={20} />
                      Analyze with AI
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Step 1: Body Profile (always shown — editable AI results or manual) */}
          {step === 1 && (
            <motion.div key="body" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 space-y-5 overflow-y-auto">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">Your Body Profile</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {photosProvided ? "AI detected these — feel free to adjust" : "Select what matches you best"}
                </p>
              </div>

              {photosProvided && analysisResult && (
                <div className="glass-card-elevated p-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-primary flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Values pre-filled from AI analysis. Edit anything that doesn't look right.
                  </p>
                </div>
              )}

              {/* Body Type */}
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Body Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {bodyTypes.map(t => (
                    <button
                      key={t.label}
                      onClick={() => setBodyType(t.label)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        bodyType === t.label
                          ? "border-primary bg-primary/10 shadow-soft"
                          : "border-border bg-secondary/50"
                      }`}
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <div>
                        <span className="text-xs font-semibold text-foreground block">{t.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone */}
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Skin Tone</h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {skinTones.map(t => (
                    <button key={t.label} onClick={() => setSkinTone(t.label)} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-12 h-12 rounded-full border-[3px] transition-all ${
                          skinTone === t.label ? "border-primary scale-110 shadow-soft" : "border-transparent"
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
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        faceShape === t.label ? "border-primary bg-primary/10 shadow-soft" : "border-border bg-secondary/50"
                      }`}
                    >
                      <span className="text-xs font-semibold text-foreground">{t.label}</span>
                      <span className="text-[9px] text-muted-foreground text-center">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Style Preferences */}
          {step === 2 && (
            <motion.div key="style" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 space-y-5">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">Style Preferences</h1>
                <p className="text-sm text-muted-foreground mt-1">Pick the styles you love (select multiple)</p>
              </div>

              {/* Show AI analysis summary if photos were provided */}
              {photosProvided && analysisResult && (
                <div className="glass-card-elevated p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles size={14} className="text-primary" /> AI Analysis Results
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.body_analysis?.body_type && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-foreground">
                        {analysisResult.body_analysis.body_type}
                      </span>
                    )}
                    {analysisResult.face_analysis?.skin_tone && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-foreground">
                        {analysisResult.face_analysis.skin_tone} skin
                      </span>
                    )}
                    {analysisResult.face_analysis?.face_shape && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-foreground">
                        {analysisResult.face_analysis.face_shape} face
                      </span>
                    )}
                    {analysisResult.body_analysis?.build && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-foreground">
                        {analysisResult.body_analysis.build} build
                      </span>
                    )}
                  </div>
                  {analysisResult.body_analysis?.styling_notes && (
                    <p className="text-[11px] text-muted-foreground">{analysisResult.body_analysis.styling_notes}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {styleOptions.map(s => {
                  const selected = selectedStyles.includes(s.label);
                  return (
                    <button
                      key={s.label}
                      onClick={() => toggleStyle(s.label)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        selected ? "border-primary bg-primary/10 shadow-soft" : "border-border bg-secondary/50"
                      }`}
                    >
                      <span className="text-sm font-semibold text-foreground">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                      {selected && <Check size={14} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 3: Generating Model + Done */}
          {step === 3 && (
            <motion.div key="done" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="flex-1 flex flex-col items-center justify-center gap-6">
              {generatingModel || saving ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Sparkles size={40} className="text-primary" />
                  </motion.div>
                  <h1 className="font-display text-2xl font-semibold text-foreground text-center">
                    {generatingModel ? "Creating Your AI Model..." : "Setting up your profile..."}
                  </h1>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    {generatingModel ? "Generating a personalized fashion avatar based on your features" : "Almost done!"}
                  </p>
                  <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div className="h-full gradient-accent rounded-full" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 12, ease: "linear" }} />
                  </div>
                </>
              ) : (
                <>
                  {modelImageUrl && (
                    <div className="w-48 h-64 rounded-2xl overflow-hidden shadow-elevated">
                      <img src={modelImageUrl} alt="Your AI Model" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-20 h-20 rounded-full gradient-accent flex items-center justify-center shadow-elevated">
                    <Sparkles size={36} className="text-accent-foreground" />
                  </motion.div>
                  <h1 className="font-display text-2xl font-semibold text-foreground text-center">You're All Set!</h1>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">Your AI stylist is ready to create personalized outfit suggestions</p>
                  <button onClick={() => { refreshProfile(); navigate("/", { replace: true }); }} className="px-8 py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center gap-2">
                    <Sparkles size={20} /> Start Styling
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {step < 3 && !analyzing && (
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => {
                if (step === 0) handleSkip();
                else setStep(step - 1);
              }}
              disabled={saving}
              className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium"
            >
              {step === 0 ? "Skip" : <><ChevronLeft size={16} className="inline" /> Back</>}
            </button>
            <button
              onClick={() => {
                if (step === 0) {
                  setStep(1);
                } else if (step === 1) {
                  setStep(2);
                } else if (step === 2) {
                  setStep(3);
                  generateModelAndFinish();
                }
              }}
              disabled={step === 2 && selectedStyles.length === 0}
              className="px-6 py-2 rounded-full gradient-accent text-accent-foreground text-sm font-medium shadow-soft disabled:opacity-50 flex items-center gap-1"
            >
              {step === 2 ? (
                <><Sparkles size={14} /> Finish</>
              ) : (
                <>Next <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;
