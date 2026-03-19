import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import MessageBubble from "@/components/MessageBubble";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: string;
  metadata: any;
  kept: boolean;
  expires_at: string | null;
  created_at: string;
};

const ChatScreen = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch other user info
  useEffect(() => {
    if (!conversationId || !user) return;
    const fetchOther = async () => {
      const { data: participants } = await supabase
        .from("conversation_participants" as any)
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id) as any;
      if (participants?.[0]) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("name, username, avatar_url")
          .eq("user_id", participants[0].user_id)
          .maybeSingle() as any;
        setOtherUser(prof);
      }
    };
    fetchOther();
  }, [conversationId, user?.id]);

  // Fetch messages
  const fetchMessages = async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages" as any)
      .select("*")
      .eq("conversation_id", conversationId)
      .or("expires_at.is.null,expires_at.gt.now(),kept.eq.true")
      .order("created_at", { ascending: true }) as any;

    const msgs = (data || []) as Message[];
    setMessages(msgs);
    setLoading(false);

    // Show banner if first message
    if (msgs.length === 0) setShowBanner(true);

    // Cache
    try {
      localStorage.setItem(`chat-${conversationId}`, JSON.stringify({ msgs, ts: Date.now() }));
    } catch {}
  };

  useEffect(() => {
    // Try cache first
    try {
      const cached = JSON.parse(localStorage.getItem(`chat-${conversationId}`) || "null");
      if (cached && Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000) {
        setMessages(cached.msgs);
        setLoading(false);
      }
    } catch {}
    fetchMessages();
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !user || !conversationId) return;
    setSending(true);
    const { error } = await supabase.from("messages" as any).insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text.trim(),
      content_type: "text",
    } as any);
    if (error) toast.error("Failed to send");
    else setText("");
    setSending(false);
    setShowBanner(false);
  };

  const handleKeep = async (msgId: string) => {
    await supabase.from("messages" as any).update({ kept: true, expires_at: null } as any).eq("id", msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, kept: true, expires_at: null } : m));
    toast.success("Message kept forever ✨");
  };

  const handleDelete = async (msgId: string) => {
    await supabase.from("messages" as any).delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-card/80 backdrop-blur-sm">
        <button onClick={() => navigate("/messages")} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-medium text-muted-foreground">{(otherUser?.name || "?")?.[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{otherUser?.name || otherUser?.username || "Chat"}</p>
          {otherUser?.username && <p className="text-[10px] text-muted-foreground">@{otherUser.username}</p>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {showBanner && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 mb-4">
            <Info size={14} className="text-muted-foreground flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">Messages are kept for 7 days unless saved. Long-press to keep a message.</p>
          </motion.div>
        )}
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              id={m.id}
              content={m.content}
              contentType={m.content_type}
              metadata={m.metadata}
              isMine={m.sender_id === user?.id}
              kept={m.kept}
              expiresAt={m.expires_at}
              createdAt={m.created_at}
              onKeep={handleKeep}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/30 bg-card/80 backdrop-blur-sm safe-bottom">
        <div className="flex gap-2 items-end max-w-lg mx-auto">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Message..."
            className="flex-1 px-4 py-2.5 rounded-full bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center flex-shrink-0 disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin text-accent-foreground" /> : <Send size={16} className="text-accent-foreground" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
