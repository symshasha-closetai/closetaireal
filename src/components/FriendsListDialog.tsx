import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";

type Friend = {
  friendship_id: string;
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

interface FriendsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FriendsListDialog = ({ open, onOpenChange }: FriendsListDialogProps) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchFriends = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("friends" as any)
      .select("id, user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted") as any;

    if (!data || data.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const friendUserIds = data.map((f: any) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", friendUserIds) as any;

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const list: Friend[] = data.map((f: any) => {
      const fuid = f.user_id === user.id ? f.friend_id : f.user_id;
      const prof = profileMap.get(fuid) || {};
      return {
        friendship_id: f.id,
        user_id: fuid,
        name: prof.name || null,
        username: prof.username || null,
        avatar_url: prof.avatar_url || null,
      };
    });

    setFriends(list);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchFriends();
  }, [open, user?.id]);

  const handleRemove = async (friendshipId: string) => {
    setRemoving(friendshipId);
    await supabase.from("friends" as any).delete().eq("id", friendshipId) as any;
    setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
    toast.success("Friend removed");
    setRemoving(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">All Friends</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No friends yet</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {friends.map((f) => (
              <div key={f.friendship_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/50">
                <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {(f.name || f.username || "?")?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.name || "Unnamed"}</p>
                  {f.username && <p className="text-[10px] text-muted-foreground">@{f.username}</p>}
                </div>
                <button
                  onClick={() => handleRemove(f.friendship_id)}
                  disabled={removing === f.friendship_id}
                  className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                >
                  {removing === f.friendship_id ? (
                    <Loader2 size={13} className="animate-spin text-destructive" />
                  ) : (
                    <UserMinus size={13} className="text-destructive" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FriendsListDialog;
