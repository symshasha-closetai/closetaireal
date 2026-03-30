import { useState, useEffect } from "react";
import { Bell, Check, X, MessageCircle, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  type: "friend_request" | "friend_accepted" | "unread_messages";
  fromUserId: string;
  fromName: string | null;
  fromUsername: string | null;
  fromAvatar: string | null;
  friendRowId?: string;
  timestamp: string;
};

type Props = {
  onRequestHandled?: () => void;
};

const NotificationDropdown = ({ onRequestHandled }: Props) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;

    // Fetch pending friend requests (where I'm the recipient)
    const { data: pendingRequests } = await supabase
      .from("friends" as any)
      .select("id, user_id, created_at")
      .eq("friend_id", user.id)
      .eq("status", "pending") as any;

    // Fetch recently accepted requests (where I sent the request)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: acceptedRequests } = await supabase
      .from("friends" as any)
      .select("id, friend_id, created_at")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .gte("created_at", since24h) as any;

    // Get all user IDs we need profiles for
    const userIds = [
      ...(pendingRequests || []).map((r: any) => r.user_id),
      ...(acceptedRequests || []).map((r: any) => r.friend_id),
    ];

    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, username, avatar_url")
        .in("user_id", userIds) as any;
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));
    }

    const notifs: Notification[] = [];

    for (const req of (pendingRequests || [])) {
      const prof = profileMap.get(req.user_id) || {};
      notifs.push({
        id: `req-${req.id}`,
        type: "friend_request",
        fromUserId: req.user_id,
        fromName: prof.name || null,
        fromUsername: prof.username || null,
        fromAvatar: prof.avatar_url || null,
        friendRowId: req.id,
        timestamp: req.created_at,
      });
    }

    for (const acc of (acceptedRequests || [])) {
      const prof = profileMap.get(acc.friend_id) || {};
      notifs.push({
        id: `acc-${acc.id}`,
        type: "friend_accepted",
        fromUserId: acc.friend_id,
        fromName: prof.name || null,
        fromUsername: prof.username || null,
        fromAvatar: prof.avatar_url || null,
        timestamp: acc.created_at,
      });
    }

    notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(notifs);
  };

  const fetchUnreadMessages = async () => {
    if (!user) return;
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);
    if (!participations || participations.length === 0) {
      setUnreadMsgCount(0);
      return;
    }
    const convIds = participations.map(p => p.conversation_id);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .gte("created_at", since);
    setUnreadMsgCount(count || 0);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    fetchUnreadMessages();

    const friendChannel = supabase
      .channel("notif-friends")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friends" }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friends" }, () => {
        fetchNotifications();
      })
      .subscribe();

    const msgChannel = supabase
      .channel("notif-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        if (payload.new?.sender_id !== user.id) {
          setUnreadMsgCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  const handleAccept = async (friendRowId: string, notifId: string) => {
    setActing(notifId);
    const { error } = await supabase
      .from("friends" as any)
      .update({ status: "accepted" } as any)
      .eq("id", friendRowId) as any;
    if (error) {
      toast.error("Failed to accept request");
    } else {
      toast.success("Friend request accepted!");
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      onRequestHandled?.();
    }
    setActing(null);
  };

  const handleDecline = async (friendRowId: string, notifId: string) => {
    setActing(notifId);
    const { error } = await supabase
      .from("friends" as any)
      .update({ status: "declined" } as any)
      .eq("id", friendRowId) as any;
    if (error) {
      toast.error("Failed to decline request");
    } else {
      toast.success("Request declined");
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      onRequestHandled?.();
    }
    setActing(null);
  };

  const totalBadge = notifications.filter(n => n.type === "friend_request").length + unreadMsgCount;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative w-9 h-9 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-95 transition-transform">
          <Bell size={16} className="text-muted-foreground" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-gold text-white text-[9px] font-bold flex items-center justify-center px-1">
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto p-2">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">Notifications</p>

        {notifications.length === 0 && unreadMsgCount === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No notifications</p>
        )}

        {unreadMsgCount > 0 && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-secondary/50 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={14} className="text-primary" />
            </div>
            <p className="text-xs text-foreground flex-1">
              <span className="font-medium">{unreadMsgCount}</span> unread message{unreadMsgCount > 1 ? "s" : ""}
            </p>
          </div>
        )}

        {notifications.map(n => (
          <div key={n.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary/50 mb-0.5">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {n.fromAvatar ? (
                <img src={n.fromAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {(n.fromName || n.fromUsername || "?")?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">
                <span className="font-medium">{n.fromName || n.fromUsername || "Someone"}</span>
                {n.type === "friend_request" && " sent you a friend request"}
                {n.type === "friend_accepted" && " accepted your friend request"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatTimeAgo(n.timestamp)}
              </p>
            </div>
            {n.type === "friend_request" && n.friendRowId && (
              <div className="flex gap-1 flex-shrink-0">
                {acting === n.id ? (
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAccept(n.friendRowId!, n.id); }}
                      className="w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:opacity-80"
                    >
                      <Check size={12} className="text-primary-foreground" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDecline(n.friendRowId!, n.id); }}
                      className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20"
                    >
                      <X size={12} className="text-destructive" />
                    </button>
                  </>
                )}
              </div>
            )}
            {n.type === "friend_accepted" && (
              <UserCheck size={14} className="text-primary flex-shrink-0" />
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function formatTimeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 60000) return "just now";
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

export default NotificationDropdown;
