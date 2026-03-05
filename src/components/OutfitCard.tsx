import { motion } from "framer-motion";

interface OutfitCardProps {
  image: string;
  label: string;
  type: string;
}

const OutfitCard = ({ image, label, type }: OutfitCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass-card overflow-hidden"
    >
      <div className="aspect-square overflow-hidden rounded-t-2xl">
        <img
          src={image}
          alt={label}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground">{type}</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
    </motion.div>
  );
};

export default OutfitCard;
