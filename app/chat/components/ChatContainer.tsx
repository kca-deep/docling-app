"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { SourceArtifactPanel } from "./SourceArtifactPanel";
import { Card } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, Bot, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string; // 메시지를 생성한 모델 정보
  sources?: Source[];
  metadata?: {
    tokens?: number;
    processingTime?: number;
    aborted?: boolean; // 중단 여부
  };
  regenerationContext?: {
    originalQuery: string;
    collectionName: string;
    settings: ChatSettings;
    retrievedDocs: RetrievedDocument[];
  };
}

interface Source {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata?: {
    page?: number;
    file?: string;
    url?: string;
    section?: string;
    chunk_index?: number;
    document_id?: number;
    num_tokens?: number;
  };
}

interface RetrievedDocument {
  id: string;
  text: string;
  score: number;
  metadata?: {
    filename?: string;
    document_id?: number;
    chunk_index?: number;
    num_tokens?: number;
    headings?: string[];
    page?: number;
    url?: string;
  };
}

interface Collection {
  name: string;
  vectors_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
}

interface ChatSettings {
  model: string;
  reasoningLevel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  streamMode: boolean;
  useReranking: boolean;
}

interface ArtifactState {
  isOpen: boolean;
  sources: Source[];
  activeSourceId: string | null;
  messageId: string | null;
}

export function ChatContainer() {
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // 참조문서 아티팩트 패널 상태
  const [artifactState, setArtifactState] = useState<ArtifactState>({
    isOpen: false,
    sources: [],
    activeSourceId: null,
    messageId: null,
  });

  // 우측 패널 상태
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // 전체화면 상태 - URL 파라미터에서 초기값 읽기
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return searchParams?.get('fullscreen') === 'true';
  });

  // AI 설정 (기본값은 fallback용)
  const [settings, setSettings] = useState<ChatSettings>({
    model: "gpt-oss-20b",
    reasoningLevel: "medium",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
    topK: 5,
    frequencyPenalty: 0,
    presencePenalty: 0,
    streamMode: true,
    useReranking: true,
  });

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [defaultReasoningLevel, setDefaultReasoningLevel] = useState<string>("medium"); // 백엔드에서 로드한 기본값
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false); // 심층사고 토글 상태

  // Body 스크롤 제어 및 전체화면 클래스 추가
  useEffect(() => {
    if (isFullscreen) {
      console.log('[Fullscreen] Activating fullscreen mode');
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
            console.log(`[Fullscreen] Set z-index for`, selector, htmlEl);
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
        console.log('[Fullscreen] Deactivating fullscreen mode');
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
          setArtifactState(prev => ({ ...prev, isOpen: false }));
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
  }, [isFullscreen, artifactState.isOpen]);

  // 백엔드에서 기본 설정 로드
  useEffect(() => {
    const loadDefaultSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/default-settings`);
        if (response.ok) {
          const data = await response.json();
          setDefaultReasoningLevel(data.reasoning_level); // 기본값 저장
          setSettings(prev => ({
            ...prev,
            model: data.model,
            reasoningLevel: data.reasoning_level,
            temperature: data.temperature,
            maxTokens: data.max_tokens,
            topP: data.top_p,
            topK: data.top_k,
            useReranking: data.use_reranking,
          }));
          setSettingsLoaded(true);
          console.log('[Settings] Loaded from backend (.env):', data);
          toast.success(`설정 로드 완료 (max_tokens: ${data.max_tokens})`);
        } else {
          console.error('[Settings] Failed to load, using fallback defaults');
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error('[Settings] Error loading settings:', error);
        toast.error('설정 로드 실패 - 기본값 사용');
        setSettingsLoaded(true); // fallback 값 사용
      }
    };

    loadDefaultSettings();
  }, []);

  // 심층사고 토글 변경 시 reasoningLevel 업데이트
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      reasoningLevel: deepThinkingEnabled ? "medium" : defaultReasoningLevel,
    }));
  }, [deepThinkingEnabled, defaultReasoningLevel]);

  // 컬렉션 목록 로드
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/collections`);
        if (response.ok) {
          const data = await response.json();
          // 컬렉션명으로 오름차순 정렬
          const sortedCollections = [...(data.collections || [])].sort((a, b) =>
            a.name.localeCompare(b.name, 'ko-KR')
          );
          setCollections(sortedCollections);
          if (sortedCollections.length > 0) {
            setSelectedCollection(sortedCollections[0].name);
            toast.success(`${sortedCollections.length}개의 컬렉션을 불러왔습니다`);
          }
        }
      } catch (error) {
        console.error("Failed to fetch collections:", error);
        toast.error("컬렉션 목록을 불러오는데 실패했습니다");
      }
    };

    fetchCollections();
  }, []);

  // 메시지 전송 (비스트리밍)
  const handleNonStreamingSend = useCallback(async (userMessage: Message, quotedMsg: Message | null = null) => {
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

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
          message: userMessage.content,
          model: settings.model,
          reasoning_level: settings.reasoningLevel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          top_k: settings.topK,
          stream: false,
          use_reranking: settings.useReranking,
          chat_history: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();

      // 소스 문서 처리
      const sources: Source[] = (data.retrieved_docs || []).map((doc: RetrievedDocument) => ({
        id: doc.id,
        title: doc.metadata?.headings?.length ? doc.metadata.headings.join(' > ') : (doc.metadata?.filename || `문서 ${doc.id}`),
        content: doc.text,
        score: doc.score,
        metadata: {
          file: doc.metadata?.filename,
          section: doc.metadata?.headings ? doc.metadata.headings.join(' > ') : undefined,
          chunk_index: doc.metadata?.chunk_index,
          document_id: doc.metadata?.document_id,
          num_tokens: doc.metadata?.num_tokens,
          page: doc.metadata?.page,
          url: doc.metadata?.url,
        },
      }));

      setCurrentSources(sources);

      const aiMessageId = (Date.now() + 1).toString();

      const aiMessage: Message = {
        id: aiMessageId,
        role: "assistant",
        content: data.answer || "응답을 생성할 수 없습니다.",
        timestamp: new Date(),
        model: settings.model, // 현재 사용 중인 모델 정보 저장
        sources: sources,
        metadata: {
          tokens: data.usage?.total_tokens,
          processingTime: data.usage?.processing_time,
        },
        regenerationContext: {
          originalQuery: userMessage.content,
          collectionName: selectedCollection,
          settings: { ...settings },
          retrievedDocs: data.retrieved_docs || [],
        },
      };

      setMessages((prev) => [...prev, aiMessage]);

      // 참조문서 패널이 열려있고 새 sources가 있으면 자동 업데이트
      if (artifactState.isOpen && sources.length > 0) {
        setArtifactState({
          isOpen: true,
          sources,
          activeSourceId: sources[0].id,
          messageId: aiMessageId,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("메시지 전송에 실패했습니다");

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, selectedCollection, settings, artifactState.isOpen]);

  // 메시지 전송 (스트리밍)
  const handleStreamingSend = useCallback(async (userMessage: Message, quotedMsg: Message | null = null) => {
    // AbortController 생성
    const controller = new AbortController();
    setAbortController(controller);

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

      console.log('='.repeat(80));
      console.log('[FRONTEND] Making API call to streaming endpoint');
      console.log(`[FRONTEND] API_BASE_URL: ${API_BASE_URL}`);
      console.log(`[FRONTEND] Full URL: ${API_BASE_URL}/api/chat/stream`);
      console.log(`[FRONTEND] Model: ${settings.model}`);
      console.log(`[FRONTEND] Collection: ${selectedCollection}`);
      console.log('='.repeat(80));

      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
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
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("스트리밍을 지원하지 않습니다");
      }

      let aiContent = "";
      let sources: Source[] = [];
      let retrievedDocs: RetrievedDocument[] = [];
      let messageCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // 소스 문서 처리
              if (parsed.sources) {
                retrievedDocs = parsed.sources; // 원본 데이터 저장
                sources = parsed.sources.map((doc: RetrievedDocument) => ({
                  id: doc.id,
                  title: doc.metadata?.headings?.length ? doc.metadata.headings.join(' > ') : (doc.metadata?.filename || `문서 ${doc.id}`),
                  content: doc.text,
                  score: doc.score,
                  metadata: {
                    file: doc.metadata?.filename,
                    section: doc.metadata?.headings ? doc.metadata.headings.join(' > ') : undefined,
                    chunk_index: doc.metadata?.chunk_index,
                    document_id: doc.metadata?.document_id,
                    num_tokens: doc.metadata?.num_tokens,
                    page: doc.metadata?.page,
                    url: doc.metadata?.url,
                  },
                }));
                setCurrentSources(sources);
              }

              // 컨텐츠 추출
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                aiContent += delta.content;

                // 첫 컨텐츠가 도착했을 때만 메시지 생성
                if (!messageCreated) {
                  messageCreated = true;
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: aiMessageId,
                      role: "assistant",
                      content: aiContent,
                      timestamp: new Date(),
                      model: settings.model, // 현재 사용 중인 모델 정보 저장
                      sources,
                    },
                  ]);
                } else {
                  // 이후에는 업데이트
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, content: aiContent, sources }
                        : msg
                    )
                  );
                }
              }
            } catch (e) {
              console.debug("Failed to parse chunk:", data);
            }
          }
        }
      }

      // 스트리밍 완료 후 regenerationContext 추가
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
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
        setArtifactState({
          isOpen: true,
          sources,
          activeSourceId: sources[0].id,
          messageId: aiMessageId,
        });
      }

      setIsLoading(false);
      setAbortController(null); // 스트리밍 완료 후 AbortController 정리
    } catch (error) {
      // AbortError는 사용자가 의도적으로 중단한 것이므로 에러로 처리하지 않음
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[FRONTEND] Streaming aborted by user');
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
        toast.error("스트리밍 중 오류가 발생했습니다");

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "죄송합니다. 스트리밍 중 오류가 발생했습니다.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }

      setIsLoading(false);
      setAbortController(null); // 에러 발생 시에도 AbortController 정리
    }
  }, [messages, selectedCollection, settings, artifactState.isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedCollection) {
      toast.error("컬렉션을 선택하고 메시지를 입력해주세요");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // 인용 메시지 처리
    const currentQuoted = quotedMessage;
    setQuotedMessage(null); // 전송 후 인용 초기화

    if (settings.streamMode) {
      await handleStreamingSend(userMessage, currentQuoted);
    } else {
      await handleNonStreamingSend(userMessage, currentQuoted);
    }
  }, [input, selectedCollection, quotedMessage, settings.streamMode, handleStreamingSend, handleNonStreamingSend]);

  const handleClearChat = useCallback(() => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: "대화가 초기화되었습니다. 무엇을 도와드릴까요?",
        timestamp: new Date(),
      },
    ]);
    setCurrentSources([]);
    toast.success("대화가 초기화되었습니다");
  }, []);

  // 재생성 핸들러
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
      toast.info("답변을 다시 생성하고 있습니다");

      // 현재 고급설정의 temperature 사용 (다양성을 위해 약간 증가)
      const regenerateTemp = Math.min(settings.temperature + 0.2, 2.0);

      // 백엔드 /api/chat/regenerate 호출 (현재 고급설정 값 사용)
      const response = await fetch(`${API_BASE_URL}/api/chat/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: context.originalQuery,
          collection_name: context.collectionName,
          retrieved_docs: context.retrievedDocs,
          model: settings.model, // 현재 선택된 모델 사용
          reasoning_level: settings.reasoningLevel, // 현재 추론 수준 사용
          temperature: regenerateTemp,
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
        console.error('[Regenerate] API Error:', {
          status: response.status,
          detail: errorData.detail,
          model: settings.model,
          collection: context.collectionName
        });
        throw new Error(`API 오류 (${response.status}): ${errorData.detail || '알 수 없는 오류'}`);
      }

      const data = await response.json();

      // 소스 문서 처리
      const sources: Source[] = (data.retrieved_docs || context.retrievedDocs).map((doc: RetrievedDocument) => ({
        id: doc.id,
        title: doc.metadata?.headings?.length ? doc.metadata.headings.join(' > ') : (doc.metadata?.filename || `문서 ${doc.id}`),
        content: doc.text,
        score: doc.score,
        metadata: {
          file: doc.metadata?.filename,
          section: doc.metadata?.headings ? doc.metadata.headings.join(' > ') : undefined,
          chunk_index: doc.metadata?.chunk_index,
          document_id: doc.metadata?.document_id,
          num_tokens: doc.metadata?.num_tokens,
          page: doc.metadata?.page,
          url: doc.metadata?.url,
        },
      }));

      // 새 AI 메시지 생성
      const newAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "응답을 생성할 수 없습니다.",
        timestamp: new Date(),
        model: settings.model, // 현재 선택된 모델 정보 사용
        sources: sources,
        metadata: {
          tokens: data.usage?.total_tokens,
          processingTime: data.usage?.processing_time,
        },
        regenerationContext: {
          originalQuery: context.originalQuery,
          collectionName: context.collectionName,
          settings: { ...settings }, // 현재 설정으로 업데이트
          retrievedDocs: context.retrievedDocs,
        },
      };

      setMessages((prev) => [...prev, newAiMessage]);
      toast.success("답변이 재생성되었습니다");
    } catch (error) {
      console.error("Error regenerating message:", error);
      toast.error("재생성에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [messages, settings]); // settings 의존성 추가

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

  // 아티팩트 패널 열기
  const handleOpenArtifact = useCallback((sources: Source[], messageId: string) => {
    if (sources.length === 0) return;
    setArtifactState({
      isOpen: true,
      sources,
      activeSourceId: sources[0].id,
      messageId,
    });
  }, []);

  // 아티팩트 패널 닫기
  const handleCloseArtifact = useCallback(() => {
    setArtifactState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 아티팩트 소스 선택
  const handleSelectArtifactSource = useCallback((sourceId: string) => {
    setArtifactState(prev => ({ ...prev, activeSourceId: sourceId }));
  }, []);

  // 스트리밍 중단 핸들러
  const handleStopStreaming = useCallback(() => {
    if (abortController) {
      console.log('[FRONTEND] User requested to stop streaming');
      abortController.abort();
      setAbortController(null);
    }
  }, [abortController]);

  // 컬렉션 변경 핸들러
  const handleCollectionChange = useCallback((newCollection: string) => {
    // 컬렉션이 실제로 변경된 경우에만 초기화
    if (newCollection !== selectedCollection) {
      // 대화 초기화
      setMessages([]);

      // 검색 결과 초기화
      setCurrentSources([]);

      // 인용 메시지 초기화
      setQuotedMessage(null);

      // 컬렉션 변경
      setSelectedCollection(newCollection);

      // 사용자에게 알림
      toast.info(`"${newCollection}" 컬렉션으로 변경되었습니다. 대화가 초기화되었습니다.`);
    }
  }, [selectedCollection]);

  const chatContent = (
    <div
      className={
        isFullscreen
          ? "fullscreen-chat-mode fixed inset-0 z-[60] bg-background flex flex-col overflow-hidden"
          : "flex flex-col h-full overflow-hidden"
      }
    >
      {/* 상단 헤더 - Claude 스타일 미니멀 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0",
        isFullscreen ? "bg-background/90 backdrop-blur-xl" : "bg-background/95 backdrop-blur"
      )}>
        {/* 왼쪽: 로고 */}
        <div className="flex items-center gap-3">
          {/* Icon Container with Gradient */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-lg blur-sm opacity-75"
              style={{ background: "linear-gradient(135deg, var(--chart-3), var(--chart-1))" }}
            />
            <div
              className="relative p-2 rounded-lg shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--chart-3), var(--chart-1))" }}
            >
              <Bot className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* Text Container */}
          <div className="hidden sm:flex flex-col">
            <span
              className="font-bold text-lg leading-none tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--chart-3), var(--chart-1))" }}
            >
              KCA-i
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-bold text-xs text-foreground leading-none">RAG</span>
              <span
                className="text-[0.65rem] font-medium leading-tight bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, var(--chart-3), var(--chart-1))" }}
              >
                기반 챗봇
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 컨트롤 버튼들 */}
        <div className="flex items-center gap-1.5">
          {/* 전체화면 토글 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {mounted && theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{mounted && theme === "dark" ? "라이트 모드" : "다크 모드"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    console.log('[Fullscreen Button] Clicked, current state:', isFullscreen);
                    setIsFullscreen(!isFullscreen);
                  }}
                  title={isFullscreen ? "전체화면 종료 (ESC)" : "전체화면"}
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{isFullscreen ? "전체화면 종료 (ESC)" : "전체화면"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 (6:4 분할) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 채팅 영역 */}
        <div className={cn(
          "flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
          artifactState.isOpen ? "w-[60%] border-r" : "w-full"
        )}>
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-hidden">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              isStreaming={settings.streamMode}
              onRegenerate={handleRegenerate}
              onQuote={handleQuote}
              collectionName={selectedCollection}
              onPromptSelect={handlePromptSelect}
              onOpenArtifact={handleOpenArtifact}
            />
          </div>

          {/* 입력 영역 */}
          <InputArea
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            disabled={!selectedCollection}
            quotedMessage={quotedMessage && quotedMessage.role !== "system" ? { role: quotedMessage.role, content: quotedMessage.content } : null}
            onClearQuote={handleClearQuote}
            selectedModel={settings.model}
            onModelChange={(model) => setSettings({ ...settings, model })}
            onClearChat={handleClearChat}
            isFullscreen={isFullscreen}
            selectedCollection={selectedCollection}
            onCollectionChange={handleCollectionChange}
            collections={collections}
            settings={settings}
            onSettingsChange={setSettings}
            settingsPanelOpen={rightPanelOpen}
            onSettingsPanelChange={setRightPanelOpen}
            isStreaming={isLoading && settings.streamMode}
            onStopStreaming={handleStopStreaming}
            deepThinkingEnabled={deepThinkingEnabled}
            onDeepThinkingChange={setDeepThinkingEnabled}
          />
        </div>

        {/* 우측: 참조문서 아티팩트 패널 */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          artifactState.isOpen ? "w-[40%] opacity-100" : "w-0 opacity-0"
        )}>
          {artifactState.isOpen && (
            <SourceArtifactPanel
              sources={artifactState.sources}
              activeSourceId={artifactState.activeSourceId}
              onSourceSelect={handleSelectArtifactSource}
              onClose={handleCloseArtifact}
            />
          )}
        </div>
      </div>
    </div>
  );

  return chatContent;
}