"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { SourceArtifactPanel } from "./SourceArtifactPanel";
import { ChatHeader } from "./ChatHeader";
import { API_BASE_URL } from "@/lib/api-config";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  Message,
  Source,
  RetrievedDocument,
  ChatSettings,
  ArtifactState,
  Collection,
} from "../types";
import { mapRetrievedDocsToSources } from "../utils/source-mapper";
import { parseSSEStream } from "../utils/sse-parser";
import { useDocumentUpload } from "../hooks/useDocumentUpload";
import { useChatSettings } from "../hooks/useChatSettings";
import { useArtifactPanel } from "../hooks/useArtifactPanel";
import { useCollections } from "../hooks/useCollections";
import { DocumentDropZone } from "./DocumentDropZone";

export function ChatContainer() {
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 커스텀 훅 호출 (상태 관리 위임)
  const {
    settings,
    setSettings,
    settingsLoaded,
    deepThinkingEnabled,
    setDeepThinkingEnabled,
  } = useChatSettings();

  const {
    artifactState,
    setArtifactState,
    openArtifact,
    closeArtifact,
    selectSource,
    updateSources,
    resetArtifact,
  } = useArtifactPanel();

  const {
    collections,
    selectedCollection,
    setSelectedCollection: setSelectedCollectionBase,
    isLoadingCollections,
  } = useCollections();

  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  // UUID 기반 세션 ID (충돌 방지)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [currentStage, setCurrentStage] = useState<string>(""); // 백엔드 단계 이벤트
  const lastUserMessageRef = useRef<{ content: string; quoted: Message | null } | null>(null);

  // 메모리 누수 방지용 refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // RAF 정리
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // AbortController 정리
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // 스트리밍 배칭용 refs
  const streamingBatchRef = useRef<{
    content: string;
    reasoning: string;
    sources: Source[];
    messageId: string;
    messageCreated: boolean;
    flushScheduled: boolean;
  }>({
    content: "",
    reasoning: "",
    sources: [],
    messageId: "",
    messageCreated: false,
    flushScheduled: false,
  });

  // 우측 패널 상태
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // 전체화면 상태 - URL 파라미터에서 초기값 읽기 (보안: 'true' 값만 허용)
  const [isFullscreen, setIsFullscreen] = useState(() => {
    const param = searchParams?.get('fullscreen');
    return param === 'true';
  });

  // 문서 업로드 훅 (다중 파일 지원)
  const {
    status: documentUploadStatus,
    isUploading: isDocumentUploading,
    isReady: isDocumentReady,
    uploadDocuments,
    clearDocument,
    tempCollectionName,
    uploadedFilenames,
  } = useDocumentUpload();

  // 문서 업로드 완료 시 toast 표시
  useEffect(() => {
    if (isDocumentReady && uploadedFilenames.length > 0) {
      const fileCount = uploadedFilenames.length;
      const pageCount = documentUploadStatus?.pageCount || 0;

      toast.success(
        fileCount === 1
          ? `"${uploadedFilenames[0]}" 준비 완료`
          : `${fileCount}개 파일 준비 완료`,
        {
          description: pageCount > 0
            ? `${pageCount}페이지 임베딩 완료 - 질문을 입력하세요`
            : "임베딩 완료 - 질문을 입력하세요",
          duration: 4000,
        }
      );
    }
  }, [isDocumentReady]); // isDocumentReady가 true로 변경될 때만 실행

  // Body 스크롤 제어 및 전체화면 클래스 추가
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('chat-fullscreen-active');

      // Portal 요소들의 z-index 강제 설정
      const forcePortalZIndex = () => {
        const selectors = [
          '[data-radix-popper-content-wrapper]',
          '[data-radix-select-content]',
          '[data-radix-select-viewport]',
          '[data-radix-dialog-overlay]',
          '[data-radix-dialog-content]',
          '[role="dialog"]',
          '[role="listbox"]'
        ];

        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.zIndex = '9999';
          });
        });
      };

      // Portal은 비동기로 렌더링되므로 여러 번 시도
      forcePortalZIndex();
      const timer1 = setTimeout(forcePortalZIndex, 100);
      const timer2 = setTimeout(forcePortalZIndex, 300);
      const timer3 = setTimeout(forcePortalZIndex, 500);

      // MutationObserver로 지속적으로 감시
      const observer = new MutationObserver(forcePortalZIndex);
      observer.observe(document.body, { childList: true });

      return () => {
        document.body.style.overflow = '';
        document.body.classList.remove('chat-fullscreen-active');
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        observer.disconnect();
      };
    }
  }, [isFullscreen]);

  // ESC 키로 아티팩트 패널 닫기 또는 전체화면 종료
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // 아티팩트 패널이 열려있으면 먼저 닫기
        if (artifactState.isOpen) {
          closeArtifact();
          return;
        }
        // 전체화면이면 전체화면 종료
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isFullscreen, artifactState.isOpen, closeArtifact]);

  // 설정 로드, 심층사고 토글, 컬렉션 로드는 커스텀 훅에서 처리됨

  // Function Calling: 파일 다운로드 트리거
  const triggerDownload = useCallback(async (fileId: string, filename: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/export/download/${fileId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("파일 다운로드 완료", {
        description: filename,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast.error("파일 다운로드 실패", {
        description: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }, []);

  // 메시지 전송 (스트리밍)
  const handleStreamingSend = useCallback(async (userMessage: Message, quotedMsg: Message | null = null) => {
    // AbortController 생성 (ref와 state 동시 업데이트로 race condition 방지)
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setAbortController(controller);

    // 단계 상태 초기화
    setCurrentStage("analyze");

    // aiMessageId를 try 블록 밖에서 선언 (catch 블록에서도 사용하기 위해)
    const aiMessageId = (Date.now() + 1).toString();

    try {
      // 대화 기록 준비
      let chatHistory = messages.filter(m => m.role !== "system").slice(-10);

      // 인용 메시지가 있으면 시스템 메시지로 추가
      if (quotedMsg) {
        chatHistory = [
          ...chatHistory,
          {
            id: `system_${Date.now()}`,
            role: "system" as const,
            content: `사용자가 다음 메시지에 대해 추가 질문합니다:\n\n"${quotedMsg.content.slice(0, 300)}${quotedMsg.content.length > 300 ? '...' : ''}"`,
            timestamp: new Date(),
          }
        ];
      }

      // 일상대화 모드 체크
      const isCasualMode = !selectedCollection;

      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          session_id: sessionId,  // 세션 ID 전달
          collection_name: selectedCollection || null,  // 빈 문자열이면 null로 전송 (일상대화 모드)
          temp_collection_name: tempCollectionName || null,  // 임시 컬렉션 (문서 업로드용)
          message: userMessage.content,
          model: settings.model,
          reasoning_level: settings.reasoningLevel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          top_k: settings.topK,
          stream: true,
          use_reranking: settings.useReranking,
          chat_history: chatHistory,
        }),
        signal: controller.signal, // AbortController의 signal 추가
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("스트리밍을 지원하지 않습니다");
      }

      let aiContent = "";
      let aiReasoningContent = "";
      let sources: Source[] = [];
      let retrievedDocs: RetrievedDocument[] = [];

      // 배칭용 상태 초기화
      const batch = streamingBatchRef.current;
      batch.content = "";
      batch.reasoning = "";
      batch.sources = [];
      batch.messageId = aiMessageId;
      batch.messageCreated = false;
      batch.flushScheduled = false;

      // 배치 플러시 함수 (requestAnimationFrame으로 다음 프레임에 업데이트)
      const flushBatch = () => {
        // 메모리 누수 방지: 마운트 해제 시 또는 스케줄되지 않은 경우 종료
        if (!batch.flushScheduled || !isMountedRef.current) {
          batch.flushScheduled = false;
          rafIdRef.current = null;
          return;
        }

        const currentContent = batch.content;
        const currentReasoning = batch.reasoning;
        const currentSources = batch.sources;
        const currentMessageId = batch.messageId;

        if (!batch.messageCreated && (currentContent || currentReasoning)) {
          batch.messageCreated = true;
          setMessages((prev) => [
            ...prev,
            {
              id: currentMessageId,
              role: "assistant",
              content: currentContent,
              timestamp: new Date(),
              model: settings.model,
              sources: currentSources,
              reasoningContent: currentReasoning || undefined,
            },
          ]);
        } else if (batch.messageCreated) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentMessageId
                ? {
                    ...msg,
                    content: currentContent,
                    sources: currentSources.length > 0 ? currentSources : msg.sources,
                    reasoningContent: currentReasoning || msg.reasoningContent,
                  }
                : msg
            )
          );
        }

        batch.flushScheduled = false;
        rafIdRef.current = null;
      };

      // 배치 스케줄 함수 (메모리 누수 방지: rafIdRef로 추적)
      const scheduleBatchFlush = () => {
        if (!batch.flushScheduled && isMountedRef.current) {
          batch.flushScheduled = true;
          rafIdRef.current = requestAnimationFrame(flushBatch);
        }
      };

      // SSE 스트림 파싱 (공통 유틸리티 사용)
      for await (const event of parseSSEStream(reader)) {
        switch (event.type) {
          case "stage":
            setCurrentStage(event.stage!);
            break;

          case "sources":
            retrievedDocs = event.sources!;
            sources = mapRetrievedDocsToSources(event.sources!);
            batch.sources = sources;
            setCurrentSources(sources);
            break;

          case "sources_update":
            // 인용 정보가 추가된 sources로 업데이트
            if (event.sourcesUpdate) {
              sources = mapRetrievedDocsToSources(event.sourcesUpdate);
              batch.sources = sources;
              setCurrentSources(sources);
              scheduleBatchFlush();
            }
            break;

          case "reasoning":
            aiReasoningContent += event.reasoning!;
            batch.reasoning = aiReasoningContent;
            scheduleBatchFlush();
            break;

          case "content":
            aiContent += event.content!;
            batch.content = aiContent;
            scheduleBatchFlush();
            break;

          case "done":
            // 최종 플러시 보장
            if (batch.flushScheduled) {
              flushBatch();
            }
            break;

          case "error":
            // 에러 이벤트 처리
            const errorMessage = event.error || "알 수 없는 오류가 발생했습니다.";
            const isCollectionExpired = event.errorType === "collection_expired";

            // AI 메시지에 에러 표시
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      content: isCollectionExpired
                        ? "업로드한 문서가 만료되었습니다. 문서를 다시 업로드해 주세요."
                        : errorMessage,
                      isError: true,
                    }
                  : msg
              )
            );

            // 토스트 알림
            if (isCollectionExpired) {
              toast.error("문서가 만료되었습니다", {
                description: "문서를 다시 업로드해 주세요.",
                duration: 5000,
              });
            } else {
              toast.error(errorMessage);
            }
            break;

          case "tool_calls":
            // Function Calling: 도구 호출 요청 (LLM이 도구 사용을 결정)
            if (event.toolCalls && event.toolCalls.length > 0) {
              // 도구 실행 중임을 사용자에게 알림
              const toolNames = event.toolCalls.map(tc => tc.function?.name || "unknown").join(", ");
              setCurrentStage(`도구 실행 중: ${toolNames}`);
            }
            break;

          case "tool_result":
            // Function Calling: 도구 실행 결과
            if (event.toolResult) {
              if (event.toolResult.success) {
                // 성공 메시지가 있으면 토스트로 표시
                if (event.toolResult.message) {
                  toast.success(event.toolResult.message);
                }
              } else {
                // 실패 시 에러 토스트
                toast.error(event.toolResult.message || "도구 실행 실패");
              }
            }
            break;

          case "action":
            // Function Calling: 클라이언트 액션 (다운로드 등)
            if (event.action) {
              switch (event.action.type) {
                case "download":
                  // 파일 다운로드 트리거
                  if (event.action.fileId && event.action.filename) {
                    triggerDownload(event.action.fileId, event.action.filename);
                  }
                  break;
                case "message":
                  // 메시지 표시
                  if (event.action.message) {
                    toast.info(event.action.message);
                  }
                  break;
                case "clipboard":
                  // 클립보드 복사 (추후 구현)
                  toast.info("클립보드에 복사되었습니다");
                  break;
              }
            }
            break;
        }
      }

      // 스트리밍 완료 후 최종 플러시
      if (batch.flushScheduled) {
        flushBatch();
      }

      // 스트리밍 완료 후 sources와 regenerationContext 추가
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                sources: sources.length > 0 ? sources : msg.sources, // sources 최종 반영
                regenerationContext: {
                  originalQuery: userMessage.content,
                  collectionName: selectedCollection,
                  settings: { ...settings },
                  retrievedDocs: retrievedDocs,
                },
              }
            : msg
        )
      );

      // 참조문서 패널이 열려있고 새 sources가 있으면 자동 업데이트
      if (artifactState.isOpen && sources.length > 0) {
        updateSources(sources, aiMessageId);
      }

      setIsLoading(false);
      setCurrentStage(""); // 단계 상태 초기화
      // AbortController 정리 (ref와 state 모두)
      abortControllerRef.current = null;
      setAbortController(null);
    } catch (error) {
      // AbortError는 사용자가 의도적으로 중단한 것이므로 에러로 처리하지 않음
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info("응답 생성이 중단되었습니다");

        // 부분 응답에 중단 표시 추가
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, metadata: { ...msg.metadata, aborted: true } }
              : msg
          )
        );
      } else {
        console.error("Error streaming message:", error);

        // 네트워크 오류인 경우 재시도 버튼 제공
        const isNetworkError = error instanceof TypeError && error.message.includes('fetch');

        toast.error(
          isNetworkError ? "네트워크 오류가 발생했습니다" : "스트리밍 중 오류가 발생했습니다",
          {
            duration: 8000,
            action: lastUserMessageRef.current ? {
              label: "재시도",
              onClick: () => {
                // 마지막 에러 메시지 제거
                setMessages((prev) => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg?.role === "assistant" && lastMsg?.content.includes("오류가 발생했습니다")) {
                    return prev.slice(0, -1);
                  }
                  return prev;
                });
                // 마지막 사용자 메시지로 재시도
                if (lastUserMessageRef.current) {
                  setInput(lastUserMessageRef.current.content);
                  if (lastUserMessageRef.current.quoted) {
                    setQuotedMessage(lastUserMessageRef.current.quoted);
                  }
                }
              },
            } : undefined,
          }
        );

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "죄송합니다. 스트리밍 중 오류가 발생했습니다.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }

      setIsLoading(false);
      setCurrentStage(""); // 단계 상태 초기화
      // AbortController 정리 (ref와 state 모두)
      abortControllerRef.current = null;
      setAbortController(null);
    }
  }, [messages, selectedCollection, tempCollectionName, settings, artifactState.isOpen, updateSources, triggerDownload]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) {
      toast.error("메시지를 입력해주세요");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    // 재시도를 위해 마지막 사용자 메시지 저장
    lastUserMessageRef.current = {
      content: input.trim(),
      quoted: quotedMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // 인용 메시지 처리
    const currentQuoted = quotedMessage;
    setQuotedMessage(null); // 전송 후 인용 초기화

    await handleStreamingSend(userMessage, currentQuoted);
  }, [input, quotedMessage, handleStreamingSend]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setCurrentSources([]);
    // 아티팩트 패널도 닫기
    resetArtifact();
    toast.success("대화가 초기화되었습니다");
  }, [resetArtifact]);

  // 재생성 핸들러 (스트리밍)
  const handleRegenerate = useCallback(async (messageIndex: number) => {
    const targetMessage = messages[messageIndex];

    if (!targetMessage || targetMessage.role !== "assistant") {
      toast.error("재생성할 수 없는 메시지입니다");
      return;
    }

    const context = targetMessage.regenerationContext;

    if (!context) {
      toast.error("재생성 정보가 없습니다");
      return;
    }

    try {
      // 이전 AI 답변 제거
      setMessages((prev) => prev.slice(0, messageIndex));
      setIsLoading(true);
      setCurrentStage("generate"); // 재생성은 검색 없이 바로 생성 단계
      toast.info("답변을 다시 생성하고 있습니다");

      // 스트리밍 엔드포인트 호출 (원본 질의와 동일한 temperature 사용)
      const response = await fetch(`${API_BASE_URL}/api/chat/regenerate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          query: context.originalQuery,
          collection_name: context.collectionName,
          retrieved_docs: context.retrievedDocs,
          model: settings.model,
          reasoning_level: settings.reasoningLevel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          chat_history: messages
            .filter((m) => m.role !== "system")
            .slice(0, messageIndex)
            .slice(-10),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
        throw new Error(`API 오류 (${response.status}): ${errorData.detail || '알 수 없는 오류'}`);
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      const aiMessageId = (Date.now() + 1).toString();

      let aiContent = "";
      let aiReasoningContent = "";
      let messageCreated = false;
      let sources: Source[] = [];

      if (reader) {
        // SSE 스트림 파싱 (공통 유틸리티 사용)
        for await (const event of parseSSEStream(reader)) {
          switch (event.type) {
            case "stage":
              setCurrentStage(event.stage!);
              break;

            case "sources":
              sources = mapRetrievedDocsToSources(event.sources!);
              setCurrentSources(sources);
              break;

            case "reasoning":
              aiReasoningContent += event.reasoning!;
              if (!messageCreated) {
                messageCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: aiMessageId,
                    role: "assistant",
                    content: "",
                    timestamp: new Date(),
                    model: settings.model,
                    sources,
                    reasoningContent: aiReasoningContent,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, reasoningContent: aiReasoningContent }
                      : msg
                  )
                );
              }
              break;

            case "content":
              aiContent += event.content!;
              if (!messageCreated) {
                messageCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: aiMessageId,
                    role: "assistant",
                    content: aiContent,
                    timestamp: new Date(),
                    model: settings.model,
                    sources,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, content: aiContent, sources, reasoningContent: aiReasoningContent || msg.reasoningContent }
                      : msg
                  )
                );
              }
              break;

            case "done":
              break;
          }
        }
      }

      // 스트리밍 완료 후 sources와 regenerationContext 추가
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                sources: sources.length > 0 ? sources : msg.sources, // sources 최종 반영
                regenerationContext: {
                  originalQuery: context.originalQuery,
                  collectionName: context.collectionName,
                  settings: { ...settings },
                  retrievedDocs: context.retrievedDocs,
                },
              }
            : msg
        )
      );

      toast.success("답변이 재생성되었습니다");
    } catch (error) {
      console.error("Error regenerating message:", error);
      toast.error("재생성에 실패했습니다");
    } finally {
      setIsLoading(false);
      setCurrentStage(""); // 단계 상태 초기화
    }
  }, [messages, settings, setCurrentSources]);

  // <thought> 태그 제거 유틸리티 함수
  const removeThoughtTags = useCallback((content: string, model?: string): string => {
    // EXAONE 모델이 아니면 원본 그대로 반환
    if (!model || !model.toLowerCase().includes('exaone')) {
      return content;
    }

    // <thought>...</thought> 태그 제거
    const thoughtRegex = /<thought>[\s\S]*?<\/thought>/g;
    return content.replace(thoughtRegex, '').trim();
  }, []);

  // 인용 메시지 핸들러
  const handleQuote = useCallback((message: Message) => {
    // <thought> 태그 제거한 버전으로 인용
    const cleanedContent = removeThoughtTags(message.content, message.model);
    setQuotedMessage({
      ...message,
      content: cleanedContent
    });
  }, [removeThoughtTags]);

  const handleClearQuote = useCallback(() => {
    setQuotedMessage(null);
  }, []);

  const handlePromptSelect = useCallback((prompt: string) => {
    setInput(prompt);
  }, []);

  // 아티팩트 핸들러는 useArtifactPanel 훅에서 제공됨:
  // openArtifact, closeArtifact, selectSource

  // 스트리밍 중단 핸들러 (ref 사용으로 race condition 방지)
  const handleStopStreaming = useCallback(() => {
    const controller = abortControllerRef.current;
    if (controller && !controller.signal.aborted) {
      controller.abort();
      abortControllerRef.current = null;
      setAbortController(null);
    }
  }, []);

  // 파일 선택 핸들러 (다중 파일 지원)
  const handleFileSelect = useCallback((files: File[]) => {
    uploadDocuments(files, sessionId);
  }, [uploadDocuments, sessionId]);

  // 문서 제거 핸들러
  const handleClearDocument = useCallback(async () => {
    await clearDocument();
    toast.info("업로드된 문서가 제거되었습니다");
  }, [clearDocument]);

  // 컬렉션 변경 핸들러
  const handleCollectionChange = useCallback((newCollection: string) => {
    // 컬렉션이 실제로 변경된 경우에만 초기화
    const isChanged = setSelectedCollectionBase(newCollection);
    if (isChanged) {
      // 대화 초기화
      setMessages([]);

      // 검색 결과 초기화
      setCurrentSources([]);

      // 인용 메시지 초기화
      setQuotedMessage(null);

      // 아티팩트 패널도 닫기
      resetArtifact();

      // 사용자에게 알림 (일상대화 모드 전환 시 다른 메시지)
      if (newCollection) {
        toast.info(`"${newCollection}" 컬렉션으로 변경되었습니다. 대화가 초기화되었습니다.`);
      } else {
        toast.info("일상대화 모드로 전환되었습니다. RAG 검색 없이 자유롭게 대화할 수 있습니다.");
      }
    }
  }, [setSelectedCollectionBase, resetArtifact]);

  const chatContent = (
    <DocumentDropZone
      onFileDrop={handleFileSelect}
      disabled={isLoading || isDocumentUploading}
      className="h-full"
    >
    <div
      className={
        isFullscreen
          ? "fullscreen-chat-mode fixed inset-0 z-[60] bg-background flex flex-col overflow-hidden"
          : "flex flex-col h-full overflow-hidden"
      }
    >
      {/* 상단 헤더 - 웨이브 애니메이션 */}
      <ChatHeader
        isFullscreen={isFullscreen}
        onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
        theme={theme}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        mounted={mounted}
        selectedModel={settings.model}
        onModelChange={(model) => {
          setSettings(prev => ({ ...prev, model }));
          toast.info(`LLM 모델이 자동으로 변경되었습니다: ${model}`);
        }}
      />

      {/* 메인 콘텐츠 영역 (6:4 분할) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 채팅 영역 - Claude 스타일 단일 채팅창 */}
        <div className={cn(
          "flex flex-col overflow-hidden transition-all duration-200 ease-out bg-background relative",
          artifactState.isOpen ? "w-[60%]" : "w-full"
        )}>
          {/* 전체 배경 오로라 - 메시지 없을 때만 표시 (성능 최적화: 6개 → 2개, blur 축소) */}
          {messages.length === 0 && !isLoading && (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none animate-in fade-in duration-500">
              {/* Aurora Blob 1 - Blue/Cyan (top-left) */}
              <div
                className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[40px] opacity-40 dark:opacity-50 animate-aurora-1"
                style={{
                  background: `radial-gradient(ellipse 70% 50% at center, var(--aurora-1) 0%, var(--aurora-1-end) 30%, transparent 60%)`,
                }}
              />
              {/* Aurora Blob 2 - Green/Teal (bottom-right) */}
              <div
                className="absolute -bottom-[5%] -right-[15%] w-[55%] h-[55%] rounded-full blur-[35px] opacity-35 dark:opacity-45 animate-aurora-2"
                style={{
                  background: `radial-gradient(ellipse 60% 70% at center, var(--aurora-2) 0%, var(--aurora-2-end) 35%, transparent 60%)`,
                }}
              />
            </div>
          )}

          {/* 메시지 목록 - 전체 너비 활용 */}
          <div className="flex-1 overflow-hidden relative z-10">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              isStreaming={true}
              onRegenerate={handleRegenerate}
              onQuote={handleQuote}
              collectionName={selectedCollection}
              onPromptSelect={handlePromptSelect}
              onOpenArtifact={openArtifact}
              currentStage={currentStage}
              // 문서 업로드 상태 표시
              documentUploadStatus={documentUploadStatus}
              isDocumentReady={isDocumentReady}
              uploadedFilenames={uploadedFilenames}
              onClearDocument={handleClearDocument}
              // 피드백 관련 props
              sessionId={sessionId}
              reasoningLevel={settings.reasoningLevel}
            />
          </div>

          {/* 입력 영역 */}
          <div className="relative z-10">
            <InputArea
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            disabled={false}  // 일상대화 모드에서는 컬렉션 없이도 전송 가능
            quotedMessage={quotedMessage && quotedMessage.role !== "system" ? { role: quotedMessage.role, content: quotedMessage.content } : null}
            onClearQuote={handleClearQuote}
            onClearChat={handleClearChat}
            isFullscreen={isFullscreen}
            selectedCollection={selectedCollection}
            onCollectionChange={handleCollectionChange}
            collections={collections}
            settings={settings}
            onSettingsChange={setSettings}
            settingsPanelOpen={rightPanelOpen}
            onSettingsPanelChange={setRightPanelOpen}
            isStreaming={isLoading}
            onStopStreaming={handleStopStreaming}
            deepThinkingEnabled={deepThinkingEnabled}
            onDeepThinkingChange={setDeepThinkingEnabled}
            // 문서 업로드 관련
            isDocumentUploading={isDocumentUploading}
            isDocumentReady={isDocumentReady}
            onFileSelect={handleFileSelect}
            // 문서 컨텍스트 바용
            uploadedFilenames={uploadedFilenames}
            documentPageCount={documentUploadStatus?.pageCount}
            documentProgress={documentUploadStatus?.progress}
            documentStage={documentUploadStatus?.stage}
            documentError={documentUploadStatus?.error}
            documentFilename={documentUploadStatus?.filename}
            onClearDocument={handleClearDocument}
            />
          </div>
        </div>

        {/* 우측: 참조문서 아티팩트 패널 - 부드러운 전환 */}
        <div className={cn(
          "overflow-hidden transition-all duration-100 ease-out border-l border-border/50 bg-muted/10",
          artifactState.isOpen ? "w-[40%] opacity-100" : "w-0 opacity-0 border-0"
        )}>
          {artifactState.isOpen && (
            <SourceArtifactPanel
              sources={artifactState.sources}
              activeSourceId={artifactState.activeSourceId}
              onSourceSelect={selectSource}
              onClose={closeArtifact}
            />
          )}
        </div>
      </div>
    </div>
    </DocumentDropZone>
  );

  return chatContent;
}