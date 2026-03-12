import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, LogOut, User, Save, Trash2, AlertTriangle, Loader2, Lock, X, Share2, Download, RefreshCw, RotateCcw, Clock, Sparkles, Shield, Send, MessageSquare, Bookmark, Heart, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import AppHeader from "../components/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GenderPicker,
  BodyProfileSection,
  StylePreferencesSection,
  useStyleProfileActions,
} from "../components/StyleProfileEditor";

// --- Drip History helpers ---
type DripHistoryEntry = {
  id: string;
  image: string; // base64 compressed PNG
  score: number;
  killerTag: string;
  praiseLine: string;
  timestamp: number;
};

const getDripHistory = (): DripHistoryEntry[] => {
  try {
    const raw = localStorage.getItem("drip-history");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveDripHistory = (entries: DripHistoryEntry[]) => {
  try { localStorage.setItem("drip-history", JSON.stringify(entries)); } catch { /* quota */ }
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
  const [dailyRatings, setDailyRatings] = useState<any[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<any[]>([]);
  const [savedSuggestions, setSavedSuggestions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingCard, setViewingCard] = useState<DripHistoryEntry | null>(null);

  const avatarUrl = avatarPreview || profile?.avatar_url || null;

  // Style personality computation
  const [stylePersonality, setStylePersonality] = useState<string | null>(null);

  useEffect(() => {
    const computeStylePersonality = async () => {
      // Check localStorage cache (1-day TTL)
      const cached = localStorage.getItem("style-personality");
      if (cached) {
        try {
          const { tag, ts } = JSON.parse(cached);
          if (Date.now() - ts < 86400000) { setStylePersonality(tag); return; }
        } catch { /* ignore */ }
      }
      if (!user) return;
      const { data: wardrobeItems } = await supabase.from("wardrobe").select("type, style, material, color, brand").eq("user_id", user.id);
      const styles = styleActions.selectedStyles;
      const items = wardrobeItems || [];
      if (items.length === 0 && styles.length === 0) { setStylePersonality("Style Explorer"); return; }

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
      // Dark Academia — formal/classic + dark tones + wool/tweed/leather
      if ((hasStyle(["formal", "classic"]) && hasColor(["black", "brown", "navy", "dark"])) || hasMaterial(["tweed", "leather"]) && hasMaterial(["wool"])) tag = "Dark Academia";
      // Quiet Luxury — minimalist/formal + premium materials
      else if ((hasStyle(["minimalist", "formal"]) || hasStyle(["minimal"])) && hasMaterial(["cashmere", "silk", "merino"])) tag = "Quiet Luxury";
      // Cottagecore — bohemian + light/floral/linen/cotton
      else if (hasStyle(["bohemian", "boho"]) && (hasMaterial(["linen", "cotton"]) || hasColor(["white", "cream", "pastel", "floral"]))) tag = "Cottagecore";
      // Techwear — sporty/urban + synthetic/nylon
      else if (hasStyle(["sporty", "urban"]) && hasMaterial(["nylon", "synthetic", "polyester", "gore-tex"])) tag = "Techwear";
      // Y2K Nostalgia — streetwear + bright/bold + denim/crop
      else if (hasStyle(["streetwear", "street"]) && (hasColor(["pink", "blue", "bright", "neon"]) || hasType(["crop", "denim"]))) tag = "Y2K Nostalgia";
      // Grunge — street + plaid/denim + dark tones
      else if (hasStyle(["street", "grunge"]) && hasColor(["black", "grey", "dark"])) tag = "Grunge";
      // Preppy — classic/smart + polo/blazer
      else if (hasStyle(["classic", "smart", "preppy"]) && (hasType(["polo", "blazer", "chino"]) || hasMaterial(["cotton"]))) tag = "Preppy";
      // Streetcore
      else if (hasStyle(["streetwear", "street", "urban", "hip"])) tag = "Streetcore";
      // Classic Sophisticate
      else if (hasStyle(["formal", "classic"]) || hasMaterial(["silk", "wool", "cashmere"])) tag = "Classic Sophisticate";
      // Elegant Minimalist
      else if (hasStyle(["minimalist", "minimal"]) || (hasStyle(["casual"]) && items.length < 15)) tag = "Elegant Minimalist";
      // Boho Spirit
      else if (hasStyle(["bohemian", "boho"])) tag = "Boho Spirit";
      // Athleisure Icon
      else if (hasStyle(["sporty", "gym", "athletic"])) tag = "Athleisure Icon";
      // Vintage Rebel
      else if (hasStyle(["vintage", "retro"])) tag = "Vintage Rebel";
      // Smart Casual
      else if (hasStyle(["casual", "smart"])) tag = "Smart Casual";
      // Eclectic Mix — high variety of styles
      else if (uniqueStyles.size >= 5) tag = "Eclectic Mix";

      setStylePersonality(tag);
      localStorage.setItem("style-personality", JSON.stringify({ tag, ts: Date.now() }));
    };
    computeStylePersonality();
  }, [user, styleActions.selectedStyles]);

  useEffect(() => {
    if (profile?.name !== undefined && profile?.name !== null) {
      setName(profile.name);
    }
  }, [profile?.name]);

  useEffect(() => {
    setDripHistory(getDripHistory());
  }, []);

  const loadDailyRatings = async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("daily_ratings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setDailyRatings(data || []);
    setHistoryLoading(false);
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
    // Save name
    const { error } = await supabase.from("profiles").update({ name }).eq("user_id", user.id);
    // Save gender to style_profiles
    await supabase.from("style_profiles").upsert({ user_id: user.id, gender: styleActions.gender || null }, { onConflict: "user_id" });
    if (error) { toast.error("Failed to update profile"); }
    else { await refreshProfile(); toast.success("Profile updated!"); }
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
      ]);
      localStorage.removeItem("drip-history");
      await signOut();
      toast.success("Account data deleted. You've been signed out.");
      navigate("/auth", { replace: true });
    } catch { toast.error("Failed to delete account data."); }
    finally { setDeleting(false); }
  };

  const deleteDripEntry = (id: string) => {
    const updated = dripHistory.filter(e => e.id !== id);
    setDripHistory(updated);
    saveDripHistory(updated);
    if (viewingCard?.id === id) setViewingCard(null);
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

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
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
                <button onClick={() => deleteDripEntry(viewingCard.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/30 text-red-400 text-xs tracking-wider">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </motion.div>
          )}
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
        <Tabs defaultValue="personal" className="w-full" onValueChange={(v) => { if (v === "history") loadDailyRatings(); }}>
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

            <button onClick={styleActions.handleSaveAndRegenerate} disabled={styleActions.saving || styleActions.regenerating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
              {styleActions.regenerating ? (
                <><Loader2 size={16} className="animate-spin" /> Regenerating Model...</>
              ) : styleActions.saving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                <><RefreshCw size={16} /> Save & Regenerate Model</>
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
          <TabsContent value="history" className="space-y-5 mt-4">
            {/* Drip History */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50 flex items-center gap-2">
                <Sparkles size={12} /> Drip History
              </h3>
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
                      <button onClick={(e) => { e.stopPropagation(); deleteDripEntry(entry.id); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} className="text-white" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Outfit History from DB */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.15em] text-foreground/50 flex items-center gap-2">
                <Clock size={12} /> Outfit Check History
              </h3>
              {historyLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : dailyRatings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No outfit ratings yet.</p>
              ) : (
                <div className="space-y-2">
                  {dailyRatings.map((r) => (
                    <div key={r.id} className="glass-card p-3 flex items-center gap-3">
                      {r.image_url && (
                        <img src={r.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{r.score}/10</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        {r.ai_feedback && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.ai_feedback}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Sign Out & Delete — always visible */}
        <div className="space-y-3 pt-2">
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive font-medium text-sm active:scale-[0.98] transition-transform">
            <LogOut size={16} /> Sign Out
          </button>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive/70 font-medium text-sm active:scale-[0.98] transition-transform">
              <Trash2 size={16} /> Delete Account
            </button>
          ) : (
            <div className="glass-card border-destructive/30 p-5 space-y-4">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
