import { motion } from "framer-motion";
import logo from "@/assets/closetai-logo.png";

const SplashScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.img
          src={logo}
          alt="ClosetAI"
          className="w-24 h-24 rounded-2xl object-contain shadow-elevated dark:brightness-0 dark:invert"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        />
        <motion.h1
          className="font-display text-3xl font-semibold text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          ClosetAI
        </motion.h1>
        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          Your AI-powered style companion
        </motion.p>
        <motion.div
          className="mt-6 w-8 h-1 rounded-full gradient-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
};

export default SplashScreen;
