import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Sun, Moon, MessageCircle, Plus, UserPlus, Clock, Users, BellRing, X } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import AddFriendDialog from "./AddFriendDialog";
import FriendRequestsDialog from "./FriendRequestsDialog";
import FriendsListDialog from "./FriendsListDialog";
import NotificationDropdown from "./NotificationDropdown";
import { subscribeToPush } from "@/lib/pushNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PUSH_PROMPT_KEY = "dripd_push_prompted";

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [pendingCount, setPendingCount] = useState(0);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  // Fetch unread messages
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

  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from("friends" as any)
        .select("*", { count: "exact", head: true })
        .eq("friend_id", user.id)
        .eq("status", "pending") as any;
      setPendingCount(count || 0);
    };
    const fetchFriends = async () => {
      const { data } = await supabase
        .from("friends" as any)
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted") as any;
      setFriendIds((data || []).map((f: any) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      ));
    };
    fetchPending();
    fetchFriends();
    fetchUnreadMessages();

    // Realtime for new messages
    const msgChannel = supabase
      .channel("header-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        if (payload.new?.sender_id !== user.id) setUnreadMsgCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id]);

  // Clear message badge when navigating to /messages
  useEffect(() => {
    if (location.pathname === "/messages" || location.pathname.startsWith("/chat/")) {
      setUnreadMsgCount(0);
    }
  }, [location.pathname]);

  // Push notification prompt — one-time after login
  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PUSH_PROMPT_KEY)) return;

    const timer = setTimeout(() => setShowPushPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleEnablePush = async () => {
    if (!user) return;
    localStorage.setItem(PUSH_PROMPT_KEY, "1");
    setShowPushPrompt(false);
    await subscribeToPush(user.id);
  };

  const handleDismissPush = () => {
    localStorage.setItem(PUSH_PROMPT_KEY, "1");
    setShowPushPrompt(false);
  };

  const refreshCounts = () => {
    if (!user) return;
    supabase
      .from("friends" as any)
      .select("*", { count: "exact", head: true })
      .eq("friend_id", user.id)
      .eq("status", "pending")
      .then(({ count }: any) => setPendingCount(count || 0));
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-95 transition-transform"
        >
          {theme === "dark" ? (
            <Sun size={16} className="text-gold" />
          ) : (
            <Moon size={16} className="text-muted-foreground" />
          )}
        </button>

        <h1 className="font-display text-lg font-semibold text-gradient-gold tracking-wide">Dripd</h1>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { navigate("/messages"); setUnreadMsgCount(0); }}
            className="relative w-9 h-9 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-95 transition-transform"
          >
            <MessageCircle size={16} className="text-muted-foreground" />
            {unreadMsgCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-gold text-white text-[9px] font-bold flex items-center justify-center px-1">
                {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
              </span>
            )}
          </button>

          <NotificationDropdown onRequestHandled={refreshCounts} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative w-9 h-9 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-95 transition-transform">
                <Plus size={16} className="text-muted-foreground" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-gold text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowAddFriend(true)}>
                <UserPlus size={14} className="mr-2" />
                Add Friend
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowRequests(true)}>
                <Clock size={14} className="mr-2" />
                Pending Requests
                {pendingCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-gold text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFriendsList(true)}>
                <Users size={14} className="mr-2" />
                All Friends
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Push notification prompt banner */}
      {showPushPrompt && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5 animate-in slide-in-from-top-2">
          <BellRing size={18} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Stay in the loop</p>
            <p className="text-[10px] text-muted-foreground">Get alerts for friend requests, streaks & more</p>
          </div>
          <button
            onClick={handleEnablePush}
            className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold active:scale-95 transition-transform"
          >
            Enable
          </button>
          <button onClick={handleDismissPush} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      <AddFriendDialog
        open={showAddFriend}
        onOpenChange={setShowAddFriend}
        existingFriendIds={friendIds}
        onFriendAdded={refreshCounts}
      />
      <FriendRequestsDialog
        open={showRequests}
        onOpenChange={setShowRequests}
        onRequestHandled={refreshCounts}
      />
      <FriendsListDialog
        open={showFriendsList}
        onOpenChange={setShowFriendsList}
      />
    </>
  );
};

export default AppHeader;
