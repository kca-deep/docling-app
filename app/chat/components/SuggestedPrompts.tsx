"use client";

import { useEffect, useState, memo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Database,
  FileText,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

// 색상 테마 정의 (생동감 있는 직접 색상값)
const colorThemes = {
  casual: {
    primary: "#8B5CF6",     // violet-500
    secondary: "#06B6D4",   // cyan-500
    gradient: "conic-gradient(from 0deg, #8B5CF6, #06B6D4, #10B981, #F59E0B, #8B5CF6)",
  },
  rag: {
    primary: "#3B82F6",     // blue-500
    secondary: "#8B5CF6",   // violet-500
    gradient: "conic-gradient(from 0deg, #3B82F6, #8B5CF6, #EC4899, #3B82F6)",
  },
};

// stagger 애니메이션 variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// AnimatedLogo 컴포넌트 - 셀프진단 SpinningCircle 패턴 적용 + KCA-i 그라디언트 텍스트
interface AnimatedLogoProps {
  mode: "casual" | "rag";
}

function AnimatedLogo({ mode }: AnimatedLogoProps) {
  const theme = colorThemes[mode];

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
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          KCA-i
        </span>
      </motion.div>
    </div>
  );
}

// PromptCard 컴포넌트 - 글래스모피즘 + 호흡 애니메이션
interface PromptCardProps {
  prompt: string;
  index: number;
  themeColors: { primary: string; secondary: string };
  onSelect: (prompt: string) => void;
}

function PromptCard({ prompt, index, themeColors, onSelect }: PromptCardProps) {
  return (
    <motion.button
      onClick={() => onSelect(prompt)}
      className={cn(
        "group relative overflow-hidden text-left w-full",
        // 글래스모피즘 강화
        "rounded-2xl",
        "bg-white/10 dark:bg-white/5 backdrop-blur-xl",
        "border border-white/20 dark:border-white/10",
        // 그림자
        "shadow-lg shadow-black/5",
        // 호버 효과
        "hover:bg-white/20 dark:hover:bg-white/10",
        "hover:border-white/30",
        "hover:shadow-xl hover:scale-[1.02]",
        "active:scale-[0.98]",
        "transition-all duration-300 ease-out",
        "min-h-[88px]"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
    >
      {/* 호버 시 그라디언트 오버레이 */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${themeColors.primary}15 0%, transparent 60%)`,
        }}
      />

      {/* 좌측 그라디언트 악센트 바 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl opacity-70 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(180deg, ${themeColors.primary}, ${themeColors.secondary})`,
        }}
      />

      {/* 콘텐츠 */}
      <div className="flex items-start gap-4 p-5 pl-5">
        {/* 번호 아이콘 - 호흡 애니메이션 */}
        <motion.div
          className="flex-shrink-0 h-11 w-11 rounded-xl shadow-lg flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
        >
          <span className="text-white font-bold">{index + 1}</span>
        </motion.div>

        {/* 텍스트 영역 */}
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-sm font-medium leading-relaxed text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2">
            {highlightKeywords(prompt, themeColors.primary)}
          </p>
        </div>

        {/* 화살표 */}
        <ChevronRight className="flex-shrink-0 h-5 w-5 mt-2 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" />
      </div>
    </motion.button>
  );
}

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

// 스켈레톤 로딩 UI (개선된 크기)
function WelcomeSkeleton() {
  return (
    <div className="py-8 space-y-8 animate-in fade-in duration-300">
      {/* 헤더 스켈레톤 - 가운데 정렬 */}
      <div className="flex flex-col items-center gap-6 py-8 -my-4">
        {/* 로고 스켈레톤 */}
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-3 flex flex-col items-center">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* 추천 질문 스켈레톤 - 개선된 카드형 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
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

  // 테마 색상 설정 (새로운 생동감 있는 색상)
  const mode = isCasualMode ? "casual" : "rag";
  const themeColors = colorThemes[mode];

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
    <motion.div
      className="py-8 space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* 로고 + 환영 메시지 섹션 */}
      <motion.div
        className="flex flex-col items-center text-center space-y-6 relative py-8 -my-4"
        variants={itemVariants}
      >
        {/* AnimatedLogo - 동적 애니메이션 적용 */}
        <AnimatedLogo mode={mode} />

        {/* 환영 메시지 영역 */}
        <motion.div
          className="space-y-3 relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl md:text-2xl font-bold">
            {isCasualMode
              ? "AI 어시스턴트에 오신걸 환영합니다."
              : `${getKoreanName(collectionMeta?.description, collectionName)} AI 챗봇에 오신걸 환영합니다.`}
          </h2>
          <motion.p
            className="text-sm text-muted-foreground max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isCasualMode
              ? "RAG 검색 없이 자유롭게 대화해보세요"
              : "문서 기반으로 정확한 답변을 찾아드립니다"}
          </motion.p>

          {/* 메타데이터 배지 */}
          <motion.div
            className="flex items-center justify-center gap-2 pt-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            {!isCasualMode && collectionMeta ? (
              <>
                <Badge variant="secondary" className="text-xs px-2.5 py-1.5 gap-1.5">
                  <FileText className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
                  <span className="font-mono">{collectionMeta.documents_count} 문서</span>
                </Badge>
                <Badge variant="secondary" className="text-xs px-2.5 py-1.5 gap-1.5">
                  <Database className="h-3.5 w-3.5" style={{ color: themeColors.secondary }} />
                  <span className="font-mono">{collectionMeta.points_count} 벡터</span>
                </Badge>
              </>
            ) : (
              <Badge variant="secondary" className="text-xs px-2.5 py-1.5 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" style={{ color: themeColors.primary }} />
                <span>자유 대화 모드</span>
              </Badge>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* 추천 질문 섹션 */}
      <motion.div className="space-y-4" variants={itemVariants}>
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: themeColors.primary }} />
          <span className="text-sm font-medium text-muted-foreground">
            {isCasualMode ? "대화 시작하기" : "추천 질문"}
          </span>
        </div>

        {/* 질문 그리드 - PromptCard 사용 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prompts.slice(0, 4).map((prompt, index) => (
            <PromptCard
              key={index}
              prompt={prompt}
              index={index}
              themeColors={themeColors}
              onSelect={onSelect}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
});
