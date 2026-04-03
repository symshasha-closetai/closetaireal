import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJI_CATEGORIES = [
  { label: "😊", emojis: ["😊", "😂", "🤣", "😍", "🥰", "😘", "😎", "🤩", "😏", "😉", "🙃", "😅", "😆", "😁", "🥺", "😢", "😭", "🤔", "🫠", "😤", "🙄", "😳", "🫡", "🤭", "🤫", "😬", "😮‍💨", "🥱", "😴"] },
  { label: "🔥", emojis: ["🔥", "💯", "✨", "💫", "⭐", "🌟", "💥", "💢", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❤️‍🔥", "💕", "💖", "💗", "💘", "💝"] },
  { label: "👍", emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "🤟", "🤙", "💪", "👊", "✊", "🫶", "👋", "🖐️", "✋", "🤚", "👌", "🫰", "🤌"] },
  { label: "👗", emojis: ["👗", "👔", "👕", "👖", "🧥", "👟", "👠", "👡", "👢", "🧢", "👒", "🎩", "👜", "👛", "🎒", "💍", "💎", "👑", "🕶️", "🧣", "🧤", "🧦", "👙", "👘"] },
  { label: "🎉", emojis: ["🎉", "🎊", "🥳", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "🎯", "🎮", "🎵", "🎶", "🎤", "📸", "🖼️", "🎨", "✏️", "📝", "💬", "💭", "🗯️"] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  open: boolean;
}

const EmojiPicker = ({ onSelect, onClose, open }: EmojiPickerProps) => {
  const [tab, setTab] = useState(0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: 10, height: 0 }}
          className="border-t border-border/30 bg-card/95 backdrop-blur-sm overflow-hidden"
        >
          {/* Category tabs */}
          <div className="flex gap-1 px-3 pt-2 pb-1 border-b border-border/20">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => setTab(i)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${
                  tab === i ? "bg-primary/20" : "hover:bg-secondary"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[180px] overflow-y-auto">
            {EMOJI_CATEGORIES[tab].emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="w-9 h-9 rounded-lg text-xl flex items-center justify-center hover:bg-secondary active:scale-90 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmojiPicker;
