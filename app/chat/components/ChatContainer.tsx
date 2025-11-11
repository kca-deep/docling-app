"use client";

import { useState, useEffect, useRef } from "react";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { SourcePanel } from "./SourcePanel";
import { SettingsPanel } from "./SettingsPanel";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, FileText, ChevronRight } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  sources?: Source[];
  metadata?: {
    tokens?: number;
    processingTime?: number;
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
  reasoningLevel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  streamMode: boolean;
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "안녕하세요! 업로드된 문서에 대해 질문해주세요. 문서 내용을 기반으로 정확한 답변을 제공해드리겠습니다.",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [sessionId] = useState(() => `session_${Date.now()}`);

  // 모바일 감지
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // AI 설정
  const [settings, setSettings] = useState<ChatSettings>({
    reasoningLevel: "medium",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
    topK: 50,
    frequencyPenalty: 0,
    presencePenalty: 0,
    streamMode: true,
  });

  // 컬렉션 목록 로드
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/chat/collections");
        if (response.ok) {
          const data = await response.json();
          setCollections(data.collections || []);
          if (data.collections && data.collections.length > 0) {
            setSelectedCollection(data.collections[0].name);
            toast.success(`${data.collections.length}개의 컬렉션을 불러왔습니다`);
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
  const handleNonStreamingSend = async (userMessage: Message) => {
    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
          message: userMessage.content,
          reasoning_level: settings.reasoningLevel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          top_k: settings.topK,
          stream: false,
          chat_history: messages.filter(m => m.role !== "system").slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();

      // 소스 문서 처리
      const sources: Source[] = (data.retrieved_docs || []).map((doc: any) => ({
        id: doc.id,
        title: doc.metadata?.title || `문서 ${doc.id}`,
        content: doc.text.substring(0, 300) + "...",
        score: doc.score,
        metadata: doc.metadata,
      }));

      setCurrentSources(sources);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "응답을 생성할 수 없습니다.",
        timestamp: new Date(),
        sources: sources,
        metadata: {
          tokens: data.usage?.total_tokens,
          processingTime: data.usage?.processing_time,
        },
      };

      setMessages((prev) => [...prev, aiMessage]);
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
  };

  // 메시지 전송 (스트리밍)
  const handleStreamingSend = async (userMessage: Message) => {
    try {
      const response = await fetch("http://localhost:8000/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
          message: userMessage.content,
          reasoning_level: settings.reasoningLevel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: settings.topP,
          frequency_penalty: settings.frequencyPenalty,
          presence_penalty: settings.presencePenalty,
          top_k: settings.topK,
          stream: true,
          chat_history: messages.filter(m => m.role !== "system").slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("스트리밍을 지원하지 않습니다");
      }

      const aiMessageId = (Date.now() + 1).toString();
      let aiContent = "";
      let sources: Source[] = [];

      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

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
                sources = parsed.sources.map((doc: any) => ({
                  id: doc.id,
                  title: doc.metadata?.title || `문서 ${doc.id}`,
                  content: doc.text.substring(0, 300) + "...",
                  score: doc.score,
                  metadata: doc.metadata,
                }));
                setCurrentSources(sources);
              }

              // 컨텐츠 추출
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                aiContent += delta.content;

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, content: aiContent, sources }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.debug("Failed to parse chunk:", data);
            }
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error streaming message:", error);
      toast.error("스트리밍 중 오류가 발생했습니다");
      setIsLoading(false);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "죄송합니다. 스트리밍 중 오류가 발생했습니다.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSend = async () => {
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

    if (settings.streamMode) {
      await handleStreamingSend(userMessage);
    } else {
      await handleNonStreamingSend(userMessage);
    }
  };

  const handleClearChat = () => {
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
  };

  // 모바일 레이아웃
  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* 모바일 헤더 */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">AI 채팅</h2>
          <Sheet open={rightPanelOpen} onOpenChange={setRightPanelOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] p-0">
              <Tabs defaultValue="settings" className="h-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="settings">설정</TabsTrigger>
                  <TabsTrigger value="sources">참조 문서</TabsTrigger>
                </TabsList>
                <TabsContent value="settings" className="h-[calc(100%-45px)] overflow-y-auto">
                  <SettingsPanel
                    collections={collections}
                    selectedCollection={selectedCollection}
                    onCollectionChange={setSelectedCollection}
                    settings={settings}
                    onSettingsChange={setSettings}
                  />
                </TabsContent>
                <TabsContent value="sources" className="h-[calc(100%-45px)] overflow-y-auto">
                  <SourcePanel sources={currentSources} />
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onSourceClick={(sources) => {
              setCurrentSources(sources);
              setRightPanelOpen(true);
            }}
          />
        </div>

        {/* 입력 영역 */}
        <InputArea
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          disabled={!selectedCollection}
          onClear={handleClearChat}
        />
      </div>
    );
  }

  // 데스크탑 레이아웃
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={70} minSize={50}>
        <Card className="h-full flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              onSourceClick={setCurrentSources}
            />
          </div>
          <InputArea
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            disabled={!selectedCollection}
            onClear={handleClearChat}
          />
        </Card>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={30} minSize={20}>
        <Tabs defaultValue="settings" className="h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">설정</TabsTrigger>
            <TabsTrigger value="sources">참조 문서</TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="h-[calc(100%-45px)] overflow-y-auto">
            <SettingsPanel
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionChange={setSelectedCollection}
              settings={settings}
              onSettingsChange={setSettings}
            />
          </TabsContent>
          <TabsContent value="sources" className="h-[calc(100%-45px)] overflow-y-auto">
            <SourcePanel sources={currentSources} />
          </TabsContent>
        </Tabs>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}