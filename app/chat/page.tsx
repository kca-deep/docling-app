"use client";

import { PageContainer } from "@/components/page-container";
import { ChatContainer } from "./components/ChatContainer";

export default function ChatPage() {
  return (
    <PageContainer maxWidth="wide" className="py-6 h-screen flex flex-col">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-3xl font-bold mb-2">AI 챗봇</h1>
        <p className="text-sm text-muted-foreground">
          업로드된 문서 컬렉션을 기반으로 AI와 대화하세요. RAG 기술을 통해 정확하고 맥락에 맞는 답변을 제공합니다.
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatContainer />
      </div>
    </PageContainer>
  );
}