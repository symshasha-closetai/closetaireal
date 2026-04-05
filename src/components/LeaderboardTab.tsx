import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Trophy, Crown, Loader2, Lightbulb, X, MoreVertical, EyeOff, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import dripdLogo from "@/assets/dripd-logo-new.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RANK_TAGS: Record<number, string> = {
  1: "Drip God 👑",
  2: "Style Icon ✨",
  3: "Fashion Elite 🔥",
  4: "Trend Leader 💫",
  5: "Vibe Master 🎯",
  6: "Clean Machine ⚡",
  7: "Rising Star 🌟",
  8: "Style Scout 👀",
  9: "Fresh Start 🌱",
  10: "New Wave 🫧",
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

import { getCache, setCache, CACHE_KEYS } from "@/lib/deviceCache";
import { precacheImages, getCachedImageUrl } from "@/lib/imageCache";

type LeaderboardCache = { entries: LeaderboardEntry[]; friendIds: string[] };
let dailyCache: (LeaderboardCache & { ts: number }) | null = null;
let weeklyCache: (LeaderboardCache & { ts: number }) | null = null;
const CACHE_TTL = 48 * 60 * 60 * 1000;

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

const LeaderboardTab = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => {
    if (dailyCache?.entries) return dailyCache.entries;
    const cached = user ? getCache<LeaderboardCache>(CACHE_KEYS.LEADERBOARD_DAILY, user.id) : null;
    return cached?.entries || [];
  });
  const [loading, setLoading] = useState(() => {
    if (dailyCache) return false;
    const cached = user ? getCache<LeaderboardCache>(CACHE_KEYS.LEADERBOARD_DAILY, user.id) : null;
    return !cached;
  });
  const [friendIds, setFriendIds] = useState<string[]>(dailyCache?.friendIds || []);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"sit_out" | "revert" | null>(null);
  const [optOutLoading, setOptOutLoading] = useState(false);

  const handleSitOut = async () => {
    if (!user) return;
    setOptOutLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      await supabase
        .from("drip_history")
        .delete()
        .eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`);
      dailyCache = null;
      weeklyCache = null;
      await fetchDaily(true);
      toast.success("Gracefully withdrawn from today's ranking");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setOptOutLoading(false);
      setConfirmAction(null);
    }
  };

  const handleRevert = async () => {
    if (!user) return;
    setOptOutLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      // Delete today's entries
      await supabase
        .from("drip_history")
        .delete()
        .eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`);
      // Find most recent previous entry
      const { data: prev } = await supabase
        .from("drip_history")
        .select("*")
        .eq("user_id", user.id)
        .lt("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) {
        await supabase.from("drip_history").insert({
          user_id: user.id,
          score: prev.score,
          image_url: prev.image_url,
          killer_tag: prev.killer_tag,
          praise_line: prev.praise_line,
          confidence_score: prev.confidence_score,
          full_result: prev.full_result,
          image_hash: prev.image_hash,
        });
        toast.success("Previous evaluation restored for today");
      } else {
        toast.info("No prior evaluation found to restore");
      }
      dailyCache = null;
      weeklyCache = null;
      await fetchDaily(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setOptOutLoading(false);
      setConfirmAction(null);
    }
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
    // Check in-memory first, then device cache
    if (!force && !dailyCache) {
      const deviceCached = getCache<LeaderboardCache>(CACHE_KEYS.LEADERBOARD_DAILY, user.id);
      if (deviceCached) {
        dailyCache = { ...deviceCached, ts: Date.now() };
      }
    }
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
    const today = new Date().toLocaleDateString('en-CA');

    // Fetch ALL users globally (RLS allows SELECT for authenticated)
    const dripResult = await supabase
      .from("drip_history" as any)
      .select("user_id, score, image_url, confidence_score, killer_tag, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59.999999`)
      .order("score", { ascending: false }) as any;

    const dripData = dripResult.data;
    if (!dripData || dripData.length === 0) {
      setEntries([]); setMyRank(null); setLoading(false);
      dailyCache = { entries: [], friendIds: friends, ts: Date.now() };
      if (user) setCache(CACHE_KEYS.LEADERBOARD_DAILY, user.id, { entries: [], friendIds: friends });
      return;
    }

    const bestByUser = new Map<string, any>();
    for (const row of dripData) {
      const existing = bestByUser.get(row.user_id);
      if (!existing || Number(row.score) > Number(existing.score)) bestByUser.set(row.user_id, row);
    }

    const userIds = Array.from(bestByUser.keys());

    // Compute bonuses only for users in the results
    const [friendBonuses, streakBonuses] = await Promise.all([
      fetchFriendBonuses(userIds, today),
      fetchStreakBonuses(userIds, today),
    ]);

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
    if (user) setCache(CACHE_KEYS.LEADERBOARD_DAILY, user.id, { entries: combined, friendIds: friends });
    // Pre-cache leaderboard images
    const imageUrls = combined.map(e => e.image_url).filter(Boolean) as string[];
    precacheImages(imageUrls);
  }, [user?.id]);

  const fetchWeekly = useCallback(async (force = false) => {
    if (!user) return;
    // Check in-memory first, then device cache
    if (!force && !weeklyCache) {
      const deviceCached = getCache<LeaderboardCache>(CACHE_KEYS.LEADERBOARD_WEEKLY, user.id);
      if (deviceCached) {
        weeklyCache = { ...deviceCached, ts: Date.now() };
      }
    }
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
      .order("score", { ascending: false }) as any;

    if (!dripData || dripData.length === 0) {
      setEntries([]); setMyRank(null); setLoading(false);
      weeklyCache = { entries: [], friendIds: friends, ts: Date.now() };
      if (user) setCache(CACHE_KEYS.LEADERBOARD_WEEKLY, user.id, { entries: [], friendIds: friends });
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

    // Weekly: raw scores only, no bonuses — consistent for all viewers
    const allWeekUserIds = Array.from(dailyMaxes.keys());

    const userDailyTotals = new Map<string, number[]>();
    for (const uid of allWeekUserIds) {
      const totals: number[] = [];
      const userDays = dailyMaxes.get(uid) || new Map();
      for (const day of weekDays) {
        const baseScore = (userDays.get(day) || 0) * 10;
        if (baseScore === 0) continue;
        totals.push(baseScore);
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
    if (user) setCache(CACHE_KEYS.LEADERBOARD_WEEKLY, user.id, { entries: combined, friendIds: friends });
    // Pre-cache leaderboard images
    const imageUrls = combined.map(e => e.image_url).filter(Boolean) as string[];
    precacheImages(imageUrls);
  }, [user?.id]);

  useEffect(() => {
    if (viewMode === "daily") fetchDaily();
    else fetchWeekly();
  }, [user?.id, viewMode]);

  // Listen for drip-saved events to force refresh
  useEffect(() => {
    const handler = () => {
      dailyCache = null;
      weeklyCache = null;
      if (viewMode === "daily") fetchDaily(true);
      else fetchWeekly(true);
    };
    window.addEventListener("drip-saved", handler);
    return () => window.removeEventListener("drip-saved", handler);
  }, [viewMode, fetchDaily, fetchWeekly]);

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
      const file = new File([blob], "dripd-drip.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Drip Score — Dripd", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "dripd-drip.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image saved!");
      }
    } catch (e: any) { if (e?.name !== "AbortError") toast.info("Couldn't share"); }
    setSharingId(null);
  };

  const getRankTag = (rank: number) => RANK_TAGS[rank] || null;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const podiumOrder = [1, 0, 2];

  const getRankBorderClass = (rank: number) => {
    if (rank === 1) return "ring-2 ring-gold shadow-[0_0_24px_hsl(42_60%_55%/0.4)]";
    if (rank === 2) return "ring-2 ring-gray-300 shadow-[0_0_16px_rgba(156,163,175,0.3)]";
    if (rank === 3) return "ring-2 ring-amber-700 shadow-[0_0_16px_rgba(180,100,30,0.3)]";
    return "ring-1 ring-border/30";
  };

  const getRankGradientWrapper = (rank: number) => {
    if (rank === 1) return "border-gradient-gold p-[2px] rounded-2xl relative";
    if (rank === 2) return "border-gradient-silver p-[2px] rounded-2xl relative";
    if (rank === 3) return "border-gradient-bronze p-[2px] rounded-2xl relative";
    return "";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  const ShareCard = ({ entry, rank }: { entry: LeaderboardEntry; rank: number }) => (
    <div className="fixed -left-[9999px] top-0" id={`share-card-${entry.user_id}`}>
      <div className="w-[360px] bg-gradient-to-br from-[#1a1612] to-[#0d0a08] rounded-2xl overflow-hidden text-white">
        {/* Header with logo */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <img src={dripdLogo} alt="" className="w-7 h-7 rounded-lg object-cover" crossOrigin="anonymous" />
            <span className="font-bold text-sm tracking-wider" style={{ color: '#C9A96E' }}>DRIPD</span>
          </div>
          {getRankTag(rank) && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
              #{rank} {getRankTag(rank)}
            </span>
          )}
        </div>
        {/* Image */}
        {entry.image_url && (
          <div className="px-4">
            <img src={entry.image_url} alt="" className="w-full aspect-[3/4] object-cover rounded-xl" crossOrigin="anonymous" />
          </div>
        )}
        {/* Score + info */}
        <div className="px-5 pt-4 pb-2 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
              {entry.avatar_url ? (
                <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-medium text-white/40">{(entry.name || "?")?.[0]}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{entry.name || entry.username || "Anon"}</p>
              {entry.username && <p className="text-[10px] text-white/40">@{entry.username}</p>}
            </div>
            <p className="text-3xl font-bold" style={{ color: '#C9A96E' }}>{entry.score.toFixed(1)}<span className="text-base text-white/40">/100</span></p>
          </div>
          {entry.killer_tag && (
            <p className="text-lg font-bold" style={{ color: '#C9A96E' }}>{entry.killer_tag}</p>
          )}
        </div>
        {/* CTA */}
        <div className="px-5 pb-4 pt-2 border-t border-white/10 mt-2 flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: '#C9A96E' }}>BEAT MY DRIP 🔥</p>
          <p className="text-[10px] text-white/30 tracking-widest uppercase">dripd.me</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Daily / Weekly Toggle + Bulb */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 bg-card rounded-xl p-1 gap-1 shadow-soft">
          <button
            onClick={() => setViewMode("daily")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              viewMode === "daily" ? "gradient-gold text-white shadow-sm" : "text-muted-foreground"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setViewMode("weekly")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              viewMode === "weekly" ? "gradient-gold text-white shadow-sm" : "text-muted-foreground"
            }`}
          >
            Last Week
          </button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <Lightbulb size={14} className="text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" side="bottom" align="end">
            <p className="text-xs font-semibold text-foreground mb-2">Boost Your Score</p>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <p>🤝 <span className="font-medium text-foreground">+10 pts</span> — Add a new friend</p>
              <p>🔥 <span className="font-medium text-foreground">+5 pts</span> — Daily check-in streak</p>
              <p className="pt-1 text-[10px] text-muted-foreground/70">Base score = Drip score × 10 (out of 100)</p>
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <MoreVertical size={14} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setConfirmAction("sit_out")} className="gap-2">
              <EyeOff size={14} />
              <div>
                <p className="text-xs font-medium">Sit This One Out</p>
                <p className="text-[10px] text-muted-foreground">Step away from today's spotlight</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmAction("revert")} className="gap-2">
              <RotateCcw size={14} />
              <div>
                <p className="text-xs font-medium">Revert to Previous Look</p>
                <p className="text-[10px] text-muted-foreground">Restore your last recorded evaluation</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "sit_out" ? "Withdraw from Today's Ranking?" : "Restore Previous Evaluation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "sit_out"
                ? "Your current analysis will be removed and you won't appear on today's leaderboard. This cannot be undone."
                : "Today's analysis will be replaced with your most recent previous evaluation. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={optOutLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={optOutLoading}
              onClick={confirmAction === "sit_out" ? handleSitOut : handleRevert}
            >
              {optOutLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {confirmAction === "sit_out" ? "Withdraw" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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
                        <p className="text-lg font-bold text-white leading-none mt-0.5" style={{ textShadow: '0 0 12px rgba(201,169,110,0.4)' }}>{entry.score.toFixed(1)}</p>
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
                className="pointer-events-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-full bg-card/95 backdrop-blur-xl border border-gold/20 shadow-elevated glow-gold">
                <Trophy size={14} className="text-gold" />
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
