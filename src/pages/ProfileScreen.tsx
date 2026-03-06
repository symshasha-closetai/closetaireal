import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, LogOut, User, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";

const ProfileScreen = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile?.name || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const avatarUrl = avatarPreview || profile?.avatar_url || null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload avatar");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("wardrobe")
      .getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Failed to save avatar");
    } else {
      setAvatarPreview(publicUrl);
      await refreshProfile();
      toast.success("Avatar updated!");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      await refreshProfile();
      toast.success("Profile updated!");
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-6">
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-secondary border-2 border-border overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gradient-accent flex items-center justify-center shadow-soft"
            >
              <Camera size={14} className="text-accent-foreground" />
            </button>
          </div>
          <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card-elevated p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground text-sm cursor-not-allowed"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </motion.div>

        {/* Logout */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive font-medium text-sm active:scale-[0.98] transition-transform"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileScreen;
