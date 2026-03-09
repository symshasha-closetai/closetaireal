import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Loader2, Camera, Upload, Sparkles, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import { compressImage } from "@/lib/imageCompression";

type ClothingItem = {
  id: string;
  image_url: string;
  type: string;
  color: string | null;
  material: string | null;
  name: string | null;
};

type DetectedItem = {
  name: string;
  type: string;
  color: string | null;
  material: string | null;
};

const categories = ["All", "Tops", "Bottoms", "Shoes", "Dresses", "Accessories"];

const WardrobeScreen = () => {
  const { user, styleProfile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [selectedDetected, setSelectedDetected] = useState<number[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newType, setNewType] = useState("Tops");
  const [addMode, setAddMode] = useState<"choose" | "manual" | "ai">("choose");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; type: string; color: string; material: string }>({ name: "", type: "", color: "", material: "" });
  const [savingEdit, setSavingEdit] = useState(false);
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAddMode("ai");
    setAnalyzing(true);
    setDetectedItems([]);
    setSelectedDetected([]);

    try {
      const { base64 } = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("analyze-clothing", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      const detected = data?.items || [];
      if (detected.length === 0) {
        toast.info("No clothing items detected. You can add manually.");
        setAddMode("manual");
      } else {
        setDetectedItems(detected);
        setSelectedDetected(detected.map((_: DetectedItem, i: number) => i));
        toast.success(`Found ${detected.length} item(s)!`);
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
      toast.error("AI analysis failed. You can add manually.");
      setAddMode("manual");
    } finally {
      setAnalyzing(false);
    }
  };

  const [generatingImages, setGeneratingImages] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  const handleSaveDetected = async () => {
    if (!user || !uploadedFile || selectedDetected.length === 0) return;
    setUploading(true);
    setGeneratingImages(true);
    setGenProgress(0);

    try {
      const { base64, blob: compressedBlob } = await compressImage(uploadedFile);
      const totalItems = selectedDetected.length;
      const savedItems: ClothingItem[] = [];

      for (let i = 0; i < totalItems; i++) {
        const idx = selectedDetected[i];
        const item = detectedItems[idx];
        setGenProgress(Math.round(((i) / totalItems) * 100));

        // Generate clean product image via AI
        let imageUrl: string | null = null;
        try {
          const { data: genData, error: genError } = await supabase.functions.invoke("generate-clothing-image", {
            body: {
              imageBase64: base64,
              itemName: item.name,
              itemType: item.type,
              itemColor: item.color,
              itemMaterial: item.material,
              userId: user.id,
              bodyType: styleProfile?.body_type || null,
            },
          });

          if (!genError && genData?.imageUrl) {
            imageUrl = genData.imageUrl;
          }
        } catch (genErr) {
          console.error("Image generation failed for item:", item.name, genErr);
          // Silently continue — will fall back to original photo upload
        }

        // Fallback: upload original photo if generation failed
        if (!imageUrl) {
          const ext = uploadedFile.name.split(".").pop();
          const path = `${user.id}/${Date.now()}-${i}.${ext}`;
          await supabase.storage.from("wardrobe").upload(path, uploadedFile);
          const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(path);
          imageUrl = publicUrl;
        }

        const { data: insertData, error: insertError } = await supabase
          .from("wardrobe")
          .insert({
            user_id: user.id,
            image_url: imageUrl,
            type: item.type,
            name: item.name,
            color: item.color,
            material: item.material,
          })
          .select("id, image_url, type, color, material, name")
          .single();

        if (!insertError && insertData) savedItems.push(insertData);
      }

      setGenProgress(100);
      setItems((prev) => [...savedItems, ...prev]);
      toast.success(`${savedItems.length} item(s) added to wardrobe!`);
      resetModal();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save items");
    } finally {
      setUploading(false);
      setGeneratingImages(false);
      setGenProgress(0);
    }
  };

  const handleManualSave = async () => {
    if (!user || !uploadedFile) return;
    setUploading(true);

    try {
      const ext = uploadedFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, uploadedFile);

      if (uploadError) throw uploadError;

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

      if (error) throw error;

      if (data) setItems((prev) => [data, ...prev]);
      toast.success("Item added to wardrobe!");
      resetModal();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save item");
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setShowAdd(false);
    setAddMode("choose");
    setDetectedItems([]);
    setSelectedDetected([]);
    setUploadedFile(null);
    setPreviewUrl(null);
    setAnalyzing(false);
  };

  const toggleDetected = (idx: number) => {
    setSelectedDetected((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const openEdit = (item: ClothingItem) => {
    setEditingItem(item);
    setEditForm({ name: item.name || "", type: item.type, color: item.color || "", material: item.material || "" });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("wardrobe")
      .update({ name: editForm.name, type: editForm.type, color: editForm.color || null, material: editForm.material || null })
      .eq("id", editingItem.id);
    if (error) {
      toast.error("Failed to update item");
    } else {
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...editForm, color: editForm.color || null, material: editForm.material || null } : i));
      toast.success("Item updated!");
      setEditingItem(null);
    }
    setSavingEdit(false);
  };
  const updateDetectedItem = (idx: number, field: keyof DetectedItem, value: string) => {
    setDetectedItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
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
                    onClick={() => openEdit(item)}
                    className="absolute top-2 left-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  >
                    <Pencil size={13} />
                  </button>
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

        {/* Hidden file inputs */}
        <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFileSelected} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
        <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handleFileSelected} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />

        {/* Add Modal */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-5"
              onClick={resetModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-card rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto pb-24"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-lg">Add Clothing</h3>
                  <button onClick={resetModal}>
                    <X size={20} className="text-muted-foreground" />
                  </button>
                </div>

                {addMode === "choose" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Take a photo of yourself or your clothes — AI will detect and categorize each item automatically.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => cameraRef.current?.click()}
                        className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform"
                      >
                        <Camera size={24} />
                        Take Photo
                      </button>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl bg-secondary text-secondary-foreground font-medium text-sm active:scale-[0.98] transition-transform"
                      >
                        <Upload size={24} />
                        Gallery
                      </button>
                    </div>
                  </>
                )}

                {addMode === "ai" && (
                  <>
                    {previewUrl && (
                      <div className="rounded-2xl overflow-hidden">
                        <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-cover" />
                      </div>
                    )}

                    {analyzing ? (
                      <div className="flex flex-col items-center gap-3 py-6">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                          <Sparkles size={28} className="text-primary" />
                        </motion.div>
                        <p className="text-sm font-medium text-foreground">AI is analyzing your clothes...</p>
                        <p className="text-xs text-muted-foreground">Detecting items & categories</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">Edit & select items to add:</p>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {detectedItems.map((item, idx) => {
                            const selected = selectedDetected.includes(idx);
                            return (
                              <div
                                key={idx}
                                className={`rounded-xl p-3 transition-all ${
                                  selected ? "bg-primary/10 border border-primary/30" : "bg-secondary border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <button onClick={() => toggleDetected(idx)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                    selected ? "border-primary bg-primary" : "border-muted-foreground"
                                  }`}>
                                    {selected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                                  </button>
                                  <input
                                    value={item.name}
                                    onChange={(e) => updateDetectedItem(idx, "name", e.target.value)}
                                    className="flex-1 text-sm font-medium text-foreground bg-transparent border-b border-border focus:border-primary outline-none px-1 py-0.5"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2 pl-7">
                                  <select
                                    value={item.type}
                                    onChange={(e) => updateDetectedItem(idx, "type", e.target.value)}
                                    className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground"
                                  >
                                    {["Tops", "Bottoms", "Shoes", "Dresses", "Accessories"].map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                  <input
                                    value={item.color || ""}
                                    onChange={(e) => updateDetectedItem(idx, "color", e.target.value)}
                                    placeholder="Color"
                                    className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground"
                                  />
                                  <select
                                    value={item.material || ""}
                                    onChange={(e) => updateDetectedItem(idx, "material", e.target.value)}
                                    className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground"
                                  >
                                    <option value="">Material</option>
                                    {["Cotton", "Linen", "Polyester", "Silk", "Wool", "Denim", "Leather", "Nylon", "Chiffon", "Velvet", "Satin", "Other"].map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {generatingImages && (
                          <div className="w-full py-3 rounded-xl bg-secondary text-center">
                            <span className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                              <Loader2 size={16} className="animate-spin" />
                              Generating clean images... {genProgress}%
                            </span>
                            <div className="mt-2 mx-4 h-1.5 rounded-full bg-border overflow-hidden">
                              <div className="h-full rounded-full gradient-accent transition-all duration-300" style={{ width: `${genProgress}%` }} />
                            </div>
                          </div>
                        )}
                        <button
                          onClick={handleSaveDetected}
                          disabled={uploading || selectedDetected.length === 0}
                          className="w-full py-3.5 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
                        >
                          {uploading && !generatingImages ? "Saving..." : `Add ${selectedDetected.length} Item(s)`}
                        </button>
                      </>
                    )}
                  </>
                )}

                {addMode === "manual" && (
                  <>
                    {previewUrl && (
                      <div className="rounded-2xl overflow-hidden">
                        <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-cover" />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">Select a category:</p>
                    <div className="flex gap-2 flex-wrap">
                      {["Tops", "Bottoms", "Shoes", "Dresses", "Accessories"].map((t) => (
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
                    <button
                      onClick={handleManualSave}
                      disabled={uploading}
                      className="w-full py-3.5 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
                    >
                      {uploading ? "Saving..." : "Add Item"}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WardrobeScreen;
