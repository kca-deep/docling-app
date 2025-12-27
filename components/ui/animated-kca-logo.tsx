"use client"

import { motion } from "framer-motion"

// 셀프진단 테마 색상
const kcaTheme = {
  primary: "#3B82F6",     // blue-500
  secondary: "#10B981",   // emerald-500
  accent: "#EF4444",      // red-500
  gradient: "conic-gradient(from 0deg, #3B82F6, #10B981, #EF4444, #3B82F6)",
}

// KCA-i 애니메이션 로고 컴포넌트
export function AnimatedKcaLogo() {
  const theme = kcaTheme

  return (
    <div className="relative w-24 h-24">
      {/* 1. 회전하는 conic-gradient 테두리 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: theme.gradient, padding: "3px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-full h-full rounded-full bg-background" />
      </motion.div>

      {/* 2. 펄스 링 1 (느린 파동) - 다크모드 글로우 효과 강화 */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        style={{
          borderColor: `${theme.primary}90`,
          boxShadow: `0 0 20px ${theme.primary}60, 0 0 40px ${theme.primary}30`,
        }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 3. 펄스 링 2 (빠른 파동, 딜레이) - 글로우 효과 추가 */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        style={{
          borderColor: `${theme.secondary}80`,
          boxShadow: `0 0 15px ${theme.secondary}50, 0 0 30px ${theme.secondary}25`,
        }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: "easeInOut" }}
      />

      {/* 4. 내부 배경 원 + KCA-i 텍스트 */}
      <motion.div
        className="absolute inset-[6px] rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${theme.primary}30, ${theme.secondary}25)`,
          backdropFilter: "blur(12px)",
          boxShadow: `inset 0 0 20px ${theme.primary}20, 0 4px 20px ${theme.primary}15`,
        }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span
          className="text-lg font-bold"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          KCA-i
        </span>
      </motion.div>
    </div>
  )
}
