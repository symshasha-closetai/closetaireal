import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Pin, Trash2 } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  content: string;
  contentType: string;
  metadata?: any;
  isMine: boolean;
  kept: boolean;
  expiresAt: string | null;
  createdAt: string;
  senderName?: string;
  onKeep: (id: string) => void;
  onDelete: (id: string) => void;
};

const MessageBubble = ({ id, content, contentType, metadata, isMine, kept, expiresAt, createdAt, senderName, onKeep, onDelete }: MessageBubbleProps) => {
  const [showActions, setShowActions] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setShowActions(true), 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const time = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const renderContent = () => {
    if (contentType === "image" && metadata?.image_url) {
      return <img src={metadata.image_url} alt="" className="w-48 rounded-lg" />;
    }
    if (contentType === "drip_card" && metadata) {
      return (
        <div className="p-2 rounded-lg bg-secondary/50 space-y-1 min-w-[180px]">
          {metadata.image_url && <img src={metadata.image_url} alt="" className="w-full aspect-[3/4] object-cover rounded-lg" />}
          <p className="text-lg font-bold">{metadata.score?.toFixed(1)}/10</p>
          {metadata.killer_tag && <p className="text-[10px] text-muted-foreground">{metadata.killer_tag}</p>}
        </div>
      );
    }
    if (contentType === "wardrobe_item" && metadata) {
      return (
        <div className="p-2 rounded-lg bg-secondary/50 space-y-1 min-w-[140px]">
          {metadata.image_url && <img src={metadata.image_url} alt="" className="w-full aspect-square object-cover rounded-lg" />}
          <p className="text-xs font-medium">{metadata.name || metadata.type}</p>
        </div>
      );
    }
    return <p className="text-sm">{content}</p>;
  };

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); setShowActions(true); }}
        className={`relative max-w-[75%] px-3 py-2 rounded-2xl ${
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-secondary-foreground rounded-bl-md"
        }`}
      >
        {renderContent()}
        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          <span className={`text-[9px] ${isMine ? "text-primary-foreground/50" : "text-muted-foreground"}`}>{time}</span>
          {kept && <Pin size={8} className={isMine ? "text-primary-foreground/50" : "text-muted-foreground"} />}
        </div>

        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute ${isMine ? "right-0" : "left-0"} -top-10 z-50 flex gap-1 p-1 rounded-lg bg-card border border-border shadow-elevated`}
          >
            {!kept && (
              <button onClick={() => { onKeep(id); setShowActions(false); }} className="px-2 py-1 text-[10px] font-medium rounded-md hover:bg-secondary flex items-center gap-1">
                <Pin size={10} /> Keep
              </button>
            )}
            {isMine && (
              <button onClick={() => { onDelete(id); setShowActions(false); }} className="px-2 py-1 text-[10px] font-medium text-destructive rounded-md hover:bg-destructive/10 flex items-center gap-1">
                <Trash2 size={10} /> Delete
              </button>
            )}
            <button onClick={() => setShowActions(false)} className="px-2 py-1 text-[10px] text-muted-foreground rounded-md hover:bg-secondary">✕</button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default MessageBubble;
