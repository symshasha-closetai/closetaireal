import { Home, Camera, ShirtIcon, Sparkles, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/camera", icon: Camera, label: "Camera" },
  { path: "/wardrobe", icon: ShirtIcon, label: "Wardrobe" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchRank = async () => {
      const today = new Date().toISOString().split("T")[0];
      // Get friends
      const { data: friendData } = await supabase
        .from("friends" as any)
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`) as any;
      const friendIds = (friendData || []).map((f: any) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      const relevantIds = [user.id, ...friendIds];

      const { data: dripData } = await supabase
        .from("drip_history" as any)
        .select("user_id, score")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999999`)
        .in("user_id", relevantIds)
        .order("score", { ascending: false }) as any;

      if (!dripData || dripData.length === 0) { setMyRank(null); return; }

      const bestByUser = new Map<string, number>();
      for (const row of dripData) {
        const existing = bestByUser.get(row.user_id);
        if (!existing || Number(row.score) > existing) {
          bestByUser.set(row.user_id, Number(row.score));
        }
      }

      const sorted = Array.from(bestByUser.entries()).sort((a, b) => b[1] - a[1]);
      const idx = sorted.findIndex(([uid]) => uid === user.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
    };
    fetchRank();
  }, [user?.id, location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl rounded-t-3xl safe-bottom">
      <div className="flex items-center justify-around px-6 pt-3 pb-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const showRank = tab.path === "/camera" && myRank !== null;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-1 px-5 py-2 transition-all duration-300"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-2xl bg-primary/15"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <tab.icon
                  size={22}
                  className={`transition-colors duration-300 ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                />
                {showRank && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                    {myRank}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-300 ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
