"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Bot } from "lucide-react";

interface ChatbotLogoProps {
  className?: string;
  showSparkles?: boolean;
}

export function ChatbotLogo({ className, showSparkles = true }: ChatbotLogoProps) {
  return (
    <div className={cn("relative group flex-shrink-0", className)}>
      <div className={cn(
        "relative flex items-center justify-center w-8 h-8 rounded-full overflow-hidden",
        "bg-background/80 backdrop-blur-xl border border-primary/20 shadow-sm",
        "transition-all duration-500 ease-out",
        "group-hover:scale-105 group-hover:shadow-[0_0_20px_-5px_var(--primary)] group-hover:border-primary/50"
      )}>
        {/* Background Gradient (KCA Colors: Blue, Green, Red) */}
        <div className="absolute inset-0 opacity-[0.08] bg-[conic-gradient(at_center,_rgb(37,99,235),_rgb(16,185,129),_rgb(239,68,68),_rgb(37,99,235))]" />
        
        {/* Rotating Shine Effect */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />

        {/* Inner Icon */}
        <div className="relative z-10 w-4 h-4 text-primary transition-transform duration-500 group-hover:rotate-12">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                {/* Abstract KCA-inspired shape */}
                <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" 
                      stroke="url(#kca-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                <path d="M7.75 12C7.75 14.3472 9.65279 16.25 12 16.25C14.3472 16.25 16.25 14.3472 16.25 12C16.25 9.65279 14.3472 7.75 12 7.75C9.65279 7.75 7.75 9.65279 7.75 12Z" 
                      fill="url(#kca-gradient)" fillOpacity="0.2" stroke="url(#kca-gradient)" strokeWidth="1.5" />
                
                <defs>
                    <linearGradient id="kca-gradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgb(37, 99, 235)" /> {/* Blue */}
                        <stop offset="50%" stopColor="rgb(16, 185, 129)" /> {/* Green */}
                        <stop offset="100%" stopColor="rgb(239, 68, 68)" /> {/* Red */}
                    </linearGradient>
                </defs>
            </svg>
        </div>
      </div>
      
      {/* Decorative Sparkle (Optional) */}
      {showSparkles && (
        <Sparkles className="absolute -top-1 -right-1 w-2.5 h-2.5 text-yellow-500/80 opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 animate-pulse" />
      )}
    </div>
  );
}
