import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";

type ClothingItem = {
  id: string;
  image_url: string;
  type: string;
  color: string | null;
  material: string | null;
  name: string | null;
};

const categories = ["All", "Tops", "Bottoms", "Shoes", "Dresses"];

const WardrobeScreen = () => {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newType, setNewType] = useState("Tops");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const fetchItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wardrobe")
      .select("id, image_url, type, color, material, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load wardrobe");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const filtered = activeCategory === "All" ? items : items.filter((i) => i.type === activeCategory);

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("wardrobe").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete item");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item removed");
    }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(path, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("wardrobe")
      .getPublicUrl(path);

    const { data, error } = await supabase
      .from("wardrobe")
      .insert({
        user_id: user.id,
        image_url: publicUrl,
        type: newType,
        name: "New Item",
      })
      .select("id, image_url, type, color, material, name")
      .single();

    if (error) {
      toast.error("Failed to save item");
    } else if (data) {
      setItems((prev) => [data, ...prev]);
      toast.success("Item added to wardrobe!");
    }

    setUploading(false);
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <AppHeader />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">My Wardrobe</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{items.length} items</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center shadow-soft active:scale-95 transition-transform"
          >
            <Plus size={20} className="text-accent-foreground" />
          </button>
        </motion.div>

        {/* Categories */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                activeCategory === cat
                  ? "gradient-accent text-accent-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No items yet. Add your first piece!</p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="glass-card overflow-hidden group relative"
                >
                  <div className="aspect-square overflow-hidden rounded-t-2xl">
                    <img src={item.image_url} alt={item.name || "Clothing"} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{item.name || "Unnamed"}</p>
                    <p className="text-[11px] text-muted-foreground">{item.color || item.type} · {item.material || "—"}</p>
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Add Modal */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => setShowAdd(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-card rounded-t-3xl p-6 space-y-4 safe-bottom"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Add Clothing</h3>
                  <button onClick={() => setShowAdd(false)}>
                    <X size={20} className="text-muted-foreground" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">Select a category and upload a photo.</p>
                
                <div className="flex gap-2 flex-wrap">
                  {["Tops", "Bottoms", "Shoes", "Dresses"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                        newType === t ? "gradient-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleAddImage} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3.5 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload Photo"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WardrobeScreen;
