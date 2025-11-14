"use client";

import { motion } from "framer-motion";
import { FileText, Brain, Database, Sparkles, Zap, BookOpen } from "lucide-react";

const icons = [
  { Icon: FileText, delay: 0, x: "10%", y: "20%", duration: 20 },
  { Icon: Brain, delay: 2, x: "80%", y: "30%", duration: 25 },
  { Icon: Database, delay: 4, x: "15%", y: "70%", duration: 22 },
  { Icon: Sparkles, delay: 1, x: "85%", y: "60%", duration: 18 },
  { Icon: Zap, delay: 3, x: "50%", y: "15%", duration: 23 },
  { Icon: BookOpen, delay: 5, x: "60%", y: "80%", duration: 21 },
];

export function FloatingIcons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map(({ Icon, delay, x, y, duration }, index) => (
        <motion.div
          key={index}
          className="absolute opacity-10 dark:opacity-5"
          style={{ left: x, top: y }}
          initial={{ y: 0, rotate: 0, opacity: 0 }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0, 0.1, 0.1, 0],
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
