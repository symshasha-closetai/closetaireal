import { Sparkles } from "lucide-react";

const AppHeader = () => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
        <Sparkles size={16} className="text-accent-foreground" />
      </div>
      <h1 className="font-display text-lg font-semibold text-foreground">
        Closet<span className="text-gradient-accent">AI</span>
      </h1>
    </div>
  </div>
);

export default AppHeader;
