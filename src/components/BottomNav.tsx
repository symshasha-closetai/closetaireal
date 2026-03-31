import { Home, Camera, ShirtIcon, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Camera, label: "Camera" },
  { path: "/home", icon: Home, label: "Home" },
  { path: "/wardrobe", icon: ShirtIcon, label: "Wardrobe" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith("/chat") || location.pathname === "/messages") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/85 backdrop-blur-2xl safe-bottom">
      <div className="h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="flex items-center justify-around px-6 pt-3 pb-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-1 px-5 py-2 transition-all duration-300"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabLine"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-gold"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon
                size={24}
                strokeWidth={isActive ? 2 : 1.5}
                className={`transition-colors duration-300 ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`}
              />
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
