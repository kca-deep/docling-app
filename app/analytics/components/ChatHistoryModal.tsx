"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
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
  User,
  Bot,
  Clock,
  Cpu,
  FileText,
  Globe,
  Monitor,
  Hash,
  Zap,
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

interface ChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionName: string;
  dateFrom: Date;
  dateTo: Date;
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
  const [totalPages, setTotalPages] = useState(1);
  const logsPerPage = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (collectionName && collectionName !== "ALL") {
        params.append("collection_name", collectionName);
      }
      params.append("date_from", format(dateFrom, "yyyy-MM-dd"));
      params.append("date_to", format(dateTo, "yyyy-MM-dd"));
      params.append("limit", "500");

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/logs?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("로그 조회 실패");

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalPages(Math.ceil((data.logs?.length || 0) / logsPerPage));
      setPage(1);
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

  // 세션별로 그룹화
  const groupedLogs = logs
    .slice((page - 1) * logsPerPage, page * logsPerPage)
    .reduce((acc, log) => {
      const sessionId = log.session_id;
      if (!acc[sessionId]) {
        acc[sessionId] = [];
      }
      acc[sessionId].push(log);
      return acc;
    }, {} as Record<string, ChatLog[]>);

  // 세션을 시간순으로 정렬
  const sortedSessions = Object.entries(groupedLogs).sort((a, b) => {
    const aTime = a[1][0]?.created_at || "";
    const bTime = b[1][0]?.created_at || "";
    return bTime.localeCompare(aTime);
  });

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

  const truncateSessionId = (sessionId: string) => {
    if (sessionId.length <= 20) return sessionId;
    return `${sessionId.slice(0, 12)}...${sessionId.slice(-6)}`;
  };

  // client_info 추출 (userLog 또는 assistantLog에서)
  const getClientInfo = (sessionLogs: ChatLog[]) => {
    for (const log of sessionLogs) {
      if (log.client_info?.ip || log.client_info?.ip_hash || log.client_info?.user_agent) {
        return log.client_info;
      }
    }
    return null;
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

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
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
              <div className="space-y-4 py-4">
                {sortedSessions.map(([sessionId, sessionLogs]) => {
                  const firstLog = sessionLogs[0];
                  const userLog = sessionLogs.find((l) => l.message_type === "user");
                  const assistantLog = sessionLogs.find((l) => l.message_type === "assistant");
                  const clientInfo = getClientInfo(sessionLogs);

                  return (
                    <div
                      key={sessionId}
                      className="border border-border/50 rounded-lg p-4 space-y-3 hover:border-border transition-colors"
                    >
                      {/* 세션 헤더 - 날짜/시간 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {format(new Date(firstLog.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono cursor-help flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded">
                                <Hash className="h-3 w-3" />
                                {truncateSessionId(sessionId)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono text-xs">{sessionId}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {getCollectionDisplayName({ name: firstLog.collection_name })}
                        </Badge>
                      </div>

                      {/* 클라이언트 정보 */}
                      {clientInfo && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-b border-border/30 pb-3">
                          {clientInfo.ip && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded cursor-help">
                                  <Globe className="h-3 w-3" />
                                  {clientInfo.ip}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium">클라이언트 IP</p>
                                  {clientInfo.ip_hash && (
                                    <p className="text-xs opacity-70 font-mono">Hash: {clientInfo.ip_hash.slice(0, 16)}...</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {!clientInfo.ip && clientInfo.ip_hash && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help">
                                  <Globe className="h-3 w-3" />
                                  {clientInfo.ip_hash.slice(0, 12)}...
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs">IP Hash: {clientInfo.ip_hash}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {clientInfo.user_agent && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help max-w-[200px] truncate">
                                  <Monitor className="h-3 w-3 shrink-0" />
                                  {clientInfo.user_agent.includes("Mobile") ? "Mobile" :
                                   clientInfo.user_agent.includes("Chrome") ? "Chrome" :
                                   clientInfo.user_agent.includes("Firefox") ? "Firefox" :
                                   clientInfo.user_agent.includes("Safari") ? "Safari" :
                                   clientInfo.user_agent.includes("Edge") ? "Edge" : "Browser"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <p className="text-xs break-all">{clientInfo.user_agent}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {clientInfo.referer && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help">
                                  Referer
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{clientInfo.referer}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}

                      {/* 사용자 메시지 */}
                      {userLog && (
                        <div className="flex gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {userLog.message_content}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 어시스턴트 메시지 */}
                      {assistantLog && (
                        <div className="flex gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-chart-2/10 flex items-center justify-center">
                            <Bot className="h-3.5 w-3.5 text-chart-2" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm whitespace-pre-wrap break-words line-clamp-4 text-muted-foreground">
                              {assistantLog.message_content}
                            </p>
                            {/* 메타 정보 */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {assistantLog.llm_model && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help">
                                      <Cpu className="h-3 w-3" />
                                      {assistantLog.llm_model}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p>LLM 모델</p>
                                      {assistantLog.llm_params && (
                                        <div className="text-xs opacity-70">
                                          <p>temp: {assistantLog.llm_params.temperature}</p>
                                          <p>top_p: {assistantLog.llm_params.top_p}</p>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {assistantLog.performance?.token_count != null && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help">
                                      <Zap className="h-3 w-3" />
                                      {assistantLog.performance.token_count.toLocaleString()} tokens
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>출력 토큰 수</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {assistantLog.performance?.response_time_ms != null && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help">
                                      <Clock className="h-3 w-3" />
                                      {(assistantLog.performance.response_time_ms / 1000).toFixed(1)}s
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p>응답 시간: {assistantLog.performance.response_time_ms.toLocaleString()}ms</p>
                                      {assistantLog.performance.retrieval_time_ms != null && (
                                        <p className="text-xs opacity-70">검색: {assistantLog.performance.retrieval_time_ms}ms</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {assistantLog.retrieval_info?.retrieved_count != null && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded cursor-help">
                                      <FileText className="h-3 w-3" />
                                      {assistantLog.retrieval_info.retrieved_count}개 문서
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p>검색된 문서</p>
                                      {assistantLog.retrieval_info.top_scores && assistantLog.retrieval_info.top_scores.length > 0 && (
                                        <p className="text-xs opacity-70">
                                          점수: {assistantLog.retrieval_info.top_scores
                                            .slice(0, 3)
                                            .map((s) => s.toFixed(2))
                                            .join(", ")}
                                        </p>
                                      )}
                                      {assistantLog.retrieval_info.sources && assistantLog.retrieval_info.sources.length > 0 && (
                                        <div className="text-xs opacity-70 mt-1">
                                          {assistantLog.retrieval_info.sources.slice(0, 3).map((src, i) => (
                                            <p key={i}>{src.document_name} {src.page ? `(p.${src.page})` : ""}</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {assistantLog.reasoning_level && (
                                <Badge variant="outline" className={cn(
                                  "text-xs h-5",
                                  assistantLog.reasoning_level === "high" && "border-orange-500/50 text-orange-600",
                                  assistantLog.reasoning_level === "medium" && "border-blue-500/50 text-blue-600",
                                  assistantLog.reasoning_level === "low" && "border-green-500/50 text-green-600"
                                )}>
                                  {assistantLog.reasoning_level}
                                </Badge>
                              )}
                            </div>
                          </div>
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
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
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
              총 {logs.length}건
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />
            Excel 내보내기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
