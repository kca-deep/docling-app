"use client";

import { useEffect, useState, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ChevronRight,
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

// description에서 한글명 추출 (JSON 형식인 경우 koreanName 파싱)
const getKoreanName = (description?: string, fallback?: string): string => {
  if (!description) return fallback || "";
  try {
    const parsed = JSON.parse(description);
    return parsed.koreanName || fallback || "";
  } catch {
    // JSON이 아니면 description 자체를 반환
    return description || fallback || "";
  }
};

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

// 키워드 하이라이팅 함수
function highlightKeywords(text: string, themeColor: string): React.ReactNode {
  // 하이라이팅할 키워드 패턴 (질문 키워드, 중요 명사 등)
  const keywordPatterns = [
    /어떻게|무엇|언제|어디|왜|얼마/g,  // 의문사
    /신청|등록|조회|확인|변경|취소|발급/g,  // 동작
    /연차|휴가|급여|복지|교육|출장|경비/g,  // 업무 관련
  ];

  let result = text;
  let hasMatch = false;

  // 각 패턴에 대해 매칭되는 키워드 찾기
  for (const pattern of keywordPatterns) {
    if (pattern.test(text)) {
      hasMatch = true;
      break;
    }
  }

  if (!hasMatch) {
    return text;
  }

  // 모든 패턴을 하나로 합치기
  const combinedPattern = /어떻게|무엇|언제|어디|왜|얼마|신청|등록|조회|확인|변경|취소|발급|연차|휴가|급여|복지|교육|출장|경비/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    // 매치 이전 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // 하이라이트된 키워드
    parts.push(
      <span
        key={match.index}
        className="font-semibold"
        style={{ color: themeColor }}
      >
        {match[0]}
      </span>
    );
    lastIndex = combinedPattern.lastIndex;
  }

  // 나머지 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

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

      {/* 추천 질문 스켈레톤 - 개선된 카드형 */}
      <div className="space-y-3">
        <div className="flex justify-center">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
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
      {/* 로고 + 환영 메시지 섹션 - 세로 중앙 정렬 (오로라는 MessageList에서 전체 배경으로 표시) */}
      <div className="flex flex-col items-center text-center space-y-6 relative py-8 -my-4">
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
              : `${getKoreanName(collectionMeta?.description, collectionName)} AI 챗봇에 오신걸 환영합니다.`}
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
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: themeColors.primary }} />
          <span className="text-sm font-medium text-muted-foreground">
            {isCasualMode ? "대화 시작하기" : "추천 질문"}
          </span>
        </div>

        {/* 질문 그리드 - 모바일 1열, 데스크탑 2열 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prompts.slice(0, 4).map((prompt, index) => {
            const isLongText = prompt.length > 40;

            // 카드 내용 컴포넌트
            const CardContent = (
              <button
                key={index}
                onClick={() => onSelect(prompt)}
                className={cn(
                  "group relative overflow-hidden rounded-xl text-left w-full",
                  "border border-border/50 bg-background/40 backdrop-blur-sm",
                  "hover:bg-background/80 hover:border-border hover:shadow-lg",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  "transition-all duration-300 ease-out",
                  "min-h-[80px]"
                )}
                style={{
                  animationDelay: `${index * 100}ms`,
                  animationFillMode: "backwards",
                }}
              >
                {/* 하단 컬러 악센트 바 */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${themeColors.primary}, ${themeColors.secondary})`,
                  }}
                />

                {/* 콘텐츠 영역 */}
                <div className="flex items-start gap-3 p-4">
                  {/* 번호 아이콘 박스 */}
                  <div
                    className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
                    }}
                  >
                    <span className="text-white font-bold text-sm">
                      {index + 1}
                    </span>
                  </div>

                  {/* 텍스트 영역 */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-medium leading-relaxed text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2">
                      {highlightKeywords(prompt, themeColors.primary)}
                    </p>
                  </div>

                  {/* 화살표 */}
                  <div className="flex-shrink-0 pt-2">
                    <ChevronRight
                      className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-300"
                    />
                  </div>
                </div>
              </button>
            );

            // 긴 텍스트인 경우 툴팁으로 감싸기
            if (isLongText) {
              return (
                <TooltipProvider key={index} delayDuration={500}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="animate-in fade-in slide-in-from-bottom-2"
                        style={{
                          animationDelay: `${index * 100}ms`,
                          animationDuration: "400ms",
                          animationFillMode: "backwards",
                        }}
                      >
                        {CardContent}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs text-sm p-3"
                      sideOffset={8}
                    >
                      {prompt}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <div
                key={index}
                className="animate-in fade-in slide-in-from-bottom-2"
                style={{
                  animationDelay: `${index * 100}ms`,
                  animationDuration: "400ms",
                  animationFillMode: "backwards",
                }}
              >
                {CardContent}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
