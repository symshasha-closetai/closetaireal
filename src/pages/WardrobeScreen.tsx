import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import sampleTop from "@/assets/sample-top.jpg";
import sampleBottom from "@/assets/sample-bottom.jpg";

type ClothingItem = {
  id: string;
  image: string;
  type: string;
  color: string;
  material: string;
  name: string;
};

const categories = ["All", "Tops", "Bottoms", "Shoes", "Dresses"];

const mockItems: ClothingItem[] = [
  { id: "1", image: sampleTop, type: "Tops", color: "Navy", material: "Cotton", name: "Navy T-Shirt" },
  { id: "2", image: sampleBottom, type: "Bottoms", color: "Beige", material: "Cotton", name: "Beige Chinos" },
  { id: "3", image: sampleTop, type: "Tops", color: "Black", material: "Polyester", name: "Black Polo" },
  { id: "4", image: sampleBottom, type: "Bottoms", color: "Dark Blue", material: "Denim", name: "Slim Jeans" },
];

const WardrobeScreen = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [items, setItems] = useState<ClothingItem[]>(mockItems);
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = activeCategory === "All" ? items : items.filter((i) => i.type === activeCategory);

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newItem: ClothingItem = {
      id: Date.now().toString(),
      image: url,
      type: "Tops",
      color: "Detected",
      material: "Detected",
      name: "New Item",
    };
    setItems((prev) => [newItem, ...prev]);
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-14">
      <div className="max-w-lg mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
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
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.color} · {item.material}</p>
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
                <p className="text-sm text-muted-foreground">Upload a photo and AI will detect the type, color, and material.</p>
                <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleAddImage} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-3.5 rounded-xl gradient-accent text-accent-foreground font-medium text-sm shadow-soft active:scale-[0.98] transition-transform"
                >
                  Upload Photo
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
