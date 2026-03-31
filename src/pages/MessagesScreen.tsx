import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2, ArrowLeft, Plus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type ConversationPreview = {
  id: string;
  otherUserId: string;
  otherName: string | null;
  otherUsername: string | null;
  otherAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type Friend = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const MessagesScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);

    const { data: myParticipations } = await supabase
      .from("conversation_participants" as any)
      .select("conversation_id")
      .eq("user_id", user.id) as any;

    if (!myParticipations || myParticipations.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = myParticipations.map((p: any) => p.conversation_id);

    const { data: allParticipants } = await supabase
      .from("conversation_participants" as any)
      .select("conversation_id, user_id")
      .in("conversation_id", convoIds)
      .neq("user_id", user.id) as any;

    const otherByConvo = new Map<string, string>();
    (allParticipants || []).forEach((p: any) => otherByConvo.set(p.conversation_id, p.user_id));

    const otherIds = Array.from(new Set(otherByConvo.values()));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", otherIds) as any;

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const previews: ConversationPreview[] = [];
    for (const convoId of convoIds) {
      const otherId = otherByConvo.get(convoId);
      if (!otherId) continue;

      const { data: msgs } = await supabase
        .from("messages" as any)
        .select("content, content_type, created_at")
        .eq("conversation_id", convoId)
        .or("expires_at.is.null,expires_at.gt.now(),kept.eq.true")
        .order("created_at", { ascending: false })
        .limit(1) as any;

      const prof = profileMap.get(otherId);
      const lastMsg = msgs?.[0];
      
      previews.push({
        id: convoId,
        otherUserId: otherId,
        otherName: prof?.name || null,
        otherUsername: prof?.username || null,
        otherAvatar: prof?.avatar_url || null,
        lastMessage: lastMsg?.content_type === "text" ? (lastMsg?.content || "") : `📎 ${lastMsg?.content_type || ""}`,
        lastMessageAt: lastMsg?.created_at || "",
        unreadCount: 0,
      });
    }

    previews.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(previews);
    setLoading(false);
  };

  useEffect(() => { fetchConversations(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Fetch friends when new chat dialog opens
  useEffect(() => {
    if (!showNewChat || !user) return;
    const fetchFriends = async () => {
      setFriendsLoading(true);
      const { data: friendRows } = await supabase
        .from("friends" as any)
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted") as any;

      const ids = (friendRows || []).map((f: any) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      if (ids.length === 0) { setFriends([]); setFriendsLoading(false); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, username, avatar_url")
        .in("user_id", ids) as any;

      setFriends((profiles || []).filter((p: any) => p.username || p.name));
      setFriendsLoading(false);
    };
    fetchFriends();
  }, [showNewChat, user?.id]);

  const handleStartChat = async (friendId: string) => {
    if (!user) return;
    setCreating(friendId);

    // Find existing 1:1 conversation
    const { data: existingConvos } = await supabase
      .from("conversation_participants" as any)
      .select("conversation_id")
      .eq("user_id", user.id) as any;

    let conversationId: string | null = null;

    if (existingConvos && existingConvos.length > 0) {
      const convoIds = existingConvos.map((c: any) => c.conversation_id);
      const { data: friendInConvo } = await supabase
        .from("conversation_participants" as any)
        .select("conversation_id")
        .eq("user_id", friendId)
        .in("conversation_id", convoIds) as any;

      if (friendInConvo && friendInConvo.length > 0) {
        for (const fc of friendInConvo) {
          const { count } = await supabase
            .from("conversation_participants" as any)
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", fc.conversation_id) as any;
          if (count === 2) { conversationId = fc.conversation_id; break; }
        }
      }
    }

    if (!conversationId) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("create_conversation_with_participants", { friend_id: friendId }) as any;
      if (rpcErr || !rpcData) { toast.error("Failed to create conversation"); setCreating(null); return; }
      conversationId = rpcData;
    }

    setCreating(null);
    setShowNewChat(false);
    navigate(`/chat/${conversationId}`);
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return "now";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
    return `${Math.floor(diffMs / 86400000)}d`;
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={16} className="text-foreground" />
          </button>
          <h1 className="font-display text-xl font-semibold text-foreground flex-1">Messages</h1>
          <button
            onClick={() => setShowNewChat(true)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center"
          >
            <Plus size={18} className="text-primary-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <MessageCircle size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/60">Tap + to start chatting with friends!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate(`/chat/${c.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                  {c.otherAvatar ? (
                    <img src={c.otherAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">{(c.otherName || c.otherUsername || "?")?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{c.otherName || c.otherUsername || "Unknown"}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage || "Start chatting..."}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* New Chat Friend Picker */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {friendsLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
            ) : friends.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No friends yet. Add friends first!</p>
            ) : (
              friends.map((f) => (
                <button
                  key={f.user_id}
                  onClick={() => handleStartChat(f.user_id)}
                  disabled={creating === f.user_id}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">{(f.name || f.username || "?")?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{f.name || f.username}</p>
                    {f.username && <p className="text-[10px] text-muted-foreground">@{f.username}</p>}
                  </div>
                  {creating === f.user_id ? (
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  ) : (
                    <Send size={14} className="text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesScreen;
