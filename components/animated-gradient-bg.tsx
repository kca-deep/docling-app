"use client";

export function AnimatedGradientBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Chart-1 기반 그라데이션 (파란색) */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-3xl -top-[200px] -left-[100px]"
        style={{
          background: "radial-gradient(circle, var(--chart-1) 0%, transparent 70%)",
          animation: "hero-gradient-1 15s ease-in-out infinite",
        }}
      />

      {/* Chart-2 기반 그라데이션 (초록색) */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl top-[50%] -right-[100px]"
        style={{
          background: "radial-gradient(circle, var(--chart-2) 0%, transparent 70%)",
          animation: "hero-gradient-2 18s ease-in-out infinite",
        }}
      />

      {/* Chart-3 기반 그라데이션 (주황색) */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full blur-3xl -bottom-[150px] left-[30%]"
        style={{
          background: "radial-gradient(circle, var(--chart-3) 0%, transparent 70%)",
          animation: "hero-gradient-3 12s ease-in-out infinite",
        }}
      />

      {/* Chart-5 기반 그라데이션 (보라색) - 추가 레이어 */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full blur-3xl top-[20%] left-[60%]"
        style={{
          background: "radial-gradient(circle, var(--chart-5) 0%, transparent 70%)",
          animation: "hero-gradient-2 20s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}
