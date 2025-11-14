"use client";

import { motion } from "framer-motion";

export function AnimatedGradientBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 opacity-30 dark:opacity-20"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(255, 107, 107, 0.3), transparent 50%)",
            "radial-gradient(circle at 50% 80%, rgba(78, 205, 196, 0.3), transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%)",
          ],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <motion.div
        className="absolute inset-0 opacity-20 dark:opacity-15"
        animate={{
          background: [
            "radial-gradient(circle at 80% 20%, rgba(255, 159, 64, 0.3), transparent 50%)",
            "radial-gradient(circle at 20% 80%, rgba(153, 102, 255, 0.3), transparent 50%)",
            "radial-gradient(circle at 50% 20%, rgba(255, 206, 86, 0.3), transparent 50%)",
            "radial-gradient(circle at 80% 20%, rgba(255, 159, 64, 0.3), transparent 50%)",
          ],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}
