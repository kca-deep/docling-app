"use client"

import { useState } from "react"
import { Send, Bot, User, Sparkles, FileText, Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  sources?: Array<{
    title: string
    page?: number
  }>
}

export function ChatPreview() {
  const [messages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '안녕하세요! KCA-RAG 챗봇입니다. 업로드된 문서를 기반으로 질문에 답변해드립니다. 무엇을 도와드릴까요?',
      timestamp: new Date()
    },
    {
      id: '2',
      role: 'user',
      content: '회사 휴가 정책에 대해 알려주세요',
      timestamp: new Date()
    },
    {
      id: '3',
      role: 'assistant',
      content: '업로드된 인사규정 문서를 기반으로 답변드리겠습니다.\n\n**연차 휴가 정책:**\n• 신입사원: 11일\n• 1년 이상: 15일 + 근속연수당 1일 추가\n• 최대 25일까지 부여\n\n**특별 휴가:**\n• 경조사 휴가: 3-5일\n• 병가: 연간 30일 이내\n• 출산휴가: 90일',
      timestamp: new Date(),
      sources: [
        { title: '인사규정.pdf', page: 23 },
        { title: '복리후생가이드.docx', page: 5 }
      ]
    }
  ])

  return (
    <div className="relative">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-3xl" />

      <Card className="relative border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-background to-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">RAG 챗봇 미리보기</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  문서 기반 지능형 질의응답
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                <Sparkles className="w-3 h-3 mr-1" />
                실시간
              </Badge>
              <Badge variant="outline">
                <Database className="w-3 h-3 mr-1" />
                Qdrant
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* 채팅 메시지 영역 */}
          <ScrollArea className="h-[400px] p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 animate-fade-up",
                    `animate-delay-${index * 100}`,
                    message.role === 'user' && "justify-end"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="p-2 rounded-full bg-primary/10 h-fit">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[80%]",
                    message.role === 'user' && "order-2"
                  )}>
                    <div className={cn(
                      "rounded-2xl px-4 py-3",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.sources && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.sources.map((source, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            {source.title} {source.page && `(p.${source.page})`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="p-2 rounded-full bg-muted h-fit order-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* 입력 영역 */}
          <div className="border-t p-4 bg-muted/30">
            <div className="flex gap-2">
              <Input
                placeholder="문서에 대해 질문하세요..."
                className="flex-1"
                disabled
              />
              <Button disabled>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              실제 채팅은 /chat 페이지에서 이용 가능합니다
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}