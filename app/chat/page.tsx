"use client";

import { PageContainer } from "@/components/page-container";
import { ChatContainer } from "./components/ChatContainer";

export default function ChatPage() {
  return (
    <PageContainer maxWidth="wide" className="py-6 h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatContainer />
      </div>
    </PageContainer>
  );
}