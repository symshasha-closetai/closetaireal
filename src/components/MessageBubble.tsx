import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, Trash2, X } from "lucide-react";
import ScoreRing from "./ScoreRing";

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
  const [showFullscreen, setShowFullscreen] = useState(false);
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
      return <img src={metadata.image_url} alt="" className="w-48 rounded-lg object-contain" />;
    }
    if (contentType === "drip_card" && metadata) {
      return (
        <div
          className="p-2 rounded-lg bg-secondary/50 space-y-1 min-w-[180px] cursor-pointer"
          onClick={() => setShowFullscreen(true)}
        >
          {metadata.image_url && <img src={metadata.image_url} alt="" className="w-full rounded-lg object-contain" />}
          <div className="flex items-center justify-between px-1">
            <p className="text-lg font-bold">{metadata.score?.toFixed(1)}/10</p>
            {metadata.confidence_rating != null && (
              <p className="text-xs text-muted-foreground">{metadata.confidence_rating?.toFixed(1)} conf</p>
            )}
          </div>
          {metadata.killer_tag && <p className="text-[10px] text-muted-foreground px-1">{metadata.killer_tag}</p>}
          <p className="text-[10px] font-medium text-primary px-1">Beat my drip 🔥</p>
        </div>
      );
    }
    if (contentType === "wardrobe_item" && metadata) {
      return (
        <div className="p-2 rounded-lg bg-secondary/50 space-y-1 min-w-[140px]">
          {metadata.image_url && <img src={metadata.image_url} alt="" className="w-full object-contain rounded-lg" />}
          <p className="text-xs font-medium">{metadata.name || metadata.type}</p>
        </div>
      );
    }
    return <p className="text-sm">{content}</p>;
  };

  return (
    <>
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

      {/* Fullscreen Drip Card Overlay */}
      <AnimatePresence>
        {showFullscreen && contentType === "drip_card" && metadata && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-4"
            onClick={() => setShowFullscreen(false)}
          >
            <button className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center" onClick={() => setShowFullscreen(false)}>
              <X size={16} className="text-foreground" />
            </button>
            <div className="w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              {metadata.image_url && (
                <div className="rounded-2xl overflow-hidden">
                  <img src={metadata.image_url} alt="" className="w-full object-contain" />
                </div>
              )}
              <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center">
                  <ScoreRing score={metadata.score || 0} size={64} strokeColor="#C9A96E" />
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-1">Drip</p>
                </div>
                {metadata.killer_tag && (
                  <span className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
                    {metadata.killer_tag}
                  </span>
                )}
                {metadata.confidence_rating != null && (
                  <div className="flex flex-col items-center">
                    <ScoreRing score={metadata.confidence_rating || 0} size={64} strokeColor="#A8A8A8" />
                    <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-1">Confidence</p>
                  </div>
                )}
              </div>
              <p className="text-center text-sm font-medium text-primary">Beat my drip 🔥</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MessageBubble;
