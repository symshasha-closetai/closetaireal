import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Sparkles } from "lucide-react";
import ScoreRing from "../components/ScoreRing";

const CameraScreen = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<null | {
    score: number;
    color: number;
    style: number;
    occasion: string;
    advice: string;
  }>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setResult(null);
    simulateAnalysis();
  };

  const simulateAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setResult({
        score: 7.9,
        color: 8.4,
        style: 7.5,
        occasion: "Casual / Weekend",
        advice: "Your shirt pairs well with these jeans. Adding white sneakers from your wardrobe would elevate the look.",
      });
      setAnalyzing(false);
    }, 2000);
  };

  const clearImage = () => {
    setImage(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-semibold text-foreground">Rate My Outfit</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload or capture your outfit for AI analysis</p>
        </motion.div>

        <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleUpload} />

        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card-elevated overflow-hidden"
            >
              <div className="aspect-[3/4] flex flex-col items-center justify-center gap-6 p-8">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                  <Camera size={32} className="text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium text-foreground">Capture Your Look</p>
                  <p className="text-sm text-muted-foreground">Take a photo or upload from gallery</p>
                </div>
                <div className="flex gap-3 w-full max-w-xs">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform"
                  >
                    <Camera size={16} />
                    Camera
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm active:scale-[0.98] transition-transform"
                  >
                    <Upload size={16} />
                    Gallery
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="glass-card-elevated overflow-hidden relative">
                <img src={image} alt="Outfit" className="w-full aspect-[3/4] object-cover" />
                <button
                  onClick={clearImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-foreground/60 text-primary-foreground flex items-center justify-center backdrop-blur-sm"
                >
                  <X size={16} />
                </button>
                {analyzing && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      >
                        <Sparkles size={28} className="text-accent" />
                      </motion.div>
                      <p className="text-sm font-medium text-foreground">Analyzing your outfit...</p>
                    </div>
                  </div>
                )}
              </div>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card-elevated p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">AI Analysis</h3>
                    <span className="px-3 py-1 rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                      {result.occasion}
                    </span>
                  </div>

                  <div className="flex justify-around">
                    <ScoreRing score={result.score} label="Overall" />
                    <ScoreRing score={result.color} label="Color" size={70} colorClass="stroke-fashion-sage" />
                    <ScoreRing score={result.style} label="Style" size={70} colorClass="stroke-fashion-gold" />
                  </div>

                  <div className="bg-secondary/50 rounded-xl p-3.5">
                    <p className="text-sm text-secondary-foreground leading-relaxed">"{result.advice}"</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Rating */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-1">Daily Outfit Rating</h3>
          <p className="text-xs text-muted-foreground">Rate one outfit per day and track your style progress</p>
          <div className="flex gap-2 mt-3">
            {[7.2, 8.1, 6.9, 8.5, 7.8].map((s, i) => (
              <div key={i} className="flex-1 bg-secondary rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">Day {i + 1}</p>
                <p className="text-sm font-semibold text-foreground">{s}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CameraScreen;
