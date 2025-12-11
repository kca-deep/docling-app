"use client";

import { useEffect, useState, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Database,
  FileText,
  MessageSquare,
  Scale,
  Code,
  BookOpen,
  Briefcase,
  Heart,
  Cpu,
  Globe,
  Lightbulb,
  HelpCircle,
  Search,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

interface CollectionMetadata {
  name: string;
  documents_count: number;
  points_count: number;
  description?: string;
}

interface SuggestedPromptsProps {
  collectionName: string;
  onSelect: (prompt: string) => void;
}

// 컬렉션 이름에 따른 아이콘 매핑
const getCollectionIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("법") || lowerName.includes("law") || lowerName.includes("legal")) {
    return Scale;
  }
  if (lowerName.includes("코드") || lowerName.includes("code") || lowerName.includes("개발")) {
    return Code;
  }
  if (lowerName.includes("문서") || lowerName.includes("doc")) {
    return FileText;
  }
  if (lowerName.includes("책") || lowerName.includes("book") || lowerName.includes("교육")) {
    return BookOpen;
  }
  if (lowerName.includes("비즈") || lowerName.includes("business") || lowerName.includes("사업")) {
    return Briefcase;
  }
  if (lowerName.includes("건강") || lowerName.includes("health") || lowerName.includes("의료")) {
    return Heart;
  }
  if (lowerName.includes("기술") || lowerName.includes("tech") || lowerName.includes("ai")) {
    return Cpu;
  }
  if (lowerName.includes("글로벌") || lowerName.includes("global") || lowerName.includes("국제")) {
    return Globe;
  }
  return Database;
};

// 스켈레톤 로딩 UI
function WelcomeSkeleton() {
  return (
    <div className="py-4 space-y-4 animate-in fade-in duration-300">
      {/* 헤더 스켈레톤 - 가운데 정렬 */}
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-56" />
      </div>

      {/* 추천 질문 스켈레톤 */}
      <div className="space-y-2">
        <div className="flex justify-center">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export const SuggestedPrompts = memo(function SuggestedPrompts({
  collectionName,
  onSelect,
}: SuggestedPromptsProps) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionMeta, setCollectionMeta] = useState<CollectionMetadata | null>(null);

  // 일상대화 모드 체크
  const isCasualMode = !collectionName;

  // 테마 색상 설정
  const themeColors = isCasualMode
    ? { primary: "var(--chart-5)", secondary: "var(--chart-2)" }
    : { primary: "var(--chart-1)", secondary: "var(--chart-3)" };

  // 컬렉션 아이콘 가져오기
  const CollectionIcon = isCasualMode ? Sparkles : getCollectionIcon(collectionName);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 컬렉션이 있으면 메타데이터도 함께 가져오기
        const fetchPromises: Promise<any>[] = [];

        // 추천 프롬프트 가져오기
        const targetCollection = collectionName || "casual";
        fetchPromises.push(
          fetch(`${API_BASE_URL}/api/chat/suggested-prompts/${targetCollection}`, {
            credentials: "include",
          }).then((res) => (res.ok ? res.json() : { prompts: [] }))
        );

        // 컬렉션 메타데이터 가져오기 (컬렉션이 있을 때만)
        if (collectionName) {
          fetchPromises.push(
            fetch(`${API_BASE_URL}/api/chat/collections`, {
              credentials: "include",
            }).then((res) => (res.ok ? res.json() : { collections: [] }))
          );
        }

        const results = await Promise.all(fetchPromises);

        // 프롬프트 설정
        setPrompts(results[0]?.prompts || []);

        // 메타데이터 설정
        if (collectionName && results[1]?.collections) {
          const meta = results[1].collections.find(
            (c: CollectionMetadata) => c.name === collectionName
          );
          setCollectionMeta(meta || null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionName]);

  if (loading) {
    return <WelcomeSkeleton />;
  }

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="py-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 로고 + 환영 메시지 섹션 - 세로 중앙 정렬 + Aurora 배경 */}
      <div className="flex flex-col items-center text-center space-y-6 relative overflow-hidden py-8 -my-4 rounded-2xl">
        {/* Aurora Background - Enhanced with more blobs */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Aurora Blob 1 - Blue/Cyan (top-left) */}
          <div
            className="absolute -top-1/3 -left-1/4 w-[80%] h-[80%] rounded-full blur-[50px] opacity-35 dark:opacity-55 animate-aurora-1"
            style={{
              background: `radial-gradient(ellipse 70% 50% at center, oklch(0.65 0.22 230) 0%, oklch(0.55 0.18 210) 30%, transparent 60%)`,
            }}
          />
          {/* Aurora Blob 2 - Green/Teal (top-right) */}
          <div
            className="absolute -top-1/4 -right-1/3 w-[70%] h-[70%] rounded-full blur-[45px] opacity-30 dark:opacity-50 animate-aurora-2"
            style={{
              background: `radial-gradient(ellipse 60% 70% at center, oklch(0.72 0.2 160) 0%, oklch(0.6 0.15 140) 35%, transparent 60%)`,
            }}
          />
          {/* Aurora Blob 3 - Purple/Magenta (bottom-center) */}
          <div
            className="absolute top-1/3 left-1/4 w-[65%] h-[65%] rounded-full blur-[55px] opacity-25 dark:opacity-45 animate-aurora-3"
            style={{
              background: `radial-gradient(ellipse 55% 65% at center, oklch(0.6 0.22 300) 0%, oklch(0.5 0.18 320) 30%, transparent 55%)`,
            }}
          />
          {/* Aurora Blob 4 - Orange/Yellow (center-right) */}
          <div
            className="absolute top-0 right-0 w-[55%] h-[55%] rounded-full blur-[40px] opacity-20 dark:opacity-40 animate-aurora-4"
            style={{
              background: `radial-gradient(ellipse 50% 60% at center, oklch(0.75 0.18 80) 0%, oklch(0.65 0.15 60) 35%, transparent 55%)`,
            }}
          />
          {/* Aurora Blob 5 - Indigo/Deep Blue (bottom-left) */}
          <div
            className="absolute bottom-0 -left-1/4 w-[60%] h-[60%] rounded-full blur-[50px] opacity-25 dark:opacity-45 animate-aurora-5"
            style={{
              background: `radial-gradient(ellipse 65% 55% at center, oklch(0.55 0.2 260) 0%, oklch(0.45 0.18 280) 30%, transparent 55%)`,
            }}
          />
          {/* Aurora Blob 6 - Pink/Rose (center pulse) */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full blur-[60px] opacity-15 dark:opacity-35 animate-aurora-pulse"
            style={{
              background: `radial-gradient(circle, oklch(0.7 0.15 350) 0%, oklch(0.6 0.12 330) 40%, transparent 60%)`,
            }}
          />
        </div>
        {/* 로고 컨테이너 - 큰 원형으로 배경과 분리 */}
        <div className="relative z-10">
          {/* 외곽 글로우 효과 */}
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-30"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
              transform: "scale(1.2)",
            }}
          />
          {/* 메인 로고 원형 */}
          <div
            className="relative h-24 w-24 rounded-full flex items-center justify-center shadow-xl"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
            }}
          >
            <CollectionIcon className="h-12 w-12 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* 환영 메시지 영역 */}
        <div className="space-y-3 relative z-10">
          <h2
            className="text-xl md:text-2xl font-bold"
          >
            {isCasualMode
              ? "AI 어시스턴트에 오신걸 환영합니다."
              : `${collectionName} AI 챗봇에 오신걸 환영합니다.`}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {isCasualMode
              ? "RAG 검색 없이 자유롭게 대화해보세요"
              : "문서 기반으로 정확한 답변을 찾아드립니다"}
          </p>
          {/* 메타데이터 배지 - 환영 메시지 아래 */}
          {!isCasualMode && collectionMeta && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <Badge variant="secondary" className="text-xs px-2.5 py-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
                <span className="font-mono">{collectionMeta.documents_count} 문서</span>
              </Badge>
              <Badge variant="secondary" className="text-xs px-2.5 py-1 gap-1.5">
                <Database className="h-3.5 w-3.5" style={{ color: themeColors.secondary }} />
                <span className="font-mono">{collectionMeta.points_count} 벡터</span>
              </Badge>
            </div>
          )}
          {isCasualMode && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <Badge variant="secondary" className="text-xs px-2.5 py-1 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
                <span>자유 대화 모드</span>
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* 추천 질문 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: themeColors.primary }} />
          <span className="text-sm font-medium text-muted-foreground">
            {isCasualMode ? "대화 시작하기" : "추천 질문"}
          </span>
        </div>

        {/* 질문 그리드 2x2 */}
        <div className="grid grid-cols-2 gap-2">
          {prompts.slice(0, 4).map((prompt, index) => {
            const icons = [Lightbulb, HelpCircle, Search, Zap];
            const Icon = icons[index % icons.length];

            return (
              <button
                key={index}
                onClick={() => onSelect(prompt)}
                className={cn(
                  "group relative overflow-hidden rounded-lg text-sm text-left",
                  "border border-border/50 bg-background/50",
                  "hover:bg-background hover:border-border hover:shadow-md",
                  "active:scale-[0.98] transition-all duration-200"
                )}
              >
                {/* 좌측 컬러바 */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all duration-200"
                  style={{ backgroundColor: themeColors.primary }}
                />
                {/* 콘텐츠 */}
                <div className="flex items-start gap-2.5 pl-4 pr-3 py-2.5">
                  {/* 아이콘 */}
                  <Icon
                    className="h-4 w-4 flex-shrink-0 mt-0.5 transition-colors duration-200"
                    style={{ color: themeColors.primary }}
                  />
                  <span className="flex-1 line-clamp-2 text-sm font-medium leading-relaxed text-foreground/80 group-hover:text-foreground transition-colors">
                    {prompt}
                  </span>
                  {/* 화살표 */}
                  <span
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm mt-0.5"
                    style={{ color: themeColors.primary }}
                  >
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
