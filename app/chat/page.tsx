"use client";

import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { ChatContainer } from "./components/ChatContainer";

export default function ChatPage() {
  return (
    <PageContainer maxWidth="wide" className="py-6 h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex items-center justify-center h-full">로딩 중...</div>}>
          <ChatContainer />
        </Suspense>
      </div>
    </PageContainer>
  );
}