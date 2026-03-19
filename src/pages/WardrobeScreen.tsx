import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Loader2, Camera, Upload, Sparkles, Pencil, Save, Share2, CheckSquare, Square, SlidersHorizontal, RefreshCw, Pin, GripVertical, RotateCcw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import { compressImage } from "@/lib/imageCompression";
import html2canvas from "html2canvas";
import { precacheImages } from "@/lib/imageCache";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ClothingItem = {
  id: string;
  image_url: string;
  original_image_url: string | null;
  type: string;
  color: string | null;
  material: string | null;
  name: string | null;
  brand: string | null;
  quality: string | null;
  season: string | null;
  style: string | null;
  pinned: boolean;
  pin_order: number;
  custom_category: string | null;
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

type WardrobeCategory = {
  id: string;
  name: string;
};

const defaultCategories = ["All", "Tops", "Bottoms", "Shoes", "Accessories"];

// Normalize for singular/plural matching: "shirts" → "shirt", "hoodies" → "hoodie", "pants" → "pant"
function normalizeCategory(s: string): string {
  return s.toLowerCase().replace(/ies$/, 'y').replace(/es$/, 'e').replace(/s$/, '');
}

const HIDDEN_DEFAULTS_KEY = "closetai-hidden-defaults";

// --- AI Analysis Cache helpers ---
const ANALYSIS_CACHE_KEY = "closetai-analysis-cache";

function computeAnalysisCacheKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function getCachedAnalysis(key: string): DetectedItem[] | null {
  try {
    const cache = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY) || "{}");
    return cache[key] || null;
  } catch { return null; }
}

function setCachedAnalysis(key: string, items: DetectedItem[]) {
  try {
    const cache = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY) || "{}");
    cache[key] = items;
    // Keep max 20 entries
    const keys = Object.keys(cache);
    if (keys.length > 20) delete cache[keys[0]];
    localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// Shared card content component
type CardContentProps = {
  item: ClothingItem;
  selectMode: boolean;
  selectedItems: Set<string>;
  failedImages: Set<string>;
  retryingImages: Set<string>;
  setFailedImages: React.Dispatch<React.SetStateAction<Set<string>>>;
  retryImageGeneration: (item: ClothingItem) => void;
  togglePin: (item: ClothingItem) => void;
  openEdit: (item: ClothingItem) => void;
  shareItem: (item: ClothingItem) => void;
  deleteItem: (id: string) => void;
  onItemClick?: (item: ClothingItem) => void;
  dragHandle?: React.ReactNode;
};

const WardrobeCardContent = ({ item, selectMode, selectedItems, failedImages, retryingImages, setFailedImages, retryImageGeneration, togglePin, openEdit, shareItem, deleteItem, dragHandle }: CardContentProps) => (
  <>
    <div className="aspect-square overflow-hidden rounded-t-2xl relative">
      <img src={item.image_url} alt={item.name || "Clothing"} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy"
        onError={() => setFailedImages(prev => new Set(prev).add(item.id))} />
      {failedImages.has(item.id) && !selectMode && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
          <p className="text-[10px] text-muted-foreground">Image failed</p>
          <button onClick={(e) => { e.stopPropagation(); retryImageGeneration(item); }} disabled={retryingImages.has(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium shadow-soft active:scale-95 transition-transform disabled:opacity-50">
            {retryingImages.has(item.id) ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {retryingImages.has(item.id) ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
    </div>
    <div className="p-3">
      <p className="text-sm font-medium text-foreground truncate">{item.name || "Unnamed"}</p>
      <p className="text-[11px] text-muted-foreground">{item.color || item.type} · {item.material || "—"}</p>
      {item.brand && <span className="inline-block mt-1 text-[9px] uppercase tracking-wider text-primary/70 border border-primary/20 rounded-full px-2 py-0.5">{item.brand}</span>}
    </div>
    {!selectMode && (
      <>
        {item.pinned && (
          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10">
            <Pin size={13} />
          </div>
        )}
        {dragHandle}
        <button onClick={(e) => { e.stopPropagation(); togglePin(item); }}
          className={`absolute ${item.pinned ? 'top-11' : 'top-2'} left-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm`}>
          <Pin size={13} className={item.pinned ? "fill-current" : ""} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); retryImageGeneration(item); }} disabled={retryingImages.has(item.id)}
          className={`absolute ${item.pinned ? 'top-20' : 'top-11'} left-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm disabled:opacity-50`}>
          {retryingImages.has(item.id) ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); openEdit(item); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm">
          <Pencil size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
          className="absolute top-11 right-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm">
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
  </>
);

// Sortable wrapper for pinned items
const SortableWardrobeCard = (props: CardContentProps & { index: number; toggleSelectItem: (id: string) => void }) => {
  const { item, index, selectMode, toggleSelectItem, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <motion.div ref={setNodeRef} style={style} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`glass-card overflow-hidden group relative ${selectMode && props.selectedItems.has(item.id) ? "ring-2 ring-primary" : ""}`}
      onClick={() => selectMode ? toggleSelectItem(item.id) : rest.onItemClick?.(item)}>
      <WardrobeCardContent item={item} selectMode={selectMode} {...rest}
        dragHandle={
          !selectMode ? (
            <div {...attributes} {...listeners} className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-foreground/50 text-primary-foreground flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm z-20">
              <GripVertical size={13} />
            </div>
          ) : undefined
        }
      />
    </motion.div>
  );
};

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

  // Failed/retry image tracking
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [retryingImages, setRetryingImages] = useState<Set<string>>(new Set());
  const [regeneratingEdit, setRegeneratingEdit] = useState(false);

  // Detail view state
  const [detailItem, setDetailItem] = useState<ClothingItem | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  // Custom categories
  const [customCategories, setCustomCategories] = useState<WardrobeCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_DEFAULTS_KEY) || "[]"); } catch { return []; }
  });

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

  // All category names (default + custom), filtering out hidden defaults
  const allCategories = useMemo(() => [
    ...defaultCategories.filter(c => c === "All" || !hiddenDefaults.includes(c)),
    ...customCategories.map(c => c.name)
  ], [customCategories, hiddenDefaults]);

  useEffect(() => { if (user) { fetchItems(); fetchDeletedItems(); fetchCustomCategories(); } }, [user]);

  const fetchCustomCategories = async () => {
    if (!user) return;
    const { data } = await supabase.from("wardrobe_categories").select("id, name").eq("user_id", user.id).order("created_at", { ascending: true });
    if (data) setCustomCategories(data as WardrobeCategory[]);
  };

  const addCustomCategory = async () => {
    if (!user || !newCategoryName.trim()) return;
    const name = newCategoryName.trim();
    if (allCategories.some(c => normalizeCategory(c) === normalizeCategory(name))) { toast.error("Category already exists"); return; }
    const { error } = await supabase.from("wardrobe_categories").insert({ user_id: user.id, name } as any);
    if (error) toast.error("Failed to add category");
    else { toast.success(`"${name}" added!`); setNewCategoryName(""); fetchCustomCategories(); }
  };

  const deleteCustomCategory = async (cat: WardrobeCategory) => {
    // Remove category tag from items
    await supabase.from("wardrobe").update({ custom_category: null } as any).eq("user_id", user!.id).eq("custom_category", cat.name);
    const { error } = await supabase.from("wardrobe_categories").delete().eq("id", cat.id);
    if (error) toast.error("Failed to delete category");
    else { toast.success(`"${cat.name}" deleted`); fetchCustomCategories(); if (activeCategory === cat.name) setActiveCategory("All"); }
  };

  const fetchItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wardrobe")
      .select("id, image_url, original_image_url, type, color, material, name, brand, quality, season, style, pinned, pin_order, custom_category")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load wardrobe");
    else {
      const wardrobeItems = ((data || []) as any[]).map(i => ({ ...i, pinned: !!i.pinned, pin_order: i.pin_order || 0 })) as ClothingItem[];
      wardrobeItems.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) return a.pin_order - b.pin_order;
        return 0;
      });
      setItems(wardrobeItems);
      precacheImages(wardrobeItems.flatMap((i) => [i.image_url, i.original_image_url].filter(Boolean) as string[]));
    }
    setLoading(false);
  };

  const togglePin = async (item: ClothingItem) => {
    const newPinned = !item.pinned;
    const maxOrder = items.filter(i => i.pinned).reduce((max, i) => Math.max(max, i.pin_order), 0);
    const newOrder = newPinned ? maxOrder + 1 : 0;
    const { error } = await supabase.from("wardrobe").update({ pinned: newPinned, pin_order: newOrder } as any).eq("id", item.id);
    if (error) { toast.error("Failed to update pin"); return; }
    setItems(prev => {
      const updated = prev.map(i => i.id === item.id ? { ...i, pinned: newPinned, pin_order: newOrder } : i);
      updated.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) return a.pin_order - b.pin_order;
        return 0;
      });
      return updated;
    });
    toast.success(newPinned ? "Pinned!" : "Unpinned", { duration: 1500 });
  };

  // DnD sensors — increased tolerance for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 10 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const pinnedItems = filtered.filter(i => i.pinned);
    const oldIndex = pinnedItems.findIndex(i => i.id === active.id);
    const newIndex = pinnedItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pinnedItems, oldIndex, newIndex);
    const updates = reordered.map((item, idx) => ({ id: item.id, pin_order: idx }));
    setItems(prev => {
      const unpinned = prev.filter(i => !i.pinned);
      const newPinned = reordered.map((item, idx) => ({ ...item, pin_order: idx }));
      return [...newPinned, ...unpinned];
    });
    for (const u of updates) {
      await supabase.from("wardrobe").update({ pin_order: u.pin_order } as any).eq("id", u.id);
    }
  };

  // Extract unique filter values
  const uniqueColors = useMemo(() => [...new Set(items.map(i => i.color).filter(Boolean))] as string[], [items]);
  const uniqueQualities = useMemo(() => [...new Set(items.map(i => i.quality).filter(Boolean))] as string[], [items]);
  const uniqueMaterials = useMemo(() => [...new Set(items.map(i => i.material).filter(Boolean))] as string[], [items]);
  const uniqueBrands = useMemo(() => [...new Set(items.map(i => i.brand).filter(Boolean))] as string[], [items]);
  const uniqueSeasons = useMemo(() => [...new Set(items.map(i => i.season).filter(Boolean))] as string[], [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (activeCategory === "All") {
      // show all
    } else if (defaultCategories.includes(activeCategory)) {
      result = result.filter(i => i.type === activeCategory);
    } else {
      // Custom category — match by custom_category tag, type name, or item name (with plural normalization)
      const norm = normalizeCategory(activeCategory);
      result = result.filter(i =>
        i.custom_category === activeCategory ||
        normalizeCategory(i.type) === norm ||
        (i.name && normalizeCategory(i.name).includes(norm))
      );
    }
    if (filterColor) result = result.filter(i => i.color?.toLowerCase() === filterColor.toLowerCase());
    if (filterQuality) result = result.filter(i => i.quality?.toLowerCase() === filterQuality.toLowerCase());
    if (filterMaterial) result = result.filter(i => i.material?.toLowerCase() === filterMaterial.toLowerCase());
    if (filterBrand) result = result.filter(i => i.brand?.toLowerCase() === filterBrand.toLowerCase());
    if (filterSeason) result = result.filter(i => i.season?.toLowerCase() === filterSeason.toLowerCase());
    return result;
  }, [items, activeCategory, filterColor, filterQuality, filterMaterial, filterBrand, filterSeason]);

  // Soft-delete + deleted items state
  const [deletedItems, setDeletedItems] = useState<ClothingItem[]>([]);

  const fetchDeletedItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wardrobe")
      .select("id, image_url, original_image_url, type, color, material, name, brand, quality, season, style, pinned, pin_order, custom_category")
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .order("created_at", { ascending: false });
    if (data) setDeletedItems(data as any[]);
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("wardrobe").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error("Failed to delete item");
    else {
      const item = items.find(i => i.id === id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (item) setDeletedItems(prev => [item, ...prev]);
      toast.success("Item moved to history");
    }
  };

  const restoreItem = async (id: string) => {
    const { error } = await supabase.from("wardrobe").update({ deleted_at: null } as any).eq("id", id);
    if (error) toast.error("Failed to restore item");
    else {
      const item = deletedItems.find(i => i.id === id);
      setDeletedItems(prev => prev.filter(i => i.id !== id));
      if (item) setItems(prev => [item, ...prev]);
      toast.success("Item restored!");
    }
  };

  const permanentlyDeleteItem = async (id: string) => {
    const { error } = await supabase.from("wardrobe").delete().eq("id", id);
    if (error) toast.error("Failed to delete permanently");
    else {
      setDeletedItems(prev => prev.filter(i => i.id !== id));
      toast.success("Permanently deleted");
    }
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

    // Check cache first
    const cacheKey = computeAnalysisCacheKey(file);
    const cached = getCachedAnalysis(cacheKey);
    if (cached && cached.length > 0) {
      setDetectedItems(cached);
      setSelectedDetected(cached.map((_: DetectedItem, i: number) => i));
      toast.success(`Found ${cached.length} item(s) from cache!`);
      setAnalyzing(false);
      return;
    }

    const tryAnalyze = async (base64: string, mimeType?: string): Promise<DetectedItem[]> => {
      const { data, error } = await supabase.functions.invoke("analyze-clothing", {
        body: { imageBase64: base64, ...(mimeType ? { mimeType } : {}) },
      });
      if (error) {
        const msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
        throw new Error(msg);
      }
      if (data?.error) {
        if (data.retryable) throw new Error(`retryable:${data.error}`);
        throw new Error(data.error);
      }
      return data?.items || [];
    };

    try {
      let detected: DetectedItem[] = [];
      try {
        const { base64 } = await compressImage(file);
        detected = await tryAnalyze(base64);
      } catch (err1: any) {
        const msg1 = err1?.message || "";
        if (msg1.includes("Rate limited") || msg1.includes("retryable")) {
          toast.error("Server is busy — please try again in a moment.");
          setAddMode("manual");
          setAnalyzing(false);
          return;
        }
        console.warn("Compressed analysis failed, retrying with original:", msg1);
        try {
          const originalBase64 = await fileToBase64(file);
          detected = await tryAnalyze(originalBase64, file.type || "image/jpeg");
        } catch (err2: any) {
          const msg2 = err2?.message || "";
          if (msg2.includes("Rate limited") || msg2.includes("retryable")) {
            toast.error("Server is busy — please try again in a moment.");
          } else {
            toast.error("Couldn't analyze this image. Try a clearer photo or add manually.");
          }
          setAddMode("manual");
          setAnalyzing(false);
          return;
        }
      }

      if (detected.length === 0) { toast.info("No clothing items detected. You can add manually."); setAddMode("manual"); }
      else {
        // Cache the detected items
        setCachedAnalysis(cacheKey, detected);
        setDetectedItems(detected);
        setSelectedDetected(detected.map((_: DetectedItem, i: number) => i));
        toast.success(`Found ${detected.length} item(s)!`);
      }
    } catch { toast.error("Something went wrong. Try again or add manually."); setAddMode("manual"); }
    finally { setAnalyzing(false); }
  };

  const processQueue = useCallback(async () => {
    if (bgProcessingRef.current || bgQueueRef.current.length === 0 || !user) return;
    bgProcessingRef.current = true;
    let totalSuccess = 0;
    let totalFailed = 0;
    while (bgQueueRef.current.length > 0) {
      const job = bgQueueRef.current[0];
      try {
        const { base64, blob: compressedBlob } = await compressImage(job.file);
        // Upload original photo once per job
        let originalImageUrl: string | null = null;
        try {
          const origPath = `${user.id}/original-${Date.now()}.jpg`;
          const { error: origUpErr } = await supabase.storage.from("wardrobe").upload(origPath, compressedBlob, { contentType: "image/jpeg" });
          if (!origUpErr) {
            const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(origPath);
            originalImageUrl = publicUrl;
          }
        } catch {}
        for (let i = 0; i < job.selected.length; i++) {
          const idx = job.selected[i];
          const item = job.items[idx];
          let imageUrl: string | null = null;
          try {
            const { data: genData, error: genError } = await supabase.functions.invoke("generate-clothing-image", {
              body: { imageBase64: base64, itemName: item.name, itemType: item.type, itemColor: item.color, itemMaterial: item.material, userId: user.id, bodyType: styleProfile?.body_type || null, gender: styleProfile?.gender || null },
            });
            if (!genError && genData?.imageUrl) imageUrl = genData.imageUrl;
          } catch {}
          if (!imageUrl) {
            const path = `${user.id}/${Date.now()}-${i}.jpg`;
            const { error: uploadErr } = await supabase.storage.from("wardrobe").upload(path, compressedBlob, { contentType: "image/jpeg" });
            if (uploadErr) { console.error("Upload failed:", uploadErr); totalFailed++; setBgJob(prev => ({ ...prev, completedItems: prev.completedItems + 1 })); continue; }
            const { data: { publicUrl } } = supabase.storage.from("wardrobe").getPublicUrl(path);
            imageUrl = publicUrl;
          }
          const { data: insertData, error: insertError } = await supabase
            .from("wardrobe")
            .insert({ user_id: user.id, image_url: imageUrl, original_image_url: originalImageUrl, type: item.type, name: item.name, color: item.color, material: item.material, quality: item.quality, brand: item.brand } as any)
            .select("id, image_url, original_image_url, type, color, material, name, brand, quality, season, style, custom_category")
            .single();
          if (insertError || !insertData) {
            console.error("Insert failed:", insertError);
            totalFailed++;
          } else {
            setItems((prev) => [{ ...(insertData as any), pinned: false, pin_order: 0 } as ClothingItem, ...prev]);
            totalSuccess++;
          }
          setBgJob(prev => ({ ...prev, completedItems: prev.completedItems + 1 }));
        }
      } catch (err) {
        console.error("Queue job error:", err);
        totalFailed += job.selected.length;
      }
      bgQueueRef.current.shift();
    }
    setBgJob({ totalItems: 0, completedItems: 0, active: false });
    bgProcessingRef.current = false;
    setActiveCategory("All");
    if (totalFailed === 0 && totalSuccess > 0) {
      toast.success(`${totalSuccess} item${totalSuccess > 1 ? "s" : ""} added to wardrobe!`);
    } else if (totalSuccess > 0) {
      toast.warning(`${totalSuccess} added, ${totalFailed} failed to save.`);
    } else if (totalFailed > 0) {
      toast.error("Failed to save items. Please try again.");
    }
    fetchItems();
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
      const { data, error } = await supabase.from("wardrobe").insert({ user_id: user.id, image_url: publicUrl, original_image_url: publicUrl, type: newType, name: "New Item" } as any)
        .select("id, image_url, original_image_url, type, color, material, name, brand, quality, season, style, custom_category").single();
      if (error) throw error;
      if (data) setItems((prev) => [{ ...(data as any), pinned: false, pin_order: 0 } as ClothingItem, ...prev]);
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

  const retryImageGeneration = async (item: ClothingItem) => {
    if (!user) return;
    setRetryingImages(prev => new Set(prev).add(item.id));
    try {
      const { data, error } = await supabase.functions.invoke("generate-clothing-image", {
        body: { itemName: item.name, itemType: item.type, itemColor: item.color, itemMaterial: item.material, userId: user.id, bodyType: styleProfile?.body_type || null, gender: styleProfile?.gender || null },
      });
      if (error || !data?.imageUrl) throw new Error("Generation failed");
      await supabase.from("wardrobe").update({ image_url: data.imageUrl }).eq("id", item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, image_url: data.imageUrl } : i));
      setFailedImages(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      toast.success("Image regenerated!");
    } catch {
      toast.error("Failed to regenerate image. Try again later.");
    } finally {
      setRetryingImages(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  const regenerateEditImage = async () => {
    if (!editingItem || !user) return;
    setRegeneratingEdit(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clothing-image", {
        body: { itemName: editForm.name, itemType: editForm.type, itemColor: editForm.color, itemMaterial: editForm.material, userId: user.id, bodyType: styleProfile?.body_type || null, gender: styleProfile?.gender || null },
      });
      if (error || !data?.imageUrl) throw new Error("Generation failed");
      await supabase.from("wardrobe").update({ image_url: data.imageUrl }).eq("id", editingItem.id);
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, image_url: data.imageUrl } : i));
      setEditingItem(prev => prev ? { ...prev, image_url: data.imageUrl } : null);
      setFailedImages(prev => { const n = new Set(prev); n.delete(editingItem.id); return n; });
      toast.success("Image regenerated!");
    } catch {
      toast.error("Failed to regenerate. Try again later.");
    } finally {
      setRegeneratingEdit(false);
    }
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
    <div className="min-h-screen pb-24 px-5 pt-4">
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

        {/* Categories + Filter Toggle + Category Manager */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
            {allCategories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  activeCategory === cat ? "gradient-accent text-accent-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>
                {cat}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCategoryManager(true)}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground transition-all">
            <Pencil size={16} />
          </button>
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.filter(i => i.pinned).map(i => i.id)} strategy={rectSortingStrategy}>
              <motion.div layout className="grid grid-cols-2 gap-3">
                <AnimatePresence>
                  {filtered.map((item, i) => (
                    item.pinned ? (
                      <SortableWardrobeCard key={item.id} item={item} index={i} selectMode={selectMode} selectedItems={selectedItems}
                        toggleSelectItem={toggleSelectItem} failedImages={failedImages} retryingImages={retryingImages}
                        setFailedImages={setFailedImages} retryImageGeneration={retryImageGeneration}
                        togglePin={togglePin} openEdit={openEdit} shareItem={shareItem} deleteItem={deleteItem} onItemClick={setDetailItem} />
                    ) : (
                      <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className={`glass-card overflow-hidden group relative ${selectMode && selectedItems.has(item.id) ? "ring-2 ring-primary" : ""}`}
                        onClick={() => selectMode ? toggleSelectItem(item.id) : setDetailItem(item)}>
                        <WardrobeCardContent item={item} selectMode={selectMode} selectedItems={selectedItems}
                          failedImages={failedImages} retryingImages={retryingImages} setFailedImages={setFailedImages}
                          retryImageGeneration={retryImageGeneration} togglePin={togglePin} openEdit={openEdit}
                          shareItem={shareItem} deleteItem={deleteItem} onItemClick={setDetailItem} />
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>
              </motion.div>
            </SortableContext>
          </DndContext>
        )}

        {/* Hidden file inputs */}
        <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFileSelected} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
        <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handleFileSelected} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />

        {/* Add Modal */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-[60] flex items-center justify-center p-5" onClick={resetModal}>
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
                                    {["Tops", "Bottoms", "Shoes", "Accessories"].map(t => (<option key={t} value={t}>{t}</option>))}
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
                      {["Tops", "Bottoms", "Shoes", "Accessories"].map((t) => (
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
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-[60] flex items-center justify-center p-5" onClick={() => setEditingItem(null)}>
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
                      {["Tops", "Bottoms", "Shoes", "Accessories"].map(t => (<option key={t} value={t}>{t}</option>))}
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
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={savingEdit}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60">
                    <Save size={16} /> {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                  <button onClick={regenerateEditImage} disabled={regeneratingEdit || savingEdit}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                    title="Regenerate image with current details">
                    {regeneratingEdit ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Manager Modal */}
        <AnimatePresence>
          {showCategoryManager && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-[60] flex items-center justify-center p-5" onClick={() => setShowCategoryManager(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-lg">Manage Categories</h3>
                  <button onClick={() => setShowCategoryManager(false)}><X size={20} className="text-muted-foreground" /></button>
                </div>

                {/* Default categories (deletable/hideable) */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Default</p>
                  <div className="space-y-2">
                    {defaultCategories.filter(c => c !== "All").map(cat => (
                      <div key={cat} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                        <span className={`text-sm ${hiddenDefaults.includes(cat) ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{cat}</span>
                        <button onClick={() => {
                          const next = hiddenDefaults.includes(cat)
                            ? hiddenDefaults.filter(c => c !== cat)
                            : [...hiddenDefaults, cat];
                          setHiddenDefaults(next);
                          localStorage.setItem(HIDDEN_DEFAULTS_KEY, JSON.stringify(next));
                          if (activeCategory === cat) setActiveCategory("All");
                        }} className="w-7 h-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors">
                          {hiddenDefaults.includes(cat) ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom categories */}
                {customCategories.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Custom</p>
                    <div className="space-y-2">
                      {customCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                          <span className="text-sm text-foreground">{cat.name}</span>
                          <button onClick={() => deleteCustomCategory(cat)} className="w-7 h-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new */}
                <div className="flex gap-2">
                  <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name..."
                    className="flex-1 px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                    onKeyDown={(e) => e.key === "Enter" && addCustomCategory()} />
                  <button onClick={addCustomCategory} disabled={!newCategoryName.trim()}
                    className="px-4 py-2.5 rounded-xl gradient-accent text-accent-foreground text-sm font-medium shadow-soft active:scale-[0.98] transition-transform disabled:opacity-50">
                    Add
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Item Detail Overlay */}
        <AnimatePresence>
          {detailItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background z-[60] flex flex-col" onClick={() => { setDetailItem(null); setShowOriginal(false); }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()}
                className="flex flex-col h-full">
                {/* Top bar */}
                <div className="flex items-center justify-between px-5 py-4">
                  <h3 className="font-semibold text-foreground text-lg truncate">{detailItem.name || "Unnamed"}</h3>
                  <button onClick={() => { setDetailItem(null); setShowOriginal(false); }}
                    className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                    <X size={18} className="text-foreground" />
                  </button>
                </div>

                {/* Image */}
                <div className="flex-1 relative overflow-hidden mx-5 rounded-2xl bg-secondary min-h-0">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={showOriginal ? "original" : "generated"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      src={showOriginal && detailItem.original_image_url ? detailItem.original_image_url : detailItem.image_url}
                      alt={detailItem.name || "Item"}
                      className="w-full h-full object-contain"
                    />
                  </AnimatePresence>
                  {showOriginal && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-medium backdrop-blur-sm">
                      Original Photo
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="px-5 pt-3 pb-1">
                  <div className="flex flex-wrap gap-2">
                    {detailItem.color && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{detailItem.color}</span>
                    )}
                    {detailItem.material && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{detailItem.material}</span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{detailItem.type}</span>
                    {detailItem.brand && (
                      <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-primary/20 text-primary/70">{detailItem.brand}</span>
                    )}
                    {detailItem.quality && (
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
                        detailItem.quality === "Premium" ? "bg-green-500/10 text-green-500" : detailItem.quality === "Mid-range" ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"
                      }`}>{detailItem.quality}</span>
                    )}
                  </div>
                </div>

                {/* Action buttons — 2-row grid with pb-28 to clear bottom nav */}
                <div className="px-5 pt-3 pb-28 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { togglePin(detailItem); setDetailItem(prev => prev ? { ...prev, pinned: !prev.pinned } : null); }}
                      className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-all ${detailItem.pinned ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      <Pin size={15} className={detailItem.pinned ? "fill-current" : ""} /> {detailItem.pinned ? "Pinned" : "Pin"}
                    </button>
                    <button onClick={() => { setDetailItem(null); setShowOriginal(false); openEdit(detailItem); }}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">
                      <Pencil size={15} /> Edit
                    </button>
                    <button onClick={() => { setShowOriginal(!showOriginal); }}
                      disabled={!detailItem.original_image_url}
                      className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${showOriginal ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      <Eye size={15} /> Original
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { retryImageGeneration(detailItem); }}
                      disabled={retryingImages.has(detailItem.id)}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-50">
                      {retryingImages.has(detailItem.id) ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh
                    </button>
                    <button onClick={() => shareItem(detailItem)}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">
                      <Share2 size={15} /> Share
                    </button>
                    <button onClick={() => { deleteItem(detailItem.id); setDetailItem(null); setShowOriginal(false); }}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showShareCard && (
          <div ref={shareCardRef} style={{
            position: "fixed", left: "-9999px", top: 0, width: 390, zIndex: -1,
            background: "#1a1a1a", borderRadius: 24, overflow: "hidden", fontFamily: "'Inter', sans-serif",
          }}>
            <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, letterSpacing: 5, color: "rgba(255,255,255,0.6)", fontWeight: 300 }}>ClosetAI</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>My Collection</span>
            </div>
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
