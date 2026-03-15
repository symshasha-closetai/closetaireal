import { motion } from "framer-motion";

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
  colorClass?: string;
  strokeColor?: string;
  light?: boolean;
}

const ScoreRing = ({ score, maxScore = 10, size = 56, label, colorClass, strokeColor, light }: ScoreRingProps) => {
  const strokeWidth = light ? 4 : 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score / maxScore;
  const offset = circumference * (1 - progress);

  const displayScore = Number.isInteger(score) ? score.toString() : score.toFixed(1);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={light ? "stroke-white/20" : "stroke-border/20"}
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={colorClass}
            style={strokeColor ? { stroke: strokeColor } : undefined}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-semibold ${light ? "text-white" : "text-foreground"}`} style={light ? { textShadow: "0 1px 6px rgba(0,0,0,0.7)" } : undefined}>{displayScore}</span>
        </div>
      </div>
      {label && (
        <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
          {label}
        </span>
      )}
    </div>
  );
};

export default ScoreRing;
