"use client";

import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { ChatContainer } from "./components/ChatContainer";
import { Loader2 } from "lucide-react";

function ChatFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">채팅을 불러오는 중...</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <PageContainer maxWidth="wide" className="py-6 h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<ChatFallback />}>
          <ChatContainer />
        </Suspense>
      </div>
    </PageContainer>
  );
}