import { motion } from "framer-motion";

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
  colorClass?: string;
}

const ScoreRing = ({ score, maxScore = 10, size = 90, label, colorClass = "stroke-accent" }: ScoreRingProps) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score / maxScore;
  const offset = circumference * (1 - progress);

  // Format score: show decimal if present, otherwise integer
  const displayScore = Number.isInteger(score) ? score.toString() : score.toFixed(1);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-secondary"
            strokeWidth={strokeWidth} />
          
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={colorClass}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }} />
          
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-foreground">{displayScore}</span>
        </div>
      </div>
      {label && <span className="text-[11px] text-muted-foreground font-medium">{label}</span>}
    </div>
  );
};

export default ScoreRing;
