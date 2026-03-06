import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { User } from "lucide-react";

const AppHeader = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
          <Sparkles size={16} className="text-accent-foreground" />
        </div>
        <h1 className="font-display text-lg font-semibold">
          <span className="text-foreground">Closet</span><span className="text-foreground">AI</span>
        </h1>
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
