import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2, ArrowLeft, Plus, Send, Users, X, Check } from "lucide-react";
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
  isGroup: boolean;
  groupName: string | null;
  memberAvatars: string[];
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

  // Group creation state
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);

    const { data: myParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!myParticipations || myParticipations.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = myParticipations.map((p) => p.conversation_id);

    // Fetch conversation metadata (name, is_group)
    const { data: convoData } = await supabase
      .from("conversations")
      .select("id, name, is_group")
      .in("id", convoIds);
    const convoMap = new Map<string, any>();
    (convoData || []).forEach((c: any) => convoMap.set(c.id, c));

    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convoIds)
      .neq("user_id", user.id);

    // For groups, collect all other member IDs per conversation
    const otherByConvo = new Map<string, string[]>();
    (allParticipants || []).forEach((p) => {
      const existing = otherByConvo.get(p.conversation_id) || [];
      existing.push(p.user_id);
      otherByConvo.set(p.conversation_id, existing);
    });

    const otherIds = Array.from(new Set((allParticipants || []).map(p => p.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", otherIds);

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const previews: ConversationPreview[] = [];
    for (const convoId of convoIds) {
      const others = otherByConvo.get(convoId) || [];
      if (others.length === 0) continue;

      const { data: msgs } = await supabase
        .from("messages")
        .select("content, content_type, created_at")
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: false })
        .limit(1);

      const convoMeta = convoMap.get(convoId);
      const isGroup = convoMeta?.is_group || false;
      const firstOther = profileMap.get(others[0]);
      const lastMsg = msgs?.[0];
      
      previews.push({
        id: convoId,
        otherUserId: others[0],
        otherName: isGroup ? null : (firstOther?.name || null),
        otherUsername: isGroup ? null : (firstOther?.username || null),
        otherAvatar: isGroup ? null : (firstOther?.avatar_url || null),
        lastMessage: lastMsg?.content_type === "text" ? (lastMsg?.content || "") : `📎 ${lastMsg?.content_type || ""}`,
        lastMessageAt: lastMsg?.created_at || "",
        unreadCount: 0,
        isGroup,
        groupName: convoMeta?.name || null,
        memberAvatars: others.slice(0, 3).map(id => profileMap.get(id)?.avatar_url).filter(Boolean),
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

  const fetchFriends = async () => {
    if (!user) return;
    setFriendsLoading(true);
    const { data: friendRows } = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted");

    const ids = (friendRows || []).map((f) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );
    if (ids.length === 0) { setFriends([]); setFriendsLoading(false); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", ids);

    setFriends((profiles || []).filter((p: any) => p.username || p.name));
    setFriendsLoading(false);
  };

  useEffect(() => {
    if ((showNewChat || showGroupCreate) && user) fetchFriends();
  }, [showNewChat, showGroupCreate, user?.id]);

  const handleStartChat = async (friendId: string) => {
    if (!user) return;
    setCreating(friendId);

    const { data: convoId, error } = await supabase.rpc("find_or_create_conversation", { target_friend_id: friendId });
    if (error || !convoId) {
      console.error("find_or_create_conversation error:", error);
      const msg = error?.message || "Failed to start conversation";
      if (msg.includes("friends")) {
        toast.error("You must be friends to start a conversation");
      } else {
        toast.error(msg);
      }
      setCreating(null);
      return;
    }

    setCreating(null);
    setShowNewChat(false);
    navigate(`/chat/${convoId}`);
  };

  const handleCreateGroup = async () => {
    if (!user || selectedMembers.length < 1 || !groupName.trim()) return;
    setCreatingGroup(true);

    try {
      const { data: convoId, error } = await supabase.rpc("create_group_conversation", {
        group_name: groupName.trim(),
        member_ids: selectedMembers,
      });

      if (error || !convoId) {
        console.error("Group creation error:", error);
        toast.error(error?.message || "Failed to create group");
        setCreatingGroup(false);
        return;
      }

      toast.success("Group created! 🎉");
      setCreatingGroup(false);
      setShowGroupCreate(false);
      setGroupName("");
      setSelectedMembers([]);
      navigate(`/chat/${convoId}`);
    } catch (err) {
      console.error("Group creation exception:", err);
      toast.error("Failed to create group");
      setCreatingGroup(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
            onClick={() => setShowGroupCreate(true)}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center mr-1"
          >
            <Users size={16} className="text-foreground" />
          </button>
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
                {c.isGroup ? (
                  <div className="w-11 h-11 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Users size={18} className="text-accent" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {c.otherAvatar ? (
                      <img src={c.otherAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">{(c.otherName || c.otherUsername || "?")?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.isGroup ? (c.groupName || "Group") : (c.otherName || c.otherUsername || "Unknown")}
                    </p>
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

      {/* Create Group Dialog */}
      <Dialog open={showGroupCreate} onOpenChange={(v) => { setShowGroupCreate(v); if (!v) { setSelectedMembers([]); setGroupName(""); } }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Create Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name..."
              className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map(id => {
                  const f = friends.find(fr => fr.user_id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/20 text-accent text-[10px] font-medium">
                      {f?.name || f?.username}
                      <button onClick={() => toggleMember(id)}><X size={10} /></button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {friendsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
              ) : friends.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No friends yet</p>
              ) : (
                friends.map((f) => {
                  const selected = selectedMembers.includes(f.user_id);
                  return (
                    <button
                      key={f.user_id}
                      onClick={() => toggleMember(f.user_id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${selected ? "bg-accent/10 ring-1 ring-accent/30" : "bg-secondary/50 hover:bg-secondary"}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground">{(f.name || f.username || "?")?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium text-foreground truncate">{f.name || f.username}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? "bg-accent border-accent" : "border-muted-foreground/30"}`}>
                        {selected && <Check size={12} className="text-accent-foreground" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={creatingGroup || selectedMembers.length < 2 || !groupName.trim()}
              className="w-full py-2.5 rounded-xl gradient-accent text-accent-foreground text-sm font-medium disabled:opacity-50"
            >
              {creatingGroup ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Create Group (${selectedMembers.length} members)`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesScreen;
