import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, LogOut, User, Save, Trash2, AlertTriangle, Loader2, Lock, X, Share2, Download, RefreshCw, RotateCcw, Clock, Sparkles, Shield, Send, MessageSquare, Bookmark, Heart, ShoppingBag, Palette, Briefcase, Leaf, Droplet, Shirt, Smile, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import AppHeader from "../components/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ScoreRing from "../components/ScoreRing";
import {
  GenderPicker,
  BodyProfileSection,
  StylePreferencesSection,
  useStyleProfileActions,
} from "../components/StyleProfileEditor";

// --- Drip History helpers ---
type DripHistoryEntry = {
  id: string;
  image: string;
  score: number;
  killerTag: string;
  praiseLine: string;
  timestamp: number;
  dbId?: string; // DB row id for deletion
  fullResult?: any; // Full RatingResult for OutfitRatingCard
};

// --- Suggest Me Section ---
const SuggestMeSection = ({ userId }: { userId?: string }) => {
  const [suggestion, setSuggestion] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!suggestion.trim() || !userId) return;
    setSending(true);
    const { error } = await supabase.from("user_suggestions" as any).insert({ user_id: userId, suggestion: suggestion.trim() } as any);
    if (error) { toast.error("Failed to send suggestion"); }
    else { toast.success("Thanks for your feedback! 💜"); setSuggestion(""); }
    setSending(false);
  };

  return (
    <div className="glass-card-elevated p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-primary" />
        <label className="text-xs font-medium text-foreground">Suggest Me</label>
      </div>
      <textarea
        value={suggestion}
        onChange={(e) => setSuggestion(e.target.value)}
        placeholder="Tell us anything — what you'd like to improve, features you want, style goals..."
        className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all resize-none min-h-[80px]"
        rows={3}
      />
      <button onClick={handleSend} disabled={sending || !suggestion.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-accent-foreground font-medium text-xs shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
        <Send size={14} />
        {sending ? "Sending..." : "Send Suggestion"}
      </button>
    </div>
  );
};

const ProfileScreen = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile?.name || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Style profile actions
  const styleActions = useStyleProfileActions();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // History
  const [dripHistory, setDripHistory] = useState<DripHistoryEntry[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("saved-outfits") || "[]"); } catch { return []; }
  });
  const [savedSuggestions, setSavedSuggestions] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("saved-suggestions") || "[]"); } catch { return []; }
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingCard, setViewingCard] = useState<DripHistoryEntry | null>(null);
  const [viewingSavedOutfit, setViewingSavedOutfit] = useState<any>(null);

  // Pull-to-refresh
  const pullRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 60;

  const handlePullRefresh = async () => {
    setIsRefreshing(true);
    await syncHistoryFromDb();
    setIsRefreshing(false);
    toast.success("History synced", { duration: 1500 });
  };

  const avatarUrl = avatarPreview || profile?.avatar_url || null;

  // Style personality computation
  const [stylePersonality, setStylePersonality] = useState<string | null>(null);

  useEffect(() => {
    const computeStylePersonality = async () => {
      if (!user) return;
      const { data: wardrobeItems } = await supabase.from("wardrobe").select("type, style, material, color, brand").eq("user_id", user.id);
      const styles = styleActions.selectedStyles;
      const items = wardrobeItems || [];

      const sortedItems = [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const currentHash = JSON.stringify({ items: sortedItems.map(i => ({ t: i.type, s: i.style, m: i.material, c: i.color, b: i.brand })), styles: [...styles].sort() });

      const cached = localStorage.getItem("style-personality");
      if (cached) {
        try {
          const { tag, hash } = JSON.parse(cached);
          if (hash === currentHash) { setStylePersonality(tag); return; }
        } catch { /* ignore */ }
      }

      if (items.length === 0 && styles.length === 0) {
        const tag = "Style Explorer";
        setStylePersonality(tag);
        localStorage.setItem("style-personality", JSON.stringify({ tag, hash: currentHash }));
        return;
      }

      const typeCount: Record<string, number> = {};
      const styleCount: Record<string, number> = {};
      const materialCount: Record<string, number> = {};
      items.forEach(i => {
        if (i.type) typeCount[i.type.toLowerCase()] = (typeCount[i.type.toLowerCase()] || 0) + 1;
        if (i.style) styleCount[i.style.toLowerCase()] = (styleCount[i.style.toLowerCase()] || 0) + 1;
        if (i.material) materialCount[i.material.toLowerCase()] = (materialCount[i.material.toLowerCase()] || 0) + 1;
      });
      styles.forEach(s => { styleCount[s.toLowerCase()] = (styleCount[s.toLowerCase()] || 0) + 2; });

      const hasStyle = (keywords: string[]) => keywords.some(k => Object.keys(styleCount).some(s => s.includes(k)));
      const hasMaterial = (keywords: string[]) => keywords.some(k => Object.keys(materialCount).some(m => m.includes(k)));
      const hasColor = (keywords: string[]) => keywords.some(k => items.some(i => i.color?.toLowerCase().includes(k)));
      const hasType = (keywords: string[]) => keywords.some(k => Object.keys(typeCount).some(t => t.includes(k)));
      const uniqueStyles = new Set(Object.keys(styleCount));

      let tag = "Style Explorer";
      if ((hasStyle(["formal", "classic"]) && hasColor(["black", "brown", "navy", "dark"])) || hasMaterial(["tweed", "leather"]) && hasMaterial(["wool"])) tag = "Dark Academia";
      else if ((hasStyle(["minimalist", "formal"]) || hasStyle(["minimal"])) && hasMaterial(["cashmere", "silk", "merino"])) tag = "Quiet Luxury";
      else if (hasStyle(["bohemian", "boho"]) && (hasMaterial(["linen", "cotton"]) || hasColor(["white", "cream", "pastel", "floral"]))) tag = "Cottagecore";
      else if (hasStyle(["sporty", "urban"]) && hasMaterial(["nylon", "synthetic", "polyester", "gore-tex"])) tag = "Techwear";
      else if (hasStyle(["streetwear", "street"]) && (hasColor(["pink", "blue", "bright", "neon"]) || hasType(["crop", "denim"]))) tag = "Y2K Nostalgia";
      else if (hasStyle(["street", "grunge"]) && hasColor(["black", "grey", "dark"])) tag = "Grunge";
      else if (hasStyle(["classic", "smart", "preppy"]) && (hasType(["polo", "blazer", "chino"]) || hasMaterial(["cotton"]))) tag = "Preppy";
      else if (hasStyle(["streetwear", "street", "urban", "hip"])) tag = "Streetcore";
      else if (hasStyle(["formal", "classic"]) || hasMaterial(["silk", "wool", "cashmere"])) tag = "Classic Sophisticate";
      else if (hasStyle(["minimalist", "minimal"]) || (hasStyle(["casual"]) && items.length < 15)) tag = "Elegant Minimalist";
      else if (hasStyle(["bohemian", "boho"])) tag = "Boho Spirit";
      else if (hasStyle(["sporty", "gym", "athletic"])) tag = "Athleisure Icon";
      else if (hasStyle(["vintage", "retro"])) tag = "Vintage Rebel";
      else if (hasStyle(["casual", "smart"])) tag = "Smart Casual";
      else if (uniqueStyles.size >= 5) tag = "Eclectic Mix";

      setStylePersonality(tag);
      localStorage.setItem("style-personality", JSON.stringify({ tag, hash: currentHash }));
    };
    computeStylePersonality();
  }, [user, styleActions.selectedStyles]);

  useEffect(() => {
    if (profile?.name !== undefined && profile?.name !== null) {
      setName(profile.name);
    }
  }, [profile?.name]);

  const syncHistoryFromDb = async () => {
    if (!user) return;
    setHistoryLoading(true);
    const [outfitsRes, suggestionsRes, dripRes] = await Promise.all([
      supabase.from("saved_outfits" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("saved_suggestions" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("drip_history" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    const outfits = outfitsRes.data || [];
    const suggestions = suggestionsRes.data || [];
    setSavedOutfits(outfits);
    setSavedSuggestions(suggestions);

    // Map drip_history DB rows to DripHistoryEntry
    const dripRows = (dripRes.data || []) as any[];
    const dripEntries: DripHistoryEntry[] = dripRows.map((r: any) => ({
      id: r.id,
      image: r.image_url || "",
      score: Number(r.score) || 0,
      killerTag: r.killer_tag || "",
      praiseLine: r.praise_line || "",
      timestamp: new Date(r.created_at).getTime(),
      dbId: r.id,
    }));
    setDripHistory(dripEntries);

    try {
      localStorage.setItem("saved-outfits", JSON.stringify(outfits));
      localStorage.setItem("saved-suggestions", JSON.stringify(suggestions));
    } catch { /* quota */ }
    setHistoryLoading(false);
  };

  const deleteSavedOutfit = async (id: string) => {
    await supabase.from("saved_outfits" as any).delete().eq("id", id);
    setSavedOutfits(prev => {
      const updated = prev.filter(o => o.id !== id);
      try { localStorage.setItem("saved-outfits", JSON.stringify(updated)); } catch {}
      return updated;
    });
    toast.success("Outfit removed", { duration: 2000 });
  };

  const deleteSavedSuggestion = async (id: string) => {
    await supabase.from("saved_suggestions" as any).delete().eq("id", id);
    setSavedSuggestions(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem("saved-suggestions", JSON.stringify(updated)); } catch {}
      return updated;
    });
    toast.success("Suggestion removed", { duration: 2000 });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const { blob: compressedBlob } = await compressImage(file);
      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, compressedBlob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) { toast.error("Failed to upload avatar"); setUploading(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(path);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      if (updateError) { toast.error("Failed to save avatar"); }
      else { setAvatarPreview(publicUrl); await refreshProfile(); toast.success("Avatar updated!"); }
    } catch { toast.error("Failed to process image"); }
    setUploading(false);
  };

  const handleSavePersonal = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name }).eq("user_id", user.id);
    await supabase.from("style_profiles").upsert({ user_id: user.id, gender: styleActions.gender || null }, { onConflict: "user_id" });
    if (error) { toast.error("Failed to update profile"); }
    else { await refreshProfile(); toast.success("Profile updated!", { duration: 2000 }); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); }
    else { toast.success("Password updated!"); setNewPassword(""); setShowPasswordForm(false); }
    setChangingPassword(false);
  };

  const handleLogout = async () => { await signOut(); navigate("/auth"); };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from("wardrobe").delete().eq("user_id", user.id),
        supabase.from("outfits").delete().eq("user_id", user.id),
        supabase.from("daily_ratings").delete().eq("user_id", user.id),
        supabase.from("style_profiles").delete().eq("user_id", user.id),
        supabase.from("profiles").delete().eq("user_id", user.id),
        supabase.from("drip_history" as any).delete().eq("user_id", user.id),
      ]);
      localStorage.removeItem("drip-history");
      await signOut();
      toast.success("Account data deleted. You've been signed out.");
      navigate("/auth", { replace: true });
    } catch { toast.error("Failed to delete account data."); }
    finally { setDeleting(false); }
  };

  const deleteDripEntry = async (id: string, dbId?: string) => {
    const updated = dripHistory.filter(e => e.id !== id);
    setDripHistory(updated);
    if (viewingCard?.id === id) setViewingCard(null);
    // Delete from DB if we have a dbId
    if (dbId && user) {
      await supabase.from("drip_history" as any).delete().eq("id", dbId);
    }
    toast.success("Entry deleted");
  };

  const shareDripEntry = async (entry: DripHistoryEntry) => {
    try {
      const response = await fetch(entry.image);
      const blob = await response.blob();
      const file = new File([blob], "closetai-drip.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Drip Check — ClosetAI", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "closetai-drip.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image saved!");
      }
    } catch { toast.info("Couldn't share"); }
  };

  // Parse saved outfit data
  const parseScoreBreakdown = (sb: any) => {
    if (!sb) return null;
    try { return typeof sb === "string" ? JSON.parse(sb) : sb; } catch { return null; }
  };
  const parseReasoning = (r: any) => {
    if (!r) return null;
    try { return typeof r === "string" ? JSON.parse(r) : r; } catch { return null; }
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-6">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Fullscreen Image Preview */}
        <AnimatePresence>
          {previewImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
              <button onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-foreground/20 backdrop-blur-sm flex items-center justify-center">
                <X size={20} className="text-white" />
              </button>
              <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Drip Card Viewer */}
        <AnimatePresence>
          {viewingCard && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 gap-4" onClick={() => setViewingCard(null)}>
              <button onClick={() => setViewingCard(null)}
                className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-foreground/20 backdrop-blur-sm flex items-center justify-center">
                <X size={20} className="text-white" />
              </button>
              <img src={viewingCard.image} alt="Drip card" className="max-w-[90vw] max-h-[70vh] rounded-2xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()} />
              <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => shareDripEntry(viewingCard)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white/70 text-xs tracking-wider">
                  <Share2 size={14} /> Share
                </button>
                <button onClick={() => deleteDripEntry(viewingCard.id, viewingCard.dbId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-destructive/30 text-destructive text-xs tracking-wider">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Saved Outfit Detail View */}
        <AnimatePresence>
          {viewingSavedOutfit && (() => {
            const o = viewingSavedOutfit;
            const sb = parseScoreBreakdown(o.score_breakdown);
            const reasoning = parseReasoning(o.reasoning);

            return (
              <motion.div
                key="saved-outfit-detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-background overflow-y-auto"
              >
                <div className="max-w-lg mx-auto px-5 py-6 space-y-5 pb-32">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {o.occasion && <span className="px-2.5 py-1 rounded-full bg-secondary text-[10px] font-medium text-foreground">{o.occasion}</span>}
                      <span className="px-2.5 py-1 rounded-full bg-secondary text-[10px] font-medium text-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button onClick={() => setViewingSavedOutfit(null)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                      <X size={18} className="text-foreground" />
                    </button>
                  </div>

                  {/* Title + Score */}
                  <div className="text-center space-y-3">
                    <h2 className="font-display text-xl font-semibold text-foreground">{o.name}</h2>
                    {o.score != null && (
                      <div className="flex items-center justify-center gap-4">
                        <ScoreRing score={o.score} maxScore={10} size={64} label="Match" strokeColor="hsl(var(--primary))" />
                        <div>
                          <p className="text-2xl font-bold text-foreground">{Number(o.score).toFixed(1)}/10</p>
                          <p className="text-xs text-muted-foreground">Match Score</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Explanation */}
                  {o.explanation && (
                    <div className="glass-card p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Why This Works</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{o.explanation}</p>
                    </div>
                  )}

                  {/* Score Breakdown */}
                  {sb && (
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
                          const val = Number(sb[key]) || 0;
                          const clamped = Math.max(0, Math.min(10, val));
                          if (clamped === 0) return null;
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
                  {reasoning && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {reasoning.season && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                          <Leaf size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <div><p className="text-[10px] font-semibold text-foreground">Season</p><p className="text-[9px] text-muted-foreground leading-tight">{reasoning.season}</p></div>
                        </div>
                      )}
                      {reasoning.mood && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                          <Smile size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <div><p className="text-[10px] font-semibold text-foreground">Mood</p><p className="text-[9px] text-muted-foreground leading-tight">{reasoning.mood}</p></div>
                        </div>
                      )}
                      {reasoning.time_of_day && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                          <Sun size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <div><p className="text-[10px] font-semibold text-foreground">Time of Day</p><p className="text-[9px] text-muted-foreground leading-tight">{reasoning.time_of_day}</p></div>
                        </div>
                      )}
                      {reasoning.color_combination && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                          <Palette size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <div><p className="text-[10px] font-semibold text-foreground">Colors</p><p className="text-[9px] text-muted-foreground leading-tight">{reasoning.color_combination}</p></div>
                        </div>
                      )}
                      {reasoning.body_type && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                          <User size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <div><p className="text-[10px] font-semibold text-foreground">Body Type</p><p className="text-[9px] text-muted-foreground leading-tight">{reasoning.body_type}</p></div>
                        </div>
                      )}
                      {reasoning.skin_tone && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary">
                          <Droplet size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <div><p className="text-[10px] font-semibold text-foreground">Skin Tone</p><p className="text-[9px] text-muted-foreground leading-tight">{reasoning.skin_tone}</p></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Close */}
                  <button onClick={() => setViewingSavedOutfit(null)} className="w-full text-center text-sm text-muted-foreground font-medium py-2">
                    ← Back to History
                  </button>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <AppHeader />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="font-display text-2xl font-semibold text-foreground">Profile</h1>
        </motion.div>

        {/* Avatar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-secondary border-2 border-border overflow-hidden flex items-center justify-center">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                : <User size={32} className="text-muted-foreground" />}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gradient-accent flex items-center justify-center shadow-soft">
              <Camera size={12} className="text-accent-foreground" />
            </button>
          </div>
          <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          {uploading && <p className="text-[10px] text-muted-foreground">Uploading...</p>}
          {stylePersonality && (
            <span className="text-[11px] tracking-wider text-primary/70 bg-primary/5 border border-primary/10 rounded-full px-3 py-1">
              My Style Personality: <span className="font-semibold text-primary">{stylePersonality}</span>
            </span>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="w-full" onValueChange={(v) => { if (v === "history") syncHistoryFromDb(); }}>
          <TabsList className="w-full grid grid-cols-4 bg-secondary/50 rounded-xl h-9">
            <TabsTrigger value="personal" className="text-[11px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Personal</TabsTrigger>
            <TabsTrigger value="personality" className="text-[11px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Body</TabsTrigger>
            <TabsTrigger value="styling" className="text-[11px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Style</TabsTrigger>
            <TabsTrigger value="history" className="text-[11px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">History</TabsTrigger>
          </TabsList>

          {/* === PERSONAL TAB === */}
          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="glass-card-elevated p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                  placeholder="Your name" />
              </div>

              <GenderPicker gender={styleActions.gender} setGender={styleActions.setGender} />

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Email</label>
                <input type="email" value={user?.email || ""} disabled
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground text-sm cursor-not-allowed" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Password</label>
                  <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-[10px] text-primary font-medium">
                    {showPasswordForm ? "Cancel" : "Change"}
                  </button>
                </div>
                {showPasswordForm && (
                  <div className="space-y-2">
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                      placeholder="New password (min 6 chars)" />
                    <button onClick={handleChangePassword} disabled={changingPassword}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60">
                      {changingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                )}
              </div>

              <button onClick={handleSavePersonal} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-start gap-2.5 bg-secondary/30 border border-border/20 rounded-xl p-3">
              <Shield size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Your drip check photos & outfit ratings are stored <span className="font-semibold text-foreground/70">locally on your device only</span>. They are never uploaded to our servers.
              </p>
            </div>

            {/* Suggest Me */}
            <SuggestMeSection userId={user?.id} />
          </TabsContent>

          {/* === PERSONALITY / BODY TAB === */}
          <TabsContent value="personality" className="space-y-4 mt-4">
            <BodyProfileSection
              gender={styleActions.gender} bodyType={styleActions.bodyType} setBodyType={styleActions.setBodyType}
              skinTone={styleActions.skinTone} setSkinTone={styleActions.setSkinTone}
              faceShape={styleActions.faceShape} setFaceShape={styleActions.setFaceShape}
              onPreview={setPreviewImage} onReupload={styleActions.handleReuploadPhotos}
              reanalyzing={styleActions.reanalyzing} modelImageUrl={styleActions.modelImageUrl}
            />

            <div className="flex gap-2">
              <button onClick={styleActions.handleRefreshIllustrations} disabled={styleActions.refreshingIllustrations}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-60">
                {styleActions.refreshingIllustrations ? (
                  <><Loader2 size={14} className="animate-spin" /> Clearing...</>
                ) : (
                  <><RotateCcw size={14} /> Refresh Illustrations</>
                )}
              </button>
              <button onClick={styleActions.handleClearSuggestionCache}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium active:scale-[0.98] transition-transform">
                <Trash2 size={14} /> Clear Suggestions
              </button>
            </div>

            <button onClick={styleActions.handleSaveAndRegenerate} disabled={styleActions.saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
              {styleActions.saving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                <><Save size={16} /> Save Body Profile</>
              )}
            </button>
          </TabsContent>

          {/* === STYLING TAB === */}
          <TabsContent value="styling" className="space-y-4 mt-4">
            <StylePreferencesSection selectedStyles={styleActions.selectedStyles} toggleStyle={styleActions.toggleStyle}
              gender={styleActions.gender} onPreview={setPreviewImage} />

            <button onClick={styleActions.handleSaveStylesOnly} disabled={styleActions.saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
              <Save size={16} />
              {styleActions.saving ? "Saving..." : "Save Preferences"}
            </button>
          </TabsContent>

          {/* === HISTORY TAB === */}
          <TabsContent value="history" className="mt-4">
            <div
              ref={pullRef}
              className="space-y-5"
              onTouchStart={(e) => {
                if (pullRef.current && pullRef.current.scrollTop <= 0) {
                  touchStartY.current = e.touches[0].clientY;
                  setIsPulling(true);
                }
              }}
              onTouchMove={(e) => {
                if (!isPulling || isRefreshing) return;
                const delta = e.touches[0].clientY - touchStartY.current;
                if (delta > 0) setPullDistance(Math.min(delta * 0.5, 100));
              }}
              onTouchEnd={() => {
                if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
                  handlePullRefresh();
                }
                setPullDistance(0);
                setIsPulling(false);
              }}
            >
              {/* Pull indicator */}
              <div className="flex justify-center overflow-hidden transition-all" style={{ height: pullDistance > 10 ? Math.min(pullDistance, 50) : 0 }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  {isRefreshing ? (
                    <><Loader2 size={14} className="animate-spin" /> Syncing...</>
                  ) : pullDistance >= PULL_THRESHOLD ? (
                    <><RefreshCw size={14} /> Release to refresh</>
                  ) : (
                    <><RefreshCw size={14} style={{ transform: `rotate(${pullDistance * 3}deg)` }} /> Pull to refresh</>
                  )}
                </div>
              </div>

            {/* Drip History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50 flex items-center gap-2">
                  <Sparkles size={12} /> Drip History
                </h3>
                {dripHistory.length > 0 && (
                  <button onClick={async () => {
                    if (user) await supabase.from("drip_history" as any).delete().eq("user_id", user.id);
                    setDripHistory([]);
                    toast.success("Drip history cleared", { duration: 2000 });
                  }}
                    className="text-[10px] text-destructive/60 font-medium">Clear All</button>
                )}
              </div>
              {dripHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No drip checks saved yet. Rate an outfit to see it here!</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {dripHistory.map((entry) => (
                    <motion.div key={entry.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="relative group cursor-pointer" onClick={() => setViewingCard(entry)}>
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary">
                        <img src={entry.image} alt="Drip card" className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl p-2">
                        <p className="text-[10px] font-medium text-white">{entry.score}/10</p>
                        <p className="text-[8px] text-white/50 truncate">{entry.killerTag}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteDripEntry(entry.id, entry.dbId); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                        <X size={10} className="text-white" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Outfits */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50 flex items-center gap-2">
                  <Bookmark size={12} /> Saved Outfits
                </h3>
                {savedOutfits.length > 0 && (
                  <button onClick={async () => {
                    await Promise.all(savedOutfits.map(o => supabase.from("saved_outfits" as any).delete().eq("id", o.id)));
                    setSavedOutfits([]); localStorage.setItem("saved-outfits", "[]");
                    toast.success("All saved outfits cleared", { duration: 2000 });
                  }} className="text-[10px] text-destructive/60 font-medium">Clear All</button>
                )}
              </div>
              {savedOutfits.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No saved outfits yet. Save an outfit from Style Me!</p>
              ) : (
                <div className="space-y-2">
                  {savedOutfits.map((o: any) => (
                    <div key={o.id} className="glass-card p-3 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setViewingSavedOutfit(o)}>
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Bookmark size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground truncate">{o.name}</span>
                          <span className="text-[10px] text-muted-foreground">{o.score?.toFixed(1)}/10</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{o.occasion} • {new Date(o.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteSavedOutfit(o.id); }}
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                        <X size={10} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Suggestions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50 flex items-center gap-2">
                  <Heart size={12} /> Saved Suggestions
                </h3>
                {savedSuggestions.length > 0 && (
                  <button onClick={async () => {
                    await Promise.all(savedSuggestions.map(s => supabase.from("saved_suggestions" as any).delete().eq("id", s.id)));
                    setSavedSuggestions([]); localStorage.setItem("saved-suggestions", "[]");
                    toast.success("All saved suggestions cleared", { duration: 2000 });
                  }} className="text-[10px] text-destructive/60 font-medium">Clear All</button>
                )}
              </div>
              {savedSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No saved suggestions yet. Favourite items from Drip Check!</p>
              ) : (
                <div className="space-y-2">
                  {savedSuggestions.map((s: any) => (
                    <div key={s.id} className="glass-card p-3 flex items-center gap-3">
                      {s.image ? (
                        <img src={s.image} alt={s.item_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          {s.suggestion_type === "shopping" ? (
                            <ShoppingBag size={16} className="text-primary" />
                          ) : (
                            <Heart size={16} className="text-primary" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground truncate">{s.item_name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 border border-border/30 rounded-full px-2 py-0.5">{s.category}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.reason}</p>
                        {s.drip_score && <p className="text-[10px] text-primary mt-0.5">Drip: {s.drip_score}/10</p>}
                      </div>
                      <button onClick={() => deleteSavedSuggestion(s.id)}
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                        <X size={10} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Sign Out & Delete */}
        <motion.button onClick={handleLogout} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive font-medium text-sm active:scale-[0.98] transition-transform">
          <LogOut size={16} /> Sign Out
        </motion.button>

        {!showDeleteConfirm ? (
          <motion.button onClick={() => setShowDeleteConfirm(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-destructive/50 font-medium text-xs active:scale-[0.98] transition-transform">
            <Trash2 size={14} /> Delete Account
          </motion.button>
        ) : (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              <h3 className="font-semibold text-sm">Delete Account</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete all your data. This action cannot be undone.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Type DELETE to confirm</label>
              <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 transition-all"
                placeholder="DELETE" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || deleting}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-40 active:scale-[0.98] transition-transform">
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default ProfileScreen;
