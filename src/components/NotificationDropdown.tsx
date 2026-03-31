import { useState, useEffect } from "react";
import { Bell, Check, X, MessageCircle, UserCheck, Loader2, Settings, Flame, Trophy, TrendingUp, Shirt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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

type NotifPreferences = {
  streak: boolean;
  competition: boolean;
  progression: boolean;
  social: boolean;
};

const DEFAULT_PREFS: NotifPreferences = { streak: true, competition: true, progression: true, social: true };

const PREF_ITEMS: { key: keyof NotifPreferences; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "streak", label: "Streak Alerts", desc: "Streak about to break", icon: Flame },
  { key: "competition", label: "Rank Drops", desc: "Someone beat your score", icon: Trophy },
  { key: "progression", label: "Personal Bests", desc: "New high score, tier up", icon: TrendingUp },
  { key: "social", label: "Outfit Alerts", desc: "Daily reminders & social", icon: Shirt },
];

const NotificationDropdown = ({ onRequestHandled }: Props) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<NotifPreferences>(DEFAULT_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data: pendingRequests } = await supabase
      .from("friends" as any)
      .select("id, user_id, created_at")
      .eq("friend_id", user.id)
      .eq("status", "pending") as any;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: acceptedRequests } = await supabase
      .from("friends" as any)
      .select("id, friend_id, created_at")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .gte("created_at", since24h) as any;

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
        id: `req-${req.id}`, type: "friend_request", fromUserId: req.user_id,
        fromName: prof.name || null, fromUsername: prof.username || null,
        fromAvatar: prof.avatar_url || null, friendRowId: req.id, timestamp: req.created_at,
      });
    }
    for (const acc of (acceptedRequests || [])) {
      const prof = profileMap.get(acc.friend_id) || {};
      notifs.push({
        id: `acc-${acc.id}`, type: "friend_accepted", fromUserId: acc.friend_id,
        fromName: prof.name || null, fromUsername: prof.username || null,
        fromAvatar: prof.avatar_url || null, timestamp: acc.created_at,
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
    if (!participations || participations.length === 0) { setUnreadMsgCount(0); return; }
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

  const fetchPreferences = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("push_subscriptions")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.preferences) {
      setPreferences({ ...DEFAULT_PREFS, ...(data.preferences as any) });
    }
  };

  const updatePreference = async (key: keyof NotifPreferences, value: boolean) => {
    if (!user) return;
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    await supabase
      .from("push_subscriptions")
      .update({ preferences: newPrefs as any })
      .eq("user_id", user.id);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    fetchUnreadMessages();
    fetchPreferences();

    const friendChannel = supabase
      .channel("notif-friends")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friends" }, () => fetchNotifications())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friends" }, () => fetchNotifications())
      .subscribe();

    const msgChannel = supabase
      .channel("notif-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        if (payload.new?.sender_id !== user.id) setUnreadMsgCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (open) { fetchNotifications(); fetchPreferences(); }
    if (!open) setShowSettings(false);
  }, [open]);

  const handleAccept = async (friendRowId: string, notifId: string) => {
    setActing(notifId);
    const { error } = await supabase
      .from("friends" as any)
      .update({ status: "accepted" } as any)
      .eq("id", friendRowId) as any;
    if (error) toast.error("Failed to accept request");
    else { toast.success("Friend request accepted!"); setNotifications(prev => prev.filter(n => n.id !== notifId)); onRequestHandled?.(); }
    setActing(null);
  };

  const handleDecline = async (friendRowId: string, notifId: string) => {
    setActing(notifId);
    const { error } = await supabase
      .from("friends" as any)
      .update({ status: "declined" } as any)
      .eq("id", friendRowId) as any;
    if (error) toast.error("Failed to decline request");
    else { toast.success("Request declined"); setNotifications(prev => prev.filter(n => n.id !== notifId)); onRequestHandled?.(); }
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
      <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto p-2">
        {/* Header with settings toggle */}
        <div className="flex items-center justify-between px-2 py-1.5 mb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${showSettings ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Settings size={13} />
          </button>
        </div>

        {/* Notification Preferences */}
        {showSettings && (
          <div className="border border-border/50 rounded-lg p-2 mb-2 space-y-1.5 bg-secondary/30">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Alert Preferences</p>
            {PREF_ITEMS.map(({ key, label, desc, icon: Icon }) => (
              <div key={key} className="flex items-center gap-2 px-1 py-1">
                <Icon size={13} className="text-primary/70 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground leading-tight">{label}</p>
                  <p className="text-[9px] text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={preferences[key]}
                  onCheckedChange={(v) => updatePreference(key, v)}
                  className="scale-75"
                />
              </div>
            ))}
          </div>
        )}

        {notifications.length === 0 && unreadMsgCount === 0 && !showSettings && (
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
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatTimeAgo(n.timestamp)}</p>
            </div>
            {n.type === "friend_request" && n.friendRowId && (
              <div className="flex gap-1 flex-shrink-0">
                {acting === n.id ? (
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); handleAccept(n.friendRowId!, n.id); }}
                      className="w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:opacity-80">
                      <Check size={12} className="text-primary-foreground" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDecline(n.friendRowId!, n.id); }}
                      className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20">
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
