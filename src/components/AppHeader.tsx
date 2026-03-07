import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { User, Bell, Menu } from "lucide-react";
import logo from "@/assets/closetai-logo.png";

const AppHeader = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="flex items-center justify-between">
      <button className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center">
        <Bell size={16} className="text-muted-foreground" />
      </button>
      <div className="flex items-center gap-2">
        <img src={logo} alt="ClosetAI" className="w-8 h-8 rounded-lg object-contain" />
        <h1 className="font-display text-lg font-semibold text-foreground">ClosetAI</h1>
      </div>
      <button
        onClick={() => navigate("/profile")}
        className="w-9 h-9 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <User size={16} className="text-muted-foreground" />
        )}
      </button>
    </div>
  );
};

export default AppHeader;
