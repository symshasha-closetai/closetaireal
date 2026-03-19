import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

type Friend = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

interface SendToFriendPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: "text" | "image" | "drip_card" | "wardrobe_item";
  content?: string;
  metadata?: any;
}

const SendToFriendPicker = ({ open, onOpenChange, contentType, content = "", metadata }: SendToFriendPickerProps) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    const fetchFriends = async () => {
      setLoading(true);
      const { data: friendRows } = await supabase
        .from("friends" as any)
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted") as any;

      const ids = (friendRows || []).map((f: any) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      if (ids.length === 0) { setFriends([]); setLoading(false); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, username, avatar_url")
        .in("user_id", ids) as any;

      setFriends((profiles || []).filter((p: any) => p.username || p.name));
      setLoading(false);
    };
    fetchFriends();
  }, [open, user?.id]);

  const handleSend = async (friendId: string) => {
    if (!user) return;
    setSending(friendId);

    // Find or create conversation between user and friend
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
        // Check it's a 1:1 (only 2 participants)
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
      // Create new conversation
      const { data: newConvo, error: convoErr } = await supabase
        .from("conversations" as any)
        .insert({} as any)
        .select("id")
        .single() as any;
      if (convoErr || !newConvo) { toast.error("Failed to create conversation"); setSending(null); return; }
      conversationId = newConvo.id;

      // Add both participants
      await supabase.from("conversation_participants" as any).insert([
        { conversation_id: conversationId, user_id: user.id },
        { conversation_id: conversationId, user_id: friendId },
      ] as any);
    }

    // Send message
    const { error } = await supabase.from("messages" as any).insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || "",
      content_type: contentType,
      metadata: metadata || null,
    } as any);

    if (error) toast.error("Failed to send");
    else { toast.success("Sent! 💬"); onOpenChange(false); }
    setSending(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Send to Friend</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : friends.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No friends yet. Add friends first!</p>
          ) : (
            friends.map((f) => (
              <div key={f.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">{(f.name || f.username || "?")?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.name || f.username}</p>
                  {f.username && <p className="text-[10px] text-muted-foreground">@{f.username}</p>}
                </div>
                <button onClick={() => handleSend(f.user_id)} disabled={sending === f.user_id}
                  className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center">
                  {sending === f.user_id ? <Loader2 size={14} className="animate-spin text-accent-foreground" /> : <Send size={14} className="text-accent-foreground" />}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToFriendPicker;
