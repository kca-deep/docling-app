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
    <div className="py-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 헤더 섹션 */}
      <div
        className="flex items-center gap-4 p-4 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${themeColors.primary} 8%, transparent) 0%, transparent 50%, color-mix(in oklch, ${themeColors.secondary} 5%, transparent) 100%)`,
        }}
      >
        {/* 아이콘 */}
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
          }}
        >
          <CollectionIcon className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>

        {/* 타이틀 + 배지 + 설명 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="text-lg font-bold bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
              }}
            >
              {isCasualMode ? "일상대화 모드" : collectionName}
            </h2>
            {/* 메타데이터 배지 */}
            {!isCasualMode && collectionMeta && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs px-2 py-0.5 gap-1">
                  <FileText className="h-3 w-3" style={{ color: themeColors.primary }} />
                  <span className="font-mono">{collectionMeta.documents_count}</span>
                </Badge>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 gap-1">
                  <Database className="h-3 w-3" style={{ color: themeColors.secondary }} />
                  <span className="font-mono">{collectionMeta.points_count}</span>
                </Badge>
              </div>
            )}
            {isCasualMode && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 gap-1">
                <MessageSquare className="h-3 w-3" style={{ color: themeColors.primary }} />
                <span>자유 대화</span>
              </Badge>
            )}
          </div>
          {/* 설명 */}
          <p className="text-sm text-muted-foreground mt-1">
            {isCasualMode
              ? "RAG 검색 없이 자유롭게 대화해보세요"
              : "문서 기반으로 정확한 답변을 찾아드립니다"}
          </p>
        </div>
      </div>

      {/* 추천 질문 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
          <span className="text-xs font-medium text-muted-foreground">
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
