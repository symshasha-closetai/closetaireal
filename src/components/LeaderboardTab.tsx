import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Trophy, Crown, Loader2, Lightbulb, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import closetaiLogo from "@/assets/closetai-logo.webp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

type ViewMode = "daily" | "weekly";

let dailyCache: { entries: LeaderboardEntry[]; friendIds: string[]; ts: number } | null = null;
let weeklyCache: { entries: LeaderboardEntry[]; friendIds: string[]; ts: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000;

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

const LeaderboardTab = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(dailyCache?.entries || []);
  const [loading, setLoading] = useState(!dailyCache);
  const [friendIds, setFriendIds] = useState<string[]>(dailyCache?.friendIds || []);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null);

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

  const fetchFriendBonuses = async (relevantIds: string[], dateStr: string) => {
    const bonuses = new Map<string, number>();
    relevantIds.forEach(id => bonuses.set(id, 0));
    const ids = relevantIds.join(",");
    const { data: friendsToday } = await supabase
      .from("friends" as any)
      .select("user_id, friend_id, created_at")
      .gte("created_at", `${dateStr}T00:00:00`)
      .lt("created_at", `${dateStr}T23:59:59.999999`)
      .or(`user_id.in.(${ids}),friend_id.in.(${ids})`) as any;
    for (const f of (friendsToday || [])) {
      if (relevantIds.includes(f.user_id)) {
        bonuses.set(f.user_id, (bonuses.get(f.user_id) || 0) + 10);
      }
      if (relevantIds.includes(f.friend_id)) {
        bonuses.set(f.friend_id, (bonuses.get(f.friend_id) || 0) + 10);
      }
    }
    return bonuses;
  };

  const fetchStreakBonuses = async (relevantIds: string[], dateStr: string) => {
    const bonuses = new Map<string, number>();
    const { data: looks } = await supabase
      .from("daily_looks")
      .select("user_id, streak")
      .eq("look_date", dateStr)
      .in("user_id", relevantIds) as any;
    for (const look of (looks || [])) {
      if (Number(look.streak) > 1) {
        bonuses.set(look.user_id, 5);
      }
    }
    return bonuses;
  };

  const fetchDaily = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && dailyCache && Date.now() - dailyCache.ts < CACHE_TTL) {
      setEntries(dailyCache.entries);
      setFriendIds(dailyCache.friendIds);
      const idx = dailyCache.entries.findIndex((e) => e.user_id === user.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const friends = await fetchFriends();
    const relevantIds = [user.id, ...friends];
    const today = new Date().toISOString().split("T")[0];

    const [dripResult, friendBonuses, streakBonuses] = await Promise.all([
      supabase
        .from("drip_history" as any)
        .select("user_id, score, image_url, confidence_score, killer_tag, created_at")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999999`)
        .in("user_id", relevantIds)
        .order("score", { ascending: false }) as any,
      fetchFriendBonuses(relevantIds, today),
      fetchStreakBonuses(relevantIds, today),
    ]);

    const dripData = dripResult.data;
    if (!dripData || dripData.length === 0) {
      setEntries([]); setMyRank(null); setLoading(false);
      dailyCache = { entries: [], friendIds: friends, ts: Date.now() };
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
        const baseScore = Number(drip.score) * 10;
        const fBonus = friendBonuses.get(uid) || 0;
        const sBonus = streakBonuses.get(uid) || 0;
        return {
          user_id: uid,
          score: Math.round((baseScore + fBonus + sBonus) * 10) / 10,
          image_url: drip.image_url,
          confidence_score: drip.confidence_score ? Number(drip.confidence_score) : null,
          killer_tag: drip.killer_tag,
          name: prof.name || null,
          username: prof.username || null,
          avatar_url: prof.avatar_url || null,
        };
      })
      .sort((a, b) => b.score - a.score);

    setEntries(combined);
    const idx = combined.findIndex((e) => e.user_id === user.id);
    setMyRank(idx >= 0 ? idx + 1 : null);
    setLoading(false);
    dailyCache = { entries: combined, friendIds: friends, ts: Date.now() };
  }, [user?.id]);

  const fetchWeekly = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && weeklyCache && Date.now() - weeklyCache.ts < CACHE_TTL) {
      setEntries(weeklyCache.entries);
      setFriendIds(weeklyCache.friendIds);
      const idx = weeklyCache.entries.findIndex((e) => e.user_id === user.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const friends = await fetchFriends();
    const relevantIds = [user.id, ...friends];

    const now = new Date();
    const thisMonday = getMonday(now);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(lastSunday.getDate() - 1);

    const startStr = lastMonday.toISOString().split("T")[0];
    const endStr = lastSunday.toISOString().split("T")[0];

    const { data: dripData } = await supabase
      .from("drip_history" as any)
      .select("user_id, score, image_url, confidence_score, killer_tag, created_at")
      .gte("created_at", `${startStr}T00:00:00`)
      .lte("created_at", `${endStr}T23:59:59.999999`)
      .in("user_id", relevantIds)
      .order("score", { ascending: false }) as any;

    if (!dripData || dripData.length === 0) {
      setEntries([]); setMyRank(null); setLoading(false);
      weeklyCache = { entries: [], friendIds: friends, ts: Date.now() };
      return;
    }

    const dailyMaxes = new Map<string, Map<string, number>>();
    const dailyBest = new Map<string, any>();

    for (const row of dripData) {
      const dateKey = row.created_at.split("T")[0];
      if (!dailyMaxes.has(row.user_id)) dailyMaxes.set(row.user_id, new Map());
      const userDays = dailyMaxes.get(row.user_id)!;
      const existing = userDays.get(dateKey) || 0;
      const score = Number(row.score);
      if (score > existing) userDays.set(dateKey, score);
      const bestRow = dailyBest.get(row.user_id);
      if (!bestRow || score > Number(bestRow.score)) dailyBest.set(row.user_id, row);
    }

    const weekDays: string[] = [];
    for (let d = new Date(lastMonday); d <= lastSunday; d.setDate(d.getDate() + 1)) {
      weekDays.push(d.toISOString().split("T")[0]);
    }

    const wIds = relevantIds.join(",");
    const { data: weekFriends } = await supabase
      .from("friends" as any)
      .select("user_id, friend_id, created_at")
      .gte("created_at", `${startStr}T00:00:00`)
      .lte("created_at", `${endStr}T23:59:59.999999`)
      .or(`user_id.in.(${wIds}),friend_id.in.(${wIds})`) as any;

    const { data: weekLooks } = await supabase
      .from("daily_looks")
      .select("user_id, look_date, streak")
      .gte("look_date", startStr)
      .lte("look_date", endStr)
      .in("user_id", relevantIds) as any;

    const userDailyTotals = new Map<string, number[]>();
    const allUserIds = new Set<string>();
    dailyMaxes.forEach((_, uid) => allUserIds.add(uid));

    for (const uid of allUserIds) {
      const totals: number[] = [];
      const userDays = dailyMaxes.get(uid) || new Map();
      for (const day of weekDays) {
        const baseScore = (userDays.get(day) || 0) * 10;
        if (baseScore === 0) continue;
        const fBonus = (weekFriends || []).filter((f: any) =>
          (f.user_id === uid || f.friend_id === uid) && f.created_at.startsWith(day)
        ).length * 10;
        const sBonus = (weekLooks || []).some((l: any) =>
          l.user_id === uid && l.look_date === day && Number(l.streak) > 1
        ) ? 5 : 0;
        totals.push(baseScore + fBonus + sBonus);
      }
      if (totals.length > 0) userDailyTotals.set(uid, totals);
    }

    const userIds = Array.from(userDailyTotals.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, avatar_url")
      .in("user_id", userIds) as any;

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const combined: LeaderboardEntry[] = userIds
      .map((uid) => {
        const totals = userDailyTotals.get(uid) || [];
        const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
        const best = dailyBest.get(uid);
        const prof = profileMap.get(uid) || {};
        return {
          user_id: uid,
          score: Math.round(avg * 10) / 10,
          image_url: best?.image_url || null,
          confidence_score: best?.confidence_score ? Number(best.confidence_score) : null,
          killer_tag: best?.killer_tag || null,
          name: prof.name || null,
          username: prof.username || null,
          avatar_url: prof.avatar_url || null,
        };
      })
      .sort((a, b) => b.score - a.score);

    setEntries(combined);
    const idx = combined.findIndex((e) => e.user_id === user.id);
    setMyRank(idx >= 0 ? idx + 1 : null);
    setLoading(false);
    weeklyCache = { entries: combined, friendIds: friends, ts: Date.now() };
  }, [user?.id]);

  useEffect(() => {
    if (viewMode === "daily") fetchDaily();
    else fetchWeekly();
  }, [user?.id, viewMode]);

  const handleShare = async (entry: LeaderboardEntry, rank: number) => {
    setSharingId(entry.user_id);
    await new Promise((r) => setTimeout(r, 100));
    try {
      if (entry.image_url) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve();
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
  const podiumOrder = [1, 0, 2];

  const getRankBorderClass = (rank: number) => {
    if (rank === 1) return "ring-2 ring-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.4),0_0_8px_rgba(251,146,60,0.3)]";
    if (rank === 2) return "ring-2 ring-gray-300 shadow-[0_0_16px_rgba(156,163,175,0.3)]";
    if (rank === 3) return "ring-2 ring-amber-600 shadow-[0_0_16px_rgba(217,119,6,0.3)]";
    return "ring-1 ring-border/30";
  };

  const getRankGradientWrapper = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-[2px] rounded-2xl";
    if (rank === 2) return "bg-gradient-to-br from-gray-200 via-gray-400 to-gray-300 p-[2px] rounded-2xl";
    if (rank === 3) return "bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 p-[2px] rounded-2xl";
    return "";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  const ShareCard = ({ entry, rank }: { entry: LeaderboardEntry; rank: number }) => (
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
          <p className="text-3xl font-bold">{entry.score.toFixed(1)}<span className="text-lg text-white/60">/100</span></p>
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
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={closetaiLogo} alt="ClosetAI" className="w-6 h-6 rounded-md" />
          <span className="font-display text-sm font-semibold text-foreground">Leaderboard</span>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                <Lightbulb size={14} className="text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" side="bottom" align="end">
              <p className="text-xs font-semibold text-foreground mb-2">Boost Your Score</p>
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <p>🤝 <span className="font-medium text-foreground">+20 pts</span> — Add a new friend</p>
                <p>🔥 <span className="font-medium text-foreground">+10 pts</span> — Daily check-in streak</p>
                <p className="pt-1 text-[10px] text-muted-foreground/70">Base score = Drip score × 10 (out of 100)</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Daily / Weekly Toggle */}
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        <button
          onClick={() => setViewMode("daily")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            viewMode === "daily" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setViewMode("weekly")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            viewMode === "weekly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Last Week
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Trophy size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {viewMode === "daily" ? "No drip checks today yet!" : "No data from last week!"}
          </p>
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
              const gradientWrapper = getRankGradientWrapper(rank);

              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`${width}`}
                >
                  <div className={gradientWrapper}>
                    <div
                      className={`relative ${height} rounded-2xl overflow-hidden bg-card cursor-pointer`}
                      onClick={() => setSelectedEntry({ entry, rank })}
                    >
                      <button onClick={(e) => { e.stopPropagation(); handleShare(entry, rank); }}
                        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-foreground/30 backdrop-blur-sm flex items-center justify-center">
                        <Share2 size={11} className="text-primary-foreground" />
                      </button>

                      <div className="w-full h-full bg-secondary">
                        {entry.image_url ? (
                          <img src={entry.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Crown size={24} className="text-muted-foreground/30" /></div>
                        )}
                      </div>

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

                      {sharingId === entry.user_id && <ShareCard entry={entry} rank={rank} />}
                    </div>
                  </div>
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
                  onClick={() => setSelectedEntry({ entry, rank })}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/20 cursor-pointer">
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
                  <button onClick={(e) => { e.stopPropagation(); handleShare(entry, rank); }} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <Share2 size={12} className="text-muted-foreground" />
                  </button>
                  {sharingId === entry.user_id && <ShareCard entry={entry} rank={rank} />}
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

      {/* Full-screen card view */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/60 backdrop-blur-md z-[70] flex items-center justify-center p-6"
            onClick={() => setSelectedEntry(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              <div className={getRankGradientWrapper(selectedEntry.rank) || "rounded-2xl"}>
                <div className="rounded-2xl overflow-hidden bg-card">
                  {/* Close button */}
                  <button onClick={() => setSelectedEntry(null)}
                    className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-foreground/40 backdrop-blur-sm flex items-center justify-center">
                    <X size={16} className="text-primary-foreground" />
                  </button>

                  {/* Image */}
                  <div className="relative aspect-[3/4] bg-secondary">
                    {selectedEntry.entry.image_url ? (
                      <img src={selectedEntry.entry.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Crown size={48} className="text-muted-foreground/30" /></div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 pt-16">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {selectedEntry.entry.avatar_url ? (
                            <img src={selectedEntry.entry.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {(selectedEntry.entry.name || "?")?.[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {selectedEntry.entry.user_id === user?.id ? "You" : selectedEntry.entry.name || selectedEntry.entry.username || "Anon"}
                          </p>
                          {selectedEntry.entry.username && (
                            <p className="text-[10px] text-white/60">@{selectedEntry.entry.username}</p>
                          )}
                        </div>
                      </div>

                      {getRankTag(selectedEntry.rank) && (
                        <p className="text-base font-bold text-white mb-1">{getRankTag(selectedEntry.rank)}</p>
                      )}

                      <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-white">{selectedEntry.entry.score.toFixed(1)}<span className="text-base text-white/50">/100</span></p>
                        <button
                          onClick={() => handleShare(selectedEntry.entry, selectedEntry.rank)}
                          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                        >
                          <Share2 size={16} className="text-white" />
                        </button>
                      </div>

                      {selectedEntry.entry.killer_tag && (
                        <p className="text-xs text-white/50 mt-1">{selectedEntry.entry.killer_tag}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            {sharingId === selectedEntry.entry.user_id && <ShareCard entry={selectedEntry.entry} rank={selectedEntry.rank} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { RANK_TAGS };
export default LeaderboardTab;
