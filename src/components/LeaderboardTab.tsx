import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Share2, Trophy, Crown, Loader2, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddFriendDialog from "./AddFriendDialog";
import FriendRequestsDialog from "./FriendRequestsDialog";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import closetaiLogo from "@/assets/closetai-logo.webp";

const RANK_TAGS: Record<number, string> = {
  1: "Drip God 👑",
  2: "Style Titan ⚡",
  3: "Trend Sniper 🎯",
  4: "Fit Assassin 🔪",
  5: "Clean Killer 🧼",
  6: "Aura Builder ✨",
  7: "Street Scholar 🧠",
  8: "Fit Flexer 💪",
  9: "Style Rookie 🚀",
  10: "Drip Starter 🔥",
};

type LeaderboardEntry = {
  user_id: string;
  score: number;
  image_url: string | null;
  confidence_score: number | null;
  killer_tag: string | null;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// Cache
let leaderboardCache: { entries: LeaderboardEntry[]; friendIds: string[]; ts: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const LeaderboardTab = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>(leaderboardCache?.entries || []);
  const [loading, setLoading] = useState(!leaderboardCache);
  const [friendIds, setFriendIds] = useState<string[]>(leaderboardCache?.friendIds || []);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const fetchPendingCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("friends" as any)
      .select("*", { count: "exact", head: true })
      .eq("friend_id", user.id)
      .eq("status", "pending") as any;
    setPendingCount(count || 0);
  };

  const fetchFriends = async () => {
    if (!user) return [];
    const { data } = await supabase
      .from("friends" as any)
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted") as any;
    const ids = (data || []).map((f: any) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );
    setFriendIds(ids);
    return ids;
  };

  const fetchLeaderboard = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && leaderboardCache && Date.now() - leaderboardCache.ts < CACHE_TTL) {
      setEntries(leaderboardCache.entries);
      setFriendIds(leaderboardCache.friendIds);
      const idx = leaderboardCache.entries.findIndex((e) => e.user_id === user.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const friends = await fetchFriends();
    const relevantIds = [user.id, ...friends];
    const today = new Date().toISOString().split("T")[0];

    const { data: dripData } = await supabase
      .from("drip_history" as any)
      .select("user_id, score, image_url, confidence_score, killer_tag, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59.999999`)
      .in("user_id", relevantIds)
      .order("score", { ascending: false }) as any;

    if (!dripData || dripData.length === 0) {
      setEntries([]); setMyRank(null); setLoading(false);
      leaderboardCache = { entries: [], friendIds: friends, ts: Date.now() };
      return;
    }

    const bestByUser = new Map<string, any>();
    for (const row of dripData) {
      const existing = bestByUser.get(row.user_id);
      if (!existing || Number(row.score) > Number(existing.score)) bestByUser.set(row.user_id, row);
    }

    const userIds = Array.from(bestByUser.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", userIds) as any;

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const combined: LeaderboardEntry[] = userIds
      .map((uid) => {
        const drip = bestByUser.get(uid);
        const prof = profileMap.get(uid) || {};
        return {
          user_id: uid, score: Number(drip.score), image_url: drip.image_url,
          confidence_score: drip.confidence_score ? Number(drip.confidence_score) : null,
          killer_tag: drip.killer_tag, name: prof.name || null,
          username: prof.username || null, avatar_url: prof.avatar_url || null,
        };
      })
      .sort((a, b) => b.score - a.score);

    setEntries(combined);
    const idx = combined.findIndex((e) => e.user_id === user.id);
    setMyRank(idx >= 0 ? idx + 1 : null);
    setLoading(false);
    leaderboardCache = { entries: combined, friendIds: friends, ts: Date.now() };
  }, [user?.id]);

  useEffect(() => {
    fetchLeaderboard();
    fetchPendingCount();
  }, [user?.id]);

  const handleShare = async (entry: LeaderboardEntry, rank: number) => {
    setSharingId(entry.user_id);
    await new Promise((r) => setTimeout(r, 100));

    try {
      // Preload image
      if (entry.image_url) {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Still try even if preload fails
          img.src = entry.image_url!;
        });
      }

      const el = document.getElementById(`share-card-${entry.user_id}`);
      if (!el) return;
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true, allowTaint: true });
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      const file = new File([blob], "closetai-drip.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Drip Score — ClosetAI", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "closetai-drip.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image saved!");
      }
    } catch { toast.info("Couldn't share"); }
    setSharingId(null);
  };

  const getRankTag = (rank: number) => RANK_TAGS[rank] || null;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Podium order: 2nd left, 1st center, 3rd right
  const podiumOrder = [1, 0, 2]; // indices into top3

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={closetaiLogo} alt="ClosetAI" className="w-6 h-6 rounded-md" />
          <span className="font-display text-sm font-semibold text-foreground">Leaderboard</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRequests(true)} className="relative w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <Bell size={15} className="text-muted-foreground" />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                {pendingCount}
              </span>
            )}
          </button>
          <button onClick={() => setShowAddFriend(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-accent text-accent-foreground text-[11px] font-medium">
            <UserPlus size={13} /> Add
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Trophy size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No drip checks today yet!</p>
          <p className="text-xs text-muted-foreground/60">Check your outfit to appear on the leaderboard</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="flex items-end justify-center gap-2 pt-4">
            {podiumOrder.map((idx) => {
              const entry = top3[idx];
              if (!entry) return <div key={idx} className="flex-1" />;
              const rank = idx + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;

              const height = isFirst ? "h-[220px]" : isSecond ? "h-[190px]" : "h-[170px]";
              const width = isFirst ? "flex-[1.3]" : "flex-1";
              const borderColor = isFirst
                ? "ring-2 ring-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                : isSecond
                ? "ring-1 ring-gray-300/50"
                : "ring-1 ring-amber-600/40";

              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative ${width} ${height} rounded-2xl overflow-hidden ${borderColor} bg-card`}
                >
                  {/* Rank number top-left */}
                  <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${
                    rank === 1 ? "bg-yellow-400 text-yellow-900" : rank === 2 ? "bg-gray-300 text-gray-700" : "bg-amber-600 text-amber-100"
                  }`}>
                    {rank}
                  </div>

                  {/* Share button */}
                  <button onClick={() => handleShare(entry, rank)}
                    className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-foreground/30 backdrop-blur-sm flex items-center justify-center">
                    <Share2 size={11} className="text-primary-foreground" />
                  </button>

                  {/* Photo */}
                  <div className="w-full h-full bg-secondary">
                    {entry.image_url ? (
                      <img src={entry.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Crown size={24} className="text-muted-foreground/30" /></div>
                    )}
                  </div>

                  {/* Bottom overlay: avatar+name left, rank tag bigger, score */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2.5 pt-10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground">
                            {(entry.name || "?")?.[0]}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-white truncate">
                        {entry.user_id === user?.id ? "You" : entry.name || entry.username || "Anon"}
                      </span>
                    </div>
                    {getRankTag(rank) && (
                      <p className={`font-bold text-white leading-tight ${isFirst ? "text-sm" : "text-xs"}`}>
                        {getRankTag(rank)}
                      </p>
                    )}
                    <p className="text-lg font-bold text-white leading-none mt-0.5">{entry.score.toFixed(1)}</p>
                  </div>

                  {/* Hidden share card */}
                  {sharingId === entry.user_id && (
                    <div className="fixed -left-[9999px] top-0" id={`share-card-${entry.user_id}`}>
                      <div className="w-[360px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden p-5 text-white">
                        <div className="flex items-center gap-2 mb-4">
                          <img src={closetaiLogo} alt="" className="w-8 h-8 rounded-lg" crossOrigin="anonymous" />
                          <span className="font-bold text-sm">ClosetAI</span>
                        </div>
                        {entry.image_url && (
                          <img src={entry.image_url} alt="" className="w-full aspect-[3/4] object-cover rounded-xl mb-4" crossOrigin="anonymous" />
                        )}
                        <div className="space-y-2">
                          <p className="text-3xl font-bold">{entry.score.toFixed(1)}<span className="text-lg text-white/60">/10</span></p>
                          {getRankTag(rank) && <p className="text-lg font-semibold">{getRankTag(rank)}</p>}
                          {entry.killer_tag && <p className="text-xs text-white/50">{entry.killer_tag}</p>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/10 text-center">
                          <p className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
                            Drop My Drip ✨
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Rest of leaderboard */}
          <div className="space-y-1.5">
            {rest.map((entry, i) => {
              const rank = i + 4;
              return (
                <motion.div key={entry.user_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/20">
                  <span className="w-6 text-center text-xs font-bold text-muted-foreground">#{rank}</span>
                  <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                        {(entry.name || "?")?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {entry.user_id === user?.id ? "You" : entry.name || entry.username || "Anon"}
                    </p>
                    <div className="flex items-center gap-2">
                      {entry.username && <p className="text-[10px] text-muted-foreground">@{entry.username}</p>}
                      {getRankTag(rank) && <span className="text-[9px] text-muted-foreground">{getRankTag(rank)}</span>}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-foreground">{entry.score.toFixed(1)}</p>
                  <button onClick={() => handleShare(entry, rank)} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <Share2 size={12} className="text-muted-foreground" />
                  </button>
                  {sharingId === entry.user_id && (
                    <div className="fixed -left-[9999px] top-0" id={`share-card-${entry.user_id}`}>
                      <div className="w-[360px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden p-5 text-white">
                        <div className="flex items-center gap-2 mb-4">
                          <img src={closetaiLogo} alt="" className="w-8 h-8 rounded-lg" crossOrigin="anonymous" />
                          <span className="font-bold text-sm">ClosetAI</span>
                        </div>
                        {entry.image_url && (
                          <img src={entry.image_url} alt="" className="w-full aspect-[3/4] object-cover rounded-xl mb-4" crossOrigin="anonymous" />
                        )}
                        <div className="space-y-2">
                          <p className="text-3xl font-bold">{entry.score.toFixed(1)}<span className="text-lg text-white/60">/10</span></p>
                          {getRankTag(rank) && <p className="text-lg font-semibold">{getRankTag(rank)}</p>}
                          {entry.killer_tag && <p className="text-xs text-white/50">{entry.killer_tag}</p>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/10 text-center">
                          <p className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
                            Drop My Drip ✨
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Fixed rank bar */}
          {myRank && (
            <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center pointer-events-none">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-full bg-card/95 backdrop-blur-xl border border-border/40 shadow-elevated">
                <Trophy size={14} className="text-yellow-500" />
                <span className="text-sm font-semibold text-foreground">You are #{myRank}</span>
                {getRankTag(myRank) && <span className="text-xs text-muted-foreground">{getRankTag(myRank)}</span>}
              </motion.div>
            </div>
          )}
        </>
      )}

      <AddFriendDialog open={showAddFriend} onOpenChange={setShowAddFriend} existingFriendIds={friendIds}
        onFriendAdded={() => { fetchPendingCount(); }} />
      <FriendRequestsDialog open={showRequests} onOpenChange={setShowRequests}
        onRequestHandled={() => { fetchLeaderboard(true); fetchPendingCount(); }} />
    </div>
  );
};

export { RANK_TAGS };
export default LeaderboardTab;
