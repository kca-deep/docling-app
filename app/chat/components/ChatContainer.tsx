"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { SourceArtifactPanel } from "./SourceArtifactPanel";
import { API_BASE_URL } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import type {
  Message,
  Source,
  RetrievedDocument,
  ChatSettings,
  ArtifactState,
  Collection,
  DataSessionInfo,
  CodeExecution,
} from "../types";
import { mapRetrievedDocsToSources } from "../utils/source-mapper";
import { parseSSEStream } from "../utils/sse-parser";
import { useDocumentUpload } from "../hooks/useDocumentUpload";
import { useChatSettings } from "../hooks/useChatSettings";
import { useArtifactPanel } from "../hooks/useArtifactPanel";
import { useCollections } from "../hooks/useCollections";
import { DocumentDropZone } from "./DocumentDropZone";
import { DATA_EXTENSIONS } from "./DocumentUploadButton";

export function ChatContainer() {
  const searchParams = useSearchParams();

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
  const [dataSessionInfo, setDataSessionInfo] = useState<DataSessionInfo | null>(null);

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

  // 문서 업로드 완료 시 처리
  useEffect(() => {
    // 업로드 완료 시 추가 처리가 필요하면 여기에 작성
  }, [isDocumentReady]); // isDocumentReady가 true로 변경될 때만 실행

  // ESC 키로 아티팩트 패널 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && artifactState.isOpen) {
        closeArtifact();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [artifactState.isOpen, closeArtifact]);

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
    } catch (error) {
      console.error("Download error:", error);
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
          data_session_id: dataSessionInfo?.sessionId || null,  // 데이터 분석 세션 (Code Interpreter)
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
            break;

          case "code_execution":
            // Code Interpreter: 코드 실행 상태
            if (event.codeExecution) {
              // undefined 필드를 제외하여 기존 값(code 등)이 후속 이벤트에서 덮어씌워지지 않도록 함
              // (예: status=success 이벤트에는 code가 없으므로 undefined로 기존 code를 지우면 안 됨)
              const codeExec = Object.fromEntries(
                Object.entries({
                  status: event.codeExecution.status,
                  code: event.codeExecution.code,
                  description: event.codeExecution.description,
                  attempt: event.codeExecution.attempt,
                  error: event.codeExecution.error,
                  stderr: event.codeExecution.stderr,
                  executionTimeMs: event.codeExecution.executionTimeMs,
                }).filter(([, v]) => v !== undefined)
              ) as Partial<CodeExecution>;

              // 메시지의 codeExecutions 배열에 추가/업데이트
              const batchMsgId = batch.messageId;
              if (!batch.messageCreated) {
                batch.messageCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: batchMsgId,
                    role: "assistant",
                    content: "",
                    timestamp: new Date(),
                    model: settings.model,
                    codeExecutions: [codeExec as CodeExecution],
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== batchMsgId) return msg;
                    const existing = msg.codeExecutions || [];
                    // 같은 attempt의 상태 업데이트 (attempt로만 매칭, 상태 변경 이벤트에는 code가 없음)
                    const idx = existing.findIndex(
                      (e) => e.attempt === codeExec.attempt
                    );
                    if (idx >= 0) {
                      const updated = [...existing];
                      updated[idx] = { ...updated[idx], ...codeExec };
                      return { ...msg, codeExecutions: updated };
                    }
                    return { ...msg, codeExecutions: [...existing, codeExec as CodeExecution] };
                  })
                );
              }
            }
            break;

          case "code_output":
            // Code Interpreter: 코드 실행 출력
            if (event.codeOutput) {
              const batchMsgId = batch.messageId;
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== batchMsgId) return msg;
                  const existing = msg.codeExecutions || [];
                  if (existing.length > 0) {
                    const updated = [...existing];
                    const lastIdx = updated.length - 1;
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      stdout: event.codeOutput!.stdout,
                      images: event.codeOutput!.images,
                      executionTimeMs: event.codeOutput!.executionTimeMs,
                    };
                    return { ...msg, codeExecutions: updated };
                  }
                  return msg;
                })
              );
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
                  break;
                case "clipboard":
                  // 클립보드 복사 (추후 구현)
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
  }, [messages, selectedCollection, tempCollectionName, dataSessionInfo, settings, artifactState.isOpen, updateSources, triggerDownload]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) {
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
  }, [resetArtifact]);

  // 재생성 핸들러 (스트리밍)
  const handleRegenerate = useCallback(async (messageIndex: number) => {
    const targetMessage = messages[messageIndex];

    if (!targetMessage || targetMessage.role !== "assistant") {
      return;
    }

    const context = targetMessage.regenerationContext;

    if (!context) {
      return;
    }

    try {
      // 이전 AI 답변 제거
      setMessages((prev) => prev.slice(0, messageIndex));
      setIsLoading(true);
      setCurrentStage("generate"); // 재생성은 검색 없이 바로 생성 단계

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

    } catch (error) {
      console.error("Error regenerating message:", error);
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

  // 데이터 분석 파일 업로드 핸들러
  const handleDataFileUpload = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/chat/upload-data`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "업로드 실패" }));
        throw new Error(errorData.detail || `업로드 실패: ${response.status}`);
      }

      const data = await response.json();

      setDataSessionInfo({
        sessionId: data.session_id,
        filename: data.filename,
        fileSize: data.file_size,
        sheets: data.sheets.map((s: any) => ({
          name: s.name,
          rows: s.rows,
          columns: s.columns,
          columnNames: s.column_names,
          columnTypes: s.column_types,
          columnDetails: s.column_details?.map((c: any) => ({
            name: c.name,
            dtype: c.dtype,
            nullRatio: c.null_ratio,
            sampleValues: c.sample_values || [],
          })),
        })),
      });

    } catch (error) {
      console.error("Data file upload error:", error);
    }
  }, []);

  // 데이터 세션 삭제 핸들러
  const handleClearDataSession = useCallback(async () => {
    if (dataSessionInfo) {
      try {
        await fetch(`${API_BASE_URL}/api/chat/data-sessions/${dataSessionInfo.sessionId}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch (e) {
        // 삭제 실패해도 UI에서는 제거
      }
      setDataSessionInfo(null);
    }
  }, [dataSessionInfo]);

  // 통합 파일 업로드 핸들러 (확장자 기반 자동 라우팅)
  const handleUnifiedFileUpload = useCallback(async (files: File[]) => {
    const docFiles: File[] = [];
    const dataFiles: File[] = [];

    for (const file of files) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (DATA_EXTENSIONS.includes(ext)) {
        dataFiles.push(file);
      } else {
        docFiles.push(file);
      }
    }

    // 문서 파일 -> RAG 파이프라인
    if (docFiles.length > 0) {
      uploadDocuments(docFiles, sessionId);
    }

    // 데이터 파일 -> 데이터 분석 파이프라인
    if (dataFiles.length > 0) {
      if (dataFiles.length > 1) {
        // 데이터 분석은 한 번에 하나의 파일만 지원 - 첫 번째 파일만 업로드
      }

      // 기존 세션 정리
      if (dataSessionInfo) {
        try {
          await fetch(
            `${API_BASE_URL}/api/chat/data-sessions/${dataSessionInfo.sessionId}`,
            { method: "DELETE", credentials: "include" }
          );
        } catch (e) {
          // 삭제 실패해도 진행
        }
        setDataSessionInfo(null);
      }

      await handleDataFileUpload(dataFiles[0]);
    }
  }, [uploadDocuments, sessionId, dataSessionInfo, handleDataFileUpload]);

  // 문서 제거 핸들러
  const handleClearDocument = useCallback(async () => {
    await clearDocument();
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

    }
  }, [setSelectedCollectionBase, resetArtifact]);

  const chatContent = (
    <DocumentDropZone
      onFileDrop={handleUnifiedFileUpload}
      disabled={isLoading || isDocumentUploading}
      className="h-full"
    >
    <div className="flex flex-col h-full overflow-hidden">
      {/* 메인 콘텐츠 영역 (6:4 분할) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 채팅 영역 */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-background",
          artifactState.isOpen ? "w-[60%]" : "w-full"
        )}>
          {messages.length === 0 && !isLoading ? (
            /* 빈 상태: 입력창 가운데 정렬 */
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-[8vh]">
              <div className="w-full max-w-[56rem] space-y-3">
                <h2 className="text-2xl font-semibold text-center">
                  <span className="font-extrabold tracking-tight">
                    KCA<span className="text-primary">-</span><span className="italic text-emerald-500">i</span>
                  </span>
                  <span className="text-foreground ml-2">무엇을 도와드릴까요?</span>
                </h2>
                <div className="pt-4">
                  <InputArea
                    input={input}
                    setInput={setInput}
                    onSend={handleSend}
                    isLoading={isLoading}
                    disabled={false}
                    quotedMessage={quotedMessage && quotedMessage.role !== "system" ? { role: quotedMessage.role, content: quotedMessage.content } : null}
                    onClearQuote={handleClearQuote}
                    onClearChat={handleClearChat}
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
                    isDocumentUploading={isDocumentUploading}
                    isDocumentReady={isDocumentReady}
                    onFileSelect={handleUnifiedFileUpload}
                    uploadedFilenames={uploadedFilenames}
                    documentPageCount={documentUploadStatus?.pageCount}
                    documentProgress={documentUploadStatus?.progress}
                    documentStage={documentUploadStatus?.stage}
                    documentError={documentUploadStatus?.error}
                    documentFilename={documentUploadStatus?.filename}
                    onClearDocument={handleClearDocument}
                    dataSessionInfo={dataSessionInfo}
                    onClearDataSession={handleClearDataSession}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* 메시지 있을 때: 일반 레이아웃 */
            <>
              <div className="flex-1 overflow-hidden">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  isStreaming={true}
                  onRegenerate={handleRegenerate}
                  onQuote={handleQuote}
                  collectionName={selectedCollection}
                  onOpenArtifact={openArtifact}
                  currentStage={currentStage}
                  documentUploadStatus={documentUploadStatus}
                  isDocumentReady={isDocumentReady}
                  uploadedFilenames={uploadedFilenames}
                  onClearDocument={handleClearDocument}
                  sessionId={sessionId}
                  reasoningLevel={settings.reasoningLevel}
                />
              </div>
              <div>
                <InputArea
                  input={input}
                  setInput={setInput}
                  onSend={handleSend}
                  isLoading={isLoading}
                  disabled={false}
                  quotedMessage={quotedMessage && quotedMessage.role !== "system" ? { role: quotedMessage.role, content: quotedMessage.content } : null}
                  onClearQuote={handleClearQuote}
                  onClearChat={handleClearChat}
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
                  isDocumentUploading={isDocumentUploading}
                  isDocumentReady={isDocumentReady}
                  onFileSelect={handleUnifiedFileUpload}
                  uploadedFilenames={uploadedFilenames}
                  documentPageCount={documentUploadStatus?.pageCount}
                  documentProgress={documentUploadStatus?.progress}
                  documentStage={documentUploadStatus?.stage}
                  documentError={documentUploadStatus?.error}
                  documentFilename={documentUploadStatus?.filename}
                  onClearDocument={handleClearDocument}
                  dataSessionInfo={dataSessionInfo}
                  onClearDataSession={handleClearDataSession}
                />
              </div>
            </>
          )}
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