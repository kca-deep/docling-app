"use client";

import { motion } from "framer-motion";
import { FileText, Brain, Database, Sparkles, Zap, BookOpen, LucideIcon } from "lucide-react";

interface FloatingIconConfig {
  Icon: LucideIcon;
  delay: number;
  x: string;
  y: string;
  duration: number;
  colorVar: string;
}

const icons: FloatingIconConfig[] = [
  { Icon: FileText, delay: 0, x: "10%", y: "20%", duration: 20, colorVar: "var(--chart-1)" },
  { Icon: Brain, delay: 2, x: "80%", y: "30%", duration: 25, colorVar: "var(--chart-4)" },
  { Icon: Database, delay: 4, x: "15%", y: "70%", duration: 22, colorVar: "var(--chart-2)" },
  { Icon: Sparkles, delay: 1, x: "85%", y: "60%", duration: 18, colorVar: "var(--chart-3)" },
  { Icon: Zap, delay: 3, x: "50%", y: "15%", duration: 23, colorVar: "var(--chart-3)" },
  { Icon: BookOpen, delay: 5, x: "60%", y: "80%", duration: 21, colorVar: "var(--chart-5)" },
];

export function FloatingIcons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map(({ Icon, delay, x, y, duration, colorVar }, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            left: x,
            top: y,
            color: colorVar,
          }}
          initial={{ y: 0, rotate: 0, opacity: 0 }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0, 0.25, 0.25, 0],
          }}
          transition={{
            duration: duration,
            delay: delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon className="w-12 h-12 md:w-16 md:h-16" />
        </motion.div>
      ))}
    </div>
  );
}
