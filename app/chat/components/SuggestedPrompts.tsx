"use client";

import { useEffect, useState, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lightbulb,
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
    <div className="relative py-1 space-y-6 animate-in fade-in duration-300">
      {/* 배경 효과 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent rounded-3xl" />
      </div>

      {/* 웰컴 섹션 스켈레톤 */}
      <div className="flex flex-col items-center text-center py-8">
        <Skeleton className="h-20 w-20 rounded-2xl mb-5" />
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-4 w-48 mb-2" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* 섹션 헤더 스켈레톤 */}
      <div className="flex items-center gap-2 px-0.5">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <div className="flex-1 h-px bg-border/50" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>

      {/* 카드 그리드 스켈레톤 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/30 bg-background/40">
            <CardContent className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
    <div className="relative py-1 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 배경 효과 - 노이즈 + 그라데이션 */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `linear-gradient(135deg, ${themeColors.primary}10 0%, transparent 50%, ${themeColors.secondary}08 100%)`,
          }}
        />
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: themeColors.primary }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: themeColors.secondary }}
        />
      </div>

      {/* 웰컴 섹션 */}
      <div className="flex flex-col items-center text-center py-8 relative">
        {/* 메인 아이콘 - 글로우 효과 */}
        <div className="relative mb-5">
          {/* 글로우 배경 */}
          <div
            className="absolute inset-0 rounded-2xl blur-xl opacity-40 animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
              transform: "scale(1.2)",
            }}
          />
          {/* 아이콘 박스 */}
          <div
            className="relative h-20 w-20 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
            }}
          >
            <CollectionIcon className="h-10 w-10 text-white" strokeWidth={1.5} />
            {/* 온라인 상태 표시 */}
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 ring-3 ring-background shadow-lg" />
          </div>
        </div>

        {/* 타이틀 */}
        <h2
          className="text-2xl md:text-3xl font-bold mb-2 bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
          }}
        >
          {isCasualMode ? "일상대화 모드" : `${collectionName}`}
        </h2>

        {/* 서브타이틀 */}
        <p className="text-base text-muted-foreground max-w-lg leading-relaxed">
          {isCasualMode ? (
            <>
              자유롭게 대화해보세요.
              <br />
              RAG 검색 없이 일반 AI 대화가 가능합니다.
            </>
          ) : (
            <>
              문서 기반 AI 어시스턴트입니다.
              <br />
              업로드된 문서에서 정확한 답변을 찾아드립니다.
            </>
          )}
        </p>

        {/* 컬렉션 메타데이터 배지 */}
        {!isCasualMode && collectionMeta && (
          <div className="flex items-center gap-2 mt-5">
            <Badge
              variant="secondary"
              className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm"
            >
              <FileText className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
              <span className="font-mono">{collectionMeta.documents_count.toLocaleString()}</span>
              <span className="text-muted-foreground">documents</span>
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm"
            >
              <Database className="h-3.5 w-3.5" style={{ color: themeColors.secondary }} />
              <span className="font-mono">{collectionMeta.points_count.toLocaleString()}</span>
              <span className="text-muted-foreground">chunks</span>
            </Badge>
          </div>
        )}

        {/* 일상대화 모드 배지 */}
        {isCasualMode && (
          <div className="flex items-center gap-2 mt-5">
            <Badge
              variant="secondary"
              className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm"
            >
              <MessageSquare className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
              <span>자유 대화</span>
            </Badge>
          </div>
        )}
      </div>

      {/* 추천 질문 헤더 */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles
              className="h-4 w-4 animate-pulse"
              style={{ color: themeColors.primary }}
            />
            <Sparkles
              className="h-4 w-4 absolute inset-0 animate-ping opacity-30"
              style={{ color: themeColors.primary }}
            />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {isCasualMode ? "대화 시작하기" : "추천 질문"}
          </h3>
        </div>
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(to right, ${themeColors.primary}40, transparent)`,
          }}
        />
        <Badge
          variant="outline"
          className="text-xs px-2 py-0.5 font-mono border-border/50"
          style={{ color: themeColors.primary }}
        >
          {prompts.length}
        </Badge>
      </div>

      {/* 질문 카드 그리드 - 글래스모피즘 스타일 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prompts.slice(0, 6).map((prompt, index) => (
          <Card
            key={index}
            className={cn(
              "group cursor-pointer transition-all duration-300",
              "border-border/30 bg-background/40 backdrop-blur-sm",
              "hover:bg-background/70 hover:border-border/50",
              "hover:shadow-xl hover:scale-[1.02]",
              "active:scale-[0.98]",
              "animate-in fade-in slide-in-from-bottom-2"
            )}
            style={{
              animationDelay: `${index * 80}ms`,
            }}
            onClick={() => onSelect(prompt)}
          >
            {/* 호버 시 그라데이션 오버레이 */}
            <div
              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `linear-gradient(135deg, ${themeColors.primary}08 0%, transparent 50%, ${themeColors.secondary}05 100%)`,
              }}
            />

            <CardContent className="relative px-4 py-3.5">
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${themeColors.primary} 12%, transparent)`,
                    }}
                  >
                    <Lightbulb
                      className="h-4 w-4 transition-colors duration-300"
                      style={{ color: themeColors.primary }}
                    />
                  </div>
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed text-foreground/90 group-hover:text-foreground transition-colors line-clamp-2">
                    {prompt}
                  </p>
                </div>

                {/* 화살표 인디케이터 */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0">
                  <span
                    className="text-sm"
                    style={{ color: themeColors.primary }}
                  >
                    →
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 하단 힌트 */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono text-[10px]">
            Enter
          </kbd>
          <span>전송</span>
        </div>
        <span className="text-border">•</span>
        <span>클릭하여 질문 선택</span>
        <span className="text-border">•</span>
        <span>직접 입력 가능</span>
      </div>
    </div>
  );
});
