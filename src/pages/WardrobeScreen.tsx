import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Loader2, Camera, Upload, Sparkles, Pencil, Save, Share2, CheckSquare, Square, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import { compressImage } from "@/lib/imageCompression";
import html2canvas from "html2canvas";

type ClothingItem = {
  id: string;
  image_url: string;
  type: string;
  color: string | null;
  material: string | null;
  name: string | null;
  brand: string | null;
  quality: string | null;
  season: string | null;
  style: string | null;
};

type DetectedItem = {
  name: string;
  type: string;
  color: string | null;
  material: string | null;
  quality: string | null;
  brand: string | null;
};

type BackgroundJob = {
  totalItems: number;
  completedItems: number;
  active: boolean;
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
  const [editForm, setEditForm] = useState<{ name: string; type: string; color: string; material: string; brand: string }>({ name: "", type: "", color: "", material: "", brand: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Multi-select sharing
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sharingItems, setSharingItems] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardItems, setShareCardItems] = useState<ClothingItem[]>([]);

  // Background generation state
  const [bgJob, setBgJob] = useState<BackgroundJob>({ totalItems: 0, completedItems: 0, active: false });
  const bgQueueRef = useRef<Array<{ items: DetectedItem[]; selected: number[]; file: File }>>([]);
  const bgProcessingRef = useRef(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterColor, setFilterColor] = useState("");
  const [filterQuality, setFilterQuality] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterSeason, setFilterSeason] = useState("");

  const activeFilterCount = [filterColor, filterQuality, filterMaterial, filterBrand, filterSeason].filter(Boolean).length;

  const clearFilters = () => {
    setFilterColor(""); setFilterQuality(""); setFilterMaterial(""); setFilterBrand(""); setFilterSeason("");
  };

  useEffect(() => { if (user) fetchItems(); }, [user]);

  const fetchItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wardrobe")
      .select("id, image_url, type, color, material, name, brand, quality, season, style")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load wardrobe");
    else setItems((data as ClothingItem[]) || []);
    setLoading(false);
  };

  // Extract unique filter values
  const uniqueColors = useMemo(() => [...new Set(items.map(i => i.color).filter(Boolean))] as string[], [items]);
  const uniqueQualities = useMemo(() => [...new Set(items.map(i => i.quality).filter(Boolean))] as string[], [items]);
  const uniqueMaterials = useMemo(() => [...new Set(items.map(i => i.material).filter(Boolean))] as string[], [items]);
  const uniqueBrands = useMemo(() => [...new Set(items.map(i => i.brand).filter(Boolean))] as string[], [items]);
  const uniqueSeasons = useMemo(() => [...new Set(items.map(i => i.season).filter(Boolean))] as string[], [items]);

  const filtered = useMemo(() => {
    let result = activeCategory === "All" ? items : items.filter((i) => i.type === activeCategory);
    if (filterColor) result = result.filter(i => i.color?.toLowerCase() === filterColor.toLowerCase());
    if (filterQuality) result = result.filter(i => i.quality?.toLowerCase() === filterQuality.toLowerCase());
    if (filterMaterial) result = result.filter(i => i.material?.toLowerCase() === filterMaterial.toLowerCase());
    if (filterBrand) result = result.filter(i => i.brand?.toLowerCase() === filterBrand.toLowerCase());
    if (filterSeason) result = result.filter(i => i.season?.toLowerCase() === filterSeason.toLowerCase());
    return result;
  }, [items, activeCategory, filterColor, filterQuality, filterMaterial, filterBrand, filterSeason]);

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("wardrobe").delete().eq("id", id);
    if (error) toast.error("Failed to delete item");
    else { setItems((prev) => prev.filter((i) => i.id !== id)); toast.success("Item removed"); }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

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
      const { data, error } = await supabase.functions.invoke("analyze-clothing", { body: { imageBase64: base64 } });
      if (error) throw error;
      const detected = data?.items || [];
      if (detected.length === 0) { toast.info("No clothing items detected."); setAddMode("manual"); }
      else { setDetectedItems(detected); setSelectedDetected(detected.map((_: DetectedItem, i: number) => i)); toast.success(`Found ${detected.length} item(s)!`); }
    } catch { toast.error("AI analysis failed."); setAddMode("manual"); }
    finally { setAnalyzing(false); }
  };

  const processQueue = useCallback(async () => {
    if (bgProcessingRef.current || bgQueueRef.current.length === 0 || !user) return;
    bgProcessingRef.current = true;
    while (bgQueueRef.current.length > 0) {
      const job = bgQueueRef.current[0];
      try {
        const { base64, blob: compressedBlob } = await compressImage(job.file);
        for (let i = 0; i < job.selected.length; i++) {
          const idx = job.selected[i];
          const item = job.items[idx];
          let imageUrl: string | null = null;
          try {
            const { data: genData, error: genError } = await supabase.functions.invoke("generate-clothing-image", {
              body: { imageBase64: base64, itemName: item.name, itemType: item.type, itemColor: item.color, itemMaterial: item.material, userId: user.id, bodyType: styleProfile?.body_type || null },
            });
            if (!genError && genData?.imageUrl) imageUrl = genData.imageUrl;
          } catch {}
          if (!imageUrl) {
            const path = `${user.id}/${Date.now()}-${i}.jpg`;
            await supabase.storage.from("wardrobe").upload(path, compressedBlob, { contentType: "image/jpeg" });
            const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(path);
            imageUrl = publicUrl;
          }
          const { data: insertData, error: insertError } = await supabase
            .from("wardrobe")
            .insert({ user_id: user.id, image_url: imageUrl, type: item.type, name: item.name, color: item.color, material: item.material, quality: item.quality, brand: item.brand } as any)
            .select("id, image_url, type, color, material, name, brand, quality, season, style")
            .single();
          if (!insertError && insertData) setItems((prev) => [insertData as ClothingItem, ...prev]);
          setBgJob(prev => ({ ...prev, completedItems: prev.completedItems + 1 }));
        }
      } catch { toast.error("Some items failed to save"); }
      bgQueueRef.current.shift();
    }
    setBgJob({ totalItems: 0, completedItems: 0, active: false });
    bgProcessingRef.current = false;
    toast.success("All items added to wardrobe!");
  }, [user, styleProfile]);

  const handleSaveDetected = async () => {
    if (!user || !uploadedFile || selectedDetected.length === 0) return;
    const itemsToSave = [...detectedItems];
    const selectedToSave = [...selectedDetected];
    const fileToSave = uploadedFile;
    bgQueueRef.current.push({ items: itemsToSave, selected: selectedToSave, file: fileToSave });
    setBgJob(prev => ({ totalItems: prev.totalItems + selectedToSave.length, completedItems: prev.completedItems, active: true }));
    resetModal();
    toast.info(`Generating images for ${selectedToSave.length} item(s)...`, { duration: 3000 });
    processQueue();
  };

  const handleManualSave = async () => {
    if (!user || !uploadedFile) return;
    setUploading(true);
    try {
      const { blob: compressedBlob } = await compressImage(uploadedFile);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("wardrobe").upload(path, compressedBlob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(path);
      const { data, error } = await supabase.from("wardrobe").insert({ user_id: user.id, image_url: publicUrl, type: newType, name: "New Item" })
        .select("id, image_url, type, color, material, name, brand").single();
      if (error) throw error;
      if (data) setItems((prev) => [data as ClothingItem, ...prev]);
      toast.success("Item added!"); resetModal();
    } catch { toast.error("Failed to save item"); }
    finally { setUploading(false); }
  };

  const resetModal = () => {
    setShowAdd(false); setAddMode("choose"); setDetectedItems([]); setSelectedDetected([]);
    setUploadedFile(null); setPreviewUrl(null); setAnalyzing(false);
  };

  const toggleDetected = (idx: number) => {
    setSelectedDetected((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]);
  };

  const openEdit = (item: ClothingItem) => {
    setEditingItem(item);
    setEditForm({ name: item.name || "", type: item.type, color: item.color || "", material: item.material || "", brand: item.brand || "" });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSavingEdit(true);
    const { error } = await supabase.from("wardrobe")
      .update({ name: editForm.name, type: editForm.type, color: editForm.color || null, material: editForm.material || null, brand: editForm.brand || null })
      .eq("id", editingItem.id);
    if (error) toast.error("Failed to update item");
    else {
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...editForm, color: editForm.color || null, material: editForm.material || null, brand: editForm.brand || null } : i));
      toast.success("Item updated!"); setEditingItem(null);
    }
    setSavingEdit(false);
  };

  const updateDetectedItem = (idx: number, field: keyof DetectedItem, value: string) => {
    setDetectedItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const shareItem = async (item: ClothingItem) => {
    setShareCardItems([item]);
    setShowShareCard(true);
    await new Promise(r => setTimeout(r, 400));
    try {
      if (!shareCardRef.current) return;
      const canvas = await html2canvas(shareCardRef.current, { useCORS: true, allowTaint: true, backgroundColor: null, scale: 2 });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) throw new Error("Failed");
      const file = new File([blob], "closetai-wardrobe.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${item.name} — ClosetAI`, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "closetai-wardrobe.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); toast.success("Image saved!");
      }
    } catch { toast.info("Couldn't share"); }
    finally { setShowShareCard(false); }
  };

  const shareMultipleItems = async () => {
    const itemsToShare = items.filter(i => selectedItems.has(i.id));
    if (itemsToShare.length === 0) return;
    setSharingItems(true);
    setShareCardItems(itemsToShare);
    setShowShareCard(true);
    await new Promise(r => setTimeout(r, 500));
    try {
      if (!shareCardRef.current) return;
      const canvas = await html2canvas(shareCardRef.current, { useCORS: true, allowTaint: true, backgroundColor: null, scale: 2 });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) throw new Error("Failed");
      const file = new File([blob], "closetai-collection.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Collection — ClosetAI", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "closetai-collection.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); toast.success("Image saved!");
      }
    } catch { toast.info("Couldn't share"); }
    finally { setShowShareCard(false); setSharingItems(false); setSelectMode(false); setSelectedItems(new Set()); }
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><AppHeader /></motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">My Wardrobe</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{items.length} items</p>
            {(() => {
              const tops = items.filter(i => i.type === "Tops").length;
              const bottoms = items.filter(i => i.type === "Bottoms").length;
              const shoes = items.filter(i => i.type === "Shoes").length;
              const outfits = Math.min(tops, bottoms, shoes);
              return outfits > 0 ? (
                <p className="text-[11px] text-muted-foreground/60">~{outfits} full outfits possible</p>
              ) : null;
            })()}
          </div>
          <div className="flex gap-2">
            {items.length > 0 && (
              <button onClick={() => { setSelectMode(!selectMode); setSelectedItems(new Set()); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${selectMode ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {selectMode ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
            )}
            <button onClick={() => setShowAdd(true)}
              className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center shadow-soft active:scale-95 transition-transform">
              <Plus size={20} className="text-accent-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Multi-select actions */}
        <AnimatePresence>
          {selectMode && selectedItems.size > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between rounded-xl bg-card border border-border/30 p-3">
              <span className="text-xs font-medium text-foreground">{selectedItems.size} selected</span>
              <button onClick={shareMultipleItems} disabled={sharingItems}
                className="flex items-center gap-2 px-4 py-2 rounded-full gradient-accent text-accent-foreground text-xs font-medium shadow-soft active:scale-95 transition-transform disabled:opacity-50">
                {sharingItems ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                Share {selectedItems.size} Items
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Background generation indicator */}
        <AnimatePresence>
          {bgJob.active && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="rounded-xl bg-card border border-border/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={14} className="animate-spin text-accent" />
                <span className="text-xs font-medium text-foreground">Generating images... {bgJob.completedItems}/{bgJob.totalItems}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                <motion.div className="h-full rounded-full gradient-accent"
                  initial={{ width: 0 }} animate={{ width: `${bgJob.totalItems > 0 ? (bgJob.completedItems / bgJob.totalItems) * 100 : 0}%` }} transition={{ duration: 0.3 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories + Filter Toggle */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  activeCategory === cat ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>
                {cat}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${showFilters ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            <SlidersHorizontal size={16} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </motion.div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="rounded-xl bg-card border border-border/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Filters</span>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-[10px] text-primary underline">Clear all</button>
                  )}
                </div>

                {uniqueColors.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Color</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueColors.map(c => (
                        <button key={c} onClick={() => setFilterColor(filterColor === c ? "" : c)}
                          className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${filterColor === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {uniqueQualities.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Quality</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueQualities.map(q => (
                        <button key={q} onClick={() => setFilterQuality(filterQuality === q ? "" : q)}
                          className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${filterQuality === q ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {uniqueMaterials.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Material</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueMaterials.map(m => (
                        <button key={m} onClick={() => setFilterMaterial(filterMaterial === m ? "" : m)}
                          className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${filterMaterial === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {uniqueBrands.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Brand</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueBrands.map(b => (
                        <button key={b} onClick={() => setFilterBrand(filterBrand === b ? "" : b)}
                          className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${filterBrand === b ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {uniqueSeasons.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Season</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueSeasons.map(s => (
                        <button key={s} onClick={() => setFilterSeason(filterSeason === s ? "" : s)}
                          className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${filterSeason === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-muted-foreground text-sm">No items yet. Add your first piece!</p></div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {filtered.map((item, i) => (
                <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={`glass-card overflow-hidden group relative ${selectMode && selectedItems.has(item.id) ? "ring-2 ring-primary" : ""}`}
                  onClick={() => selectMode && toggleSelectItem(item.id)}>
                  <div className="aspect-square overflow-hidden rounded-t-2xl">
                    <img src={item.image_url} alt={item.name || "Clothing"} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{item.name || "Unnamed"}</p>
                    <p className="text-[11px] text-muted-foreground">{item.color || item.type} · {item.material || "—"}</p>
                    {item.brand && (
                      <span className="inline-block mt-1 text-[9px] uppercase tracking-wider text-primary/70 border border-primary/20 rounded-full px-2 py-0.5">{item.brand}</span>
                    )}
                  </div>
                  {!selectMode && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <Pencil size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); shareItem(item); }}
                        className="absolute top-2 left-11 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <Share2 size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {selectMode && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center backdrop-blur-sm"
                      style={{ borderColor: selectedItems.has(item.id) ? "hsl(var(--primary))" : "rgba(255,255,255,0.5)", background: selectedItems.has(item.id) ? "hsl(var(--primary))" : "rgba(0,0,0,0.3)" }}>
                      {selectedItems.has(item.id) && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                  )}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={resetModal}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-card rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto pb-24">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-lg">Add Clothing</h3>
                  <button onClick={resetModal}><X size={20} className="text-muted-foreground" /></button>
                </div>

                {bgJob.active && (
                  <div className="rounded-xl bg-secondary/50 p-3 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-accent" />
                    <span className="text-xs text-muted-foreground">Still generating previous items... ({bgJob.completedItems}/{bgJob.totalItems})</span>
                  </div>
                )}

                {addMode === "choose" && (
                  <>
                    <p className="text-sm text-muted-foreground">Take a photo of yourself or your clothes — AI will detect and categorize each item automatically.</p>
                    <div className="flex gap-3">
                      <button onClick={() => cameraRef.current?.click()}
                        className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform">
                        <Camera size={24} /> Take Photo
                      </button>
                      <button onClick={() => fileRef.current?.click()}
                        className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl bg-secondary text-secondary-foreground font-medium text-sm active:scale-[0.98] transition-transform">
                        <Upload size={24} /> Gallery
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
                              <div key={idx} className={`rounded-xl p-3 transition-all ${selected ? "bg-primary/10 border border-primary/30" : "bg-secondary border border-transparent"}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <button onClick={() => toggleDetected(idx)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                    {selected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                                  </button>
                                  <input value={item.name} onChange={(e) => updateDetectedItem(idx, "name", e.target.value)}
                                    className="flex-1 text-sm font-medium text-foreground bg-transparent border-b border-border focus:border-primary outline-none px-1 py-0.5" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 pl-7">
                                  <select value={item.type} onChange={(e) => updateDetectedItem(idx, "type", e.target.value)}
                                    className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground">
                                    {["Tops", "Bottoms", "Shoes", "Dresses", "Accessories"].map(t => (<option key={t} value={t}>{t}</option>))}
                                  </select>
                                  <input value={item.color || ""} onChange={(e) => updateDetectedItem(idx, "color", e.target.value)}
                                    placeholder="Color" className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground" />
                                  <select value={item.material || ""} onChange={(e) => updateDetectedItem(idx, "material", e.target.value)}
                                    className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground">
                                    <option value="">Material</option>
                                    {["Cotton", "Linen", "Polyester", "Silk", "Wool", "Denim", "Leather", "Nylon", "Chiffon", "Velvet", "Satin", "Other"].map(m => (<option key={m} value={m}>{m}</option>))}
                                  </select>
                                  <input value={item.brand || ""} onChange={(e) => updateDetectedItem(idx, "brand", e.target.value)}
                                    placeholder="Brand" className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground" />
                                </div>
                                <div className="pl-7 mt-1">
                                  <span className={`text-[10px] font-medium ${
                                    item.quality === "Premium" ? "text-green-500" : item.quality === "Mid-range" ? "text-blue-500" : item.quality === "Budget" ? "text-orange-500" : "text-muted-foreground"
                                  }`}>Quality: {item.quality || "Unknown"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={handleSaveDetected} disabled={selectedDetected.length === 0}
                          className="w-full py-3.5 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
                          Add {selectedDetected.length} Item(s)
                        </button>
                      </>
                    )}
                  </>
                )}

                {addMode === "manual" && (
                  <>
                    {previewUrl && (
                      <div className="rounded-2xl overflow-hidden"><img src={previewUrl} alt="Preview" className="w-full max-h-48 object-cover" /></div>
                    )}
                    <p className="text-sm text-muted-foreground">Select a category:</p>
                    <div className="flex gap-2 flex-wrap">
                      {["Tops", "Bottoms", "Shoes", "Dresses", "Accessories"].map((t) => (
                        <button key={t} onClick={() => setNewType(t)}
                          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${newType === t ? "gradient-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleManualSave} disabled={uploading}
                      className="w-full py-3.5 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
                      {uploading ? "Saving..." : "Add Item"}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => setEditingItem(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-card rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto pb-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-lg">Edit Item</h3>
                  <button onClick={() => setEditingItem(null)}><X size={20} className="text-muted-foreground" /></button>
                </div>
                <div className="w-full h-40 rounded-2xl overflow-hidden bg-secondary">
                  <img src={editingItem.image_url} alt={editingItem.name || "Item"} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Brand</label>
                    <input value={editForm.brand} onChange={(e) => setEditForm(f => ({ ...f, brand: e.target.value }))}
                      placeholder="e.g. Nike, Zara"
                      className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select value={editForm.type} onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm">
                      {["Tops", "Bottoms", "Shoes", "Dresses", "Accessories"].map(t => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Color</label>
                      <input value={editForm.color} onChange={(e) => setEditForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. Black"
                        className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Material</label>
                      <select value={editForm.material} onChange={(e) => setEditForm(f => ({ ...f, material: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm">
                        <option value="">Select</option>
                        {["Cotton", "Linen", "Polyester", "Silk", "Wool", "Denim", "Leather", "Nylon", "Chiffon", "Velvet", "Satin", "Other"].map(m => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    </div>
                  </div>
                </div>
                <button onClick={handleSaveEdit} disabled={savingEdit}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
                  <Save size={16} /> {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Share Card */}
        {showShareCard && (
          <div ref={shareCardRef} style={{
            position: "fixed", left: "-9999px", top: 0, width: 390, zIndex: -1,
            background: "#1a1a1a", borderRadius: 24, overflow: "hidden", fontFamily: "'Inter', sans-serif",
          }}>
            {/* Brand */}
            <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, letterSpacing: 5, color: "rgba(255,255,255,0.6)", fontWeight: 300 }}>ClosetAI</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>My Collection</span>
            </div>
            {/* Items grid */}
            <div style={{ padding: "8px 16px 16px", display: "grid", gridTemplateColumns: shareCardItems.length === 1 ? "1fr" : "1fr 1fr", gap: 8 }}>
              {shareCardItems.map((item, i) => (
                <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: "#252525" }}>
                  <img src={item.image_url} alt={item.name || ""} crossOrigin="anonymous"
                    style={{ width: "100%", height: shareCardItems.length === 1 ? 400 : 180, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: "10px 12px" }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>{item.name || "Unnamed"}</p>
                    {item.brand && (
                      <p style={{ fontSize: 10, color: "#C9A96E", margin: "4px 0 0", fontWeight: 500, letterSpacing: 1 }}>{item.brand}</p>
                    )}
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>{item.color} · {item.material || item.type}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* CTA */}
            <div style={{ padding: "4px 20px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 4, textTransform: "uppercase" }}>closetaireal.lovable.app</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WardrobeScreen;
