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
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      const ids = (friendRows || []).map((f) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      if (ids.length === 0) { setFriends([]); setLoading(false); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, username, avatar_url")
        .in("user_id", ids);

      setFriends((profiles || []).filter((p: any) => p.username || p.name));
      setLoading(false);
    };
    fetchFriends();
  }, [open, user?.id]);

  const handleSend = async (friendId: string) => {
    if (!user) return;
    setSending(friendId);

    // Use atomic RPC to find or create conversation
    const { data: conversationId, error: convoErr } = await supabase.rpc("find_or_create_conversation", { target_friend_id: friendId });
    if (convoErr || !conversationId) {
      console.error("find_or_create_conversation error:", convoErr);
      const msg = convoErr?.message || "Failed to send";
      if (msg.includes("friends")) {
        toast.error("You must be friends to send messages");
      } else {
        toast.error(msg);
      }
      setSending(null);
      return;
    }

    // Send message
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || "",
      content_type: contentType,
      metadata: metadata || null,
    });

    if (error) {
      console.error("Message insert error:", error);
      toast.error("Failed to send");
    } else {
      toast.success("Sent! 💬");
      onOpenChange(false);
    }
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
