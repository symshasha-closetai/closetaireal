import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Check, X, Loader2, Bell } from "lucide-react";

type PendingRequest = {
  id: string;
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

interface FriendRequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestHandled: () => void;
}

const FriendRequestsDialog = ({ open, onOpenChange, onRequestHandled }: FriendRequestsDialogProps) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    // Get pending requests where I'm the friend_id
    const { data: friendRows } = await supabase
      .from("friends" as any)
      .select("id, user_id")
      .eq("friend_id", user.id)
      .eq("status", "pending") as any;

    if (!friendRows || friendRows.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const userIds = friendRows.map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", userIds) as any;

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    setRequests(friendRows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      name: profileMap.get(r.user_id)?.name || null,
      username: profileMap.get(r.user_id)?.username || null,
      avatar_url: profileMap.get(r.user_id)?.avatar_url || null,
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchRequests();
  }, [open, user?.id]);

  const handleAccept = async (requestId: string) => {
    setActing(requestId);
    const { error } = await supabase
      .from("friends" as any)
      .update({ status: "accepted" } as any)
      .eq("id", requestId) as any;
    if (error) toast.error("Failed to accept");
    else {
      toast.success("Friend request accepted! 🎉");
      setRequests(prev => prev.filter(r => r.id !== requestId));
      onRequestHandled();
    }
    setActing(null);
  };

  const handleDecline = async (requestId: string) => {
    setActing(requestId);
    const { error } = await supabase
      .from("friends" as any)
      .update({ status: "declined" } as any)
      .eq("id", requestId) as any;
    if (error) toast.error("Failed to decline");
    else {
      setRequests(prev => prev.filter(r => r.id !== requestId));
      onRequestHandled();
    }
    setActing(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Friend Requests</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No pending requests</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      {(r.name || r.username || "?")?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name || r.username || "Unknown"}</p>
                  {r.username && <p className="text-[10px] text-muted-foreground">@{r.username}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleAccept(r.id)}
                    disabled={acting === r.id}
                    className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center hover:bg-green-500/30 transition-colors"
                  >
                    {acting === r.id ? <Loader2 size={14} className="animate-spin text-green-600" /> : <Check size={14} className="text-green-600" />}
                  </button>
                  <button
                    onClick={() => handleDecline(r.id)}
                    disabled={acting === r.id}
                    className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center hover:bg-destructive/30 transition-colors"
                  >
                    <X size={14} className="text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FriendRequestsDialog;
