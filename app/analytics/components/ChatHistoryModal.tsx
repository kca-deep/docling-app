"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Clock,
  Cpu,
  FileText,
  Globe,
  Monitor,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";
import { getCollectionDisplayName } from "@/lib/collection-utils";
import { cn } from "@/lib/utils";

interface ChatLog {
  log_id: string;
  session_id: string;
  collection_name: string;
  message_type: "user" | "assistant";
  message_content: string;
  reasoning_level?: string;
  llm_model?: string;
  llm_params?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
  retrieval_info?: {
    retrieved_count?: number;
    top_scores?: number[];
    sources?: Array<{
      document_name?: string;
      page?: number;
    }>;
  };
  performance?: {
    response_time_ms?: number;
    token_count?: number;
    retrieval_time_ms?: number;
  };
  client_info?: {
    ip?: string;
    ip_hash?: string;
    user_agent?: string;
    referer?: string;
  };
  created_at: string;
}

interface SessionData {
  sessionId: string;
  logs: ChatLog[];
  userLog?: ChatLog;
  assistantLog?: ChatLog;
  clientInfo?: ChatLog["client_info"];
  createdAt: string;
}

interface ChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionName: string;
  dateFrom: Date;
  dateTo: Date;
}

// 브라우저 타입 파싱
function parseBrowser(userAgent?: string): { name: string; icon: "chrome" | "firefox" | "safari" | "edge" | "mobile" | "browser" } {
  if (!userAgent) return { name: "Unknown", icon: "browser" };
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return { name: "Mobile", icon: "mobile" };
  }
  if (ua.includes("edg")) return { name: "Edge", icon: "edge" };
  if (ua.includes("chrome")) return { name: "Chrome", icon: "chrome" };
  if (ua.includes("firefox")) return { name: "Firefox", icon: "firefox" };
  if (ua.includes("safari")) return { name: "Safari", icon: "safari" };
  return { name: "Browser", icon: "browser" };
}

export function ChatHistoryModal({
  open,
  onOpenChange,
  collectionName,
  dateFrom,
  dateTo,
}: ChatHistoryModalProps) {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const sessionsPerPage = 20; // 세션 기준 페이징
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 페이지 변경 시 스크롤 상단 이동
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = 0;
      }
    }
  }, [page]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (collectionName && collectionName !== "ALL") {
        params.append("collection_name", collectionName);
      }
      params.append("date_from", format(dateFrom, "yyyy-MM-dd"));
      params.append("date_to", format(dateTo, "yyyy-MM-dd"));
      params.append("limit", "5000"); // 충분한 데이터 조회

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/logs?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("로그 조회 실패");

      const data = await response.json();
      setLogs(data.logs || []);
      setPage(1);
      setExpandedSessions(new Set());
    } catch (error) {
      console.error("채팅 이력 조회 오류:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [collectionName, dateFrom, dateTo]);

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, fetchLogs]);

  // 전체 세션 그룹화 및 정렬 (메모이제이션)
  const allSessions = useMemo(() => {
    const grouped = logs.reduce((acc, log) => {
      const sessionId = log.session_id;
      if (!acc[sessionId]) {
        acc[sessionId] = [];
      }
      acc[sessionId].push(log);
      return acc;
    }, {} as Record<string, ChatLog[]>);

    // SessionData 배열로 변환
    const sessions = Object.entries(grouped).map(([sessionId, sessionLogs]): SessionData => {
      const userLog = sessionLogs.find((l) => l.message_type === "user");
      const assistantLog = sessionLogs.find((l) => l.message_type === "assistant");
      const clientInfo = sessionLogs.find((l) => l.client_info?.ip || l.client_info?.ip_hash)?.client_info;

      return {
        sessionId,
        logs: sessionLogs,
        userLog,
        assistantLog,
        clientInfo,
        createdAt: userLog?.created_at || sessionLogs[0]?.created_at || "",
      };
    });

    // 최신순 정렬 (createdAt 기준 내림차순)
    return sessions.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA; // 최신(큰 값)이 앞에 오도록
    });
  }, [logs]);

  // 페이징 계산
  const totalSessions = allSessions.length;
  const totalPages = Math.ceil(totalSessions / sessionsPerPage);
  const paginatedSessions = allSessions.slice(
    (page - 1) * sessionsPerPage,
    page * sessionsPerPage
  );

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (collectionName && collectionName !== "ALL") {
        params.append("collection_name", collectionName);
      }
      params.append("date_from", format(dateFrom, "yyyy-MM-dd"));
      params.append("date_to", format(dateTo, "yyyy-MM-dd"));

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/export/excel?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("내보내기 실패");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat_history_${format(dateFrom, "yyyyMMdd")}_${format(dateTo, "yyyyMMdd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("내보내기 오류:", error);
    }
  };

  const toggleExpand = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>채팅 이력</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {getCollectionDisplayName({ name: collectionName === "ALL" ? "전체" : collectionName })}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {format(dateFrom, "M/d")} ~ {format(dateTo, "M/d")}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 -mx-6 px-6">
          <div className="h-[calc(85vh-180px)]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                해당 기간에 채팅 이력이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {/* 5000건 초과 경고 */}
                {logs.length >= 5000 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>최대 5000건까지만 표시됩니다. 더 좁은 기간을 선택하거나 Excel로 내보내기 하세요.</span>
                  </div>
                )}

                {paginatedSessions.map((session) => {
                  const { sessionId, userLog, assistantLog, clientInfo, createdAt } = session;
                  const isExpanded = expandedSessions.has(sessionId);
                  const browser = parseBrowser(clientInfo?.user_agent);

                  return (
                    <div
                      key={sessionId}
                      className="border border-border/50 rounded-lg hover:border-border transition-colors overflow-hidden"
                    >
                      {/* 컴팩트 헤더 - 2줄 구조 */}
                      <div
                        className="px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors space-y-1.5"
                        onClick={() => toggleExpand(sessionId)}
                      >
                        {/* 첫째 줄: 메타 정보 */}
                        <div className="flex items-center gap-2">
                          {/* 시간 */}
                          <span className="text-xs font-medium tabular-nums shrink-0">
                            {format(new Date(createdAt), "MM-dd HH:mm")}
                          </span>

                          {/* IP */}
                          {clientInfo && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs shrink-0">
                                  <Globe className="h-3 w-3" />
                                  {clientInfo.ip || clientInfo.ip_hash?.slice(0, 8)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs">
                                  {clientInfo.ip || `Hash: ${clientInfo.ip_hash}`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* 브라우저 */}
                          {clientInfo?.user_agent && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs shrink-0">
                                  <Monitor className="h-3 w-3" />
                                  {browser.name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p className="text-xs break-all">{clientInfo.user_agent}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* 컬렉션 */}
                          <Badge variant="outline" className="text-xs h-5 shrink-0">
                            {getCollectionDisplayName({ name: userLog?.collection_name || "" })}
                          </Badge>

                          {/* 빈 공간 */}
                          <div className="flex-1" />

                          {/* 메타 정보 (아이콘 + 숫자) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {assistantLog?.performance?.response_time_ms != null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {(assistantLog.performance.response_time_ms / 1000).toFixed(1)}s
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>응답 시간: {assistantLog.performance.response_time_ms.toLocaleString()}ms</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {assistantLog?.performance?.token_count != null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <Zap className="h-3 w-3" />
                                    {assistantLog.performance.token_count >= 1000
                                      ? `${(assistantLog.performance.token_count / 1000).toFixed(1)}K`
                                      : assistantLog.performance.token_count}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>토큰: {assistantLog.performance.token_count.toLocaleString()}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {assistantLog?.retrieval_info?.retrieved_count != null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <FileText className="h-3 w-3" />
                                    {assistantLog.retrieval_info.retrieved_count}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>검색된 문서: {assistantLog.retrieval_info.retrieved_count}개</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {assistantLog?.reasoning_level && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-4 px-1",
                                  assistantLog.reasoning_level === "high" && "border-orange-500/50 text-orange-600",
                                  assistantLog.reasoning_level === "medium" && "border-blue-500/50 text-blue-600",
                                  assistantLog.reasoning_level === "low" && "border-green-500/50 text-green-600"
                                )}
                              >
                                {assistantLog.reasoning_level[0].toUpperCase()}
                              </Badge>
                            )}
                          </div>

                          {/* 확장/축소 아이콘 */}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>

                        {/* 둘째 줄: 사용자 질문 */}
                        <p className="text-sm line-clamp-2">
                          {userLog?.message_content || "질문 없음"}
                        </p>
                      </div>

                      {/* 확장된 내용 */}
                      {isExpanded && (
                        <div className="px-3 py-2 space-y-2 border-t border-border/30 bg-background">
                          {/* 사용자 질문 */}
                          {userLog && (
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-primary">Q:</span>
                              <p className="text-sm whitespace-pre-wrap break-words pl-4">
                                {userLog.message_content}
                              </p>
                            </div>
                          )}

                          {/* 어시스턴트 응답 */}
                          {assistantLog && (
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-chart-2">A:</span>
                              <div className="text-sm text-muted-foreground pl-4 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2">
                                <ReactMarkdown>
                                  {assistantLog.message_content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}

                          {/* 상세 메타 정보 */}
                          {assistantLog && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                              {assistantLog.llm_model && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs">
                                      <Cpu className="h-3 w-3" />
                                      {assistantLog.llm_model}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {assistantLog.llm_params && (
                                      <div className="text-xs">
                                        <p>temp: {assistantLog.llm_params.temperature}</p>
                                        <p>top_p: {assistantLog.llm_params.top_p}</p>
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {assistantLog.retrieval_info?.sources && assistantLog.retrieval_info.sources.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs">
                                      <FileText className="h-3 w-3" />
                                      출처 {assistantLog.retrieval_info.sources.length}개
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-1">
                                      {assistantLog.retrieval_info.sources.slice(0, 5).map((src, i) => (
                                        <p key={i}>
                                          {src.document_name}
                                          {src.page ? ` (p.${src.page})` : ""}
                                        </p>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 푸터: 페이지네이션 및 내보내기 */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2 tabular-nums">
              {page} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground ml-2">
              {totalSessions}개 세션 ({logs.length}건)
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />
            Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
