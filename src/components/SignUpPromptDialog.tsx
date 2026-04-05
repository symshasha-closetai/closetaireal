import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, ShirtIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

type SignUpPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "drip" | "wardrobe";
};

const copy = {
  drip: {
    icon: Sparkles,
    title: "Your Drip Deserves to Be Remembered",
    body: "This score, this look, this moment — it all disappears without an account. Sign up in 10 seconds and never lose a drip check again.",
    cta: "Create My Account",
  },
  wardrobe: {
    icon: ShirtIcon,
    title: "Your Wardrobe Is Building Itself",
    body: "Every piece you add shapes your style DNA. Without an account, it vanishes when you close the app. Lock it in.",
    cta: "Create My Account",
  },
};

const SignUpPromptDialog = ({ open, onOpenChange, variant }: SignUpPromptDialogProps) => {
  const navigate = useNavigate();
  const c = copy[variant];
  const Icon = c.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs rounded-2xl border-border/50 bg-card p-0 overflow-hidden [&>button]:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center text-center px-6 py-8 space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-7 h-7 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground leading-tight">
              {c.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {c.body}
            </p>
          </div>

          <div className="w-full space-y-2.5 pt-1">
            <Button
              className="w-full rounded-xl h-11 font-medium gradient-accent text-accent-foreground"
              onClick={() => {
                onOpenChange(false);
                navigate("/auth");
              }}
            >
              {c.cta}
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default SignUpPromptDialog;
