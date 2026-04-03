import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, Info, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import MessageBubble from "@/components/MessageBubble";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [pendingDeleteMsgId, setPendingDeleteMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Typing & read receipts via presence
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chatError, setChatError] = useState<string | null>(null);

  // Fetch other user info
  useEffect(() => {
    if (!conversationId || !user) return;
    const fetchOther = async () => {
      const { data: participants, error: partErr } = await supabase
        .from("conversation_participants" as any)
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id) as any;
      if (partErr) {
        console.error("Failed to load conversation participants:", partErr);
        setChatError("Could not load this conversation. It may not exist or you don't have access.");
        setLoading(false);
        return;
      }
      if (!participants || participants.length === 0) {
        setChatError("This conversation could not be found.");
        setLoading(false);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("name, username, avatar_url")
        .eq("user_id", participants[0].user_id)
        .maybeSingle() as any;
      setOtherUser(prof);
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
    if (msgs.length === 0) setShowBanner(true);

    try {
      localStorage.setItem(`chat-${conversationId}`, JSON.stringify({ msgs, ts: Date.now() }));
    } catch {}
  };

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(`chat-${conversationId}`) || "null");
      if (cached && Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000) {
        setMessages(cached.msgs);
        setLoading(false);
      }
    } catch {}
    fetchMessages();
  }, [conversationId]);

  // Realtime subscription + Presence
  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase.channel(`chat-${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        // Check other users' presence
        for (const [key, presences] of Object.entries(state)) {
          if (key !== user.id && Array.isArray(presences) && presences.length > 0) {
            const p = presences[0] as any;
            setOtherTyping(!!p.typing);
            if (p.last_read) setOtherLastRead(p.last_read);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false, last_read: null });
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id]);

  // Track read receipts when messages change
  useEffect(() => {
    if (!channelRef.current || !messages.length || !user) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender_id !== user.id) {
      channelRef.current.track({ typing: false, last_read: lastMsg.id });
    }
  }, [messages.length, user?.id]);

  // Handle typing indicator
  const handleTyping = useCallback((value: string) => {
    setText(value);
    if (!channelRef.current || !user) return;

    channelRef.current.track({ typing: true, last_read: otherLastRead });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.track({ typing: false, last_read: otherLastRead });
    }, 2000);
  }, [user?.id, otherLastRead]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, otherTyping]);

  const handleSend = async () => {
    if (!text.trim() || !user || !conversationId) return;
    setSending(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    channelRef.current?.track({ typing: false, last_read: otherLastRead });

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
    setPendingDeleteMsgId(msgId);
  };

  const confirmDeleteMsg = async () => {
    if (!pendingDeleteMsgId) return;
    const msgId = pendingDeleteMsgId;
    setPendingDeleteMsgId(null);
    await supabase.from("messages" as any).delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // Check if a message has been read by other user
  const isRead = (msg: Message) => {
    if (msg.sender_id !== user?.id) return false;
    if (!otherLastRead) return false;
    const readMsg = messages.find(m => m.id === otherLastRead);
    if (!readMsg) return false;
    return new Date(msg.created_at) <= new Date(readMsg.created_at);
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
          {otherTyping ? (
            <p className="text-[10px] text-primary animate-pulse">typing...</p>
          ) : otherUser?.username ? (
            <p className="text-[10px] text-muted-foreground">@{otherUser.username}</p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      {chatError ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <p className="text-sm text-muted-foreground text-center">{chatError}</p>
          <button onClick={() => navigate("/messages")} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Back to Messages
          </button>
        </div>
      ) : (
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
          messages.map((m, i) => {
            const isMine = m.sender_id === user?.id;
            const isLastMine = isMine && (i === messages.length - 1 || messages[i + 1]?.sender_id !== user?.id);
            return (
              <div key={m.id}>
                <MessageBubble
                  id={m.id}
                  content={m.content}
                  contentType={m.content_type}
                  metadata={m.metadata}
                  isMine={isMine}
                  kept={m.kept}
                  expiresAt={m.expires_at}
                  createdAt={m.created_at}
                  onKeep={handleKeep}
                  onDelete={handleDelete}
                />
                {isMine && isLastMine && isRead(m) && (
                  <div className="flex justify-end mt-0.5 mr-1">
                    <CheckCheck size={12} className="text-primary" />
                  </div>
                )}
              </div>
            );
          })
        )}
        {/* Typing indicator */}
        {otherTyping && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 py-1 px-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/30 bg-card/80 backdrop-blur-sm safe-bottom">
        <div className="flex gap-2 items-end max-w-lg mx-auto">
          <input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
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

      <AlertDialog open={!!pendingDeleteMsgId} onOpenChange={(open) => { if (!open) setPendingDeleteMsgId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This message will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMsg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatScreen;
