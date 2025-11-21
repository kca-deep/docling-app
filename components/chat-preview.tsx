"use client"

import { useState, useEffect } from "react"
import { Send, Bot, User, Sparkles, FileText, Database, Play, Pause } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

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

interface DemoScenario {
  id: string
  userMessage: string
  assistantMessage: string
  sources?: Array<{ title: string; page?: number }>
}

const demoScenarios: DemoScenario[] = [
  {
    id: '1',
    userMessage: '회사 휴가 정책에 대해 알려주세요',
    assistantMessage: '업로드된 인사규정 문서를 기반으로 답변드리겠습니다.\n\n**연차 휴가 정책:**\n• 신입사원: 11일\n• 1년 이상: 15일 + 근속연수당 1일 추가\n• 최대 25일까지 부여\n\n**특별 휴가:**\n• 경조사 휴가: 3-5일\n• 병가: 연간 30일 이내\n• 출산휴가: 90일',
    sources: [
      { title: '인사규정.pdf', page: 23 },
      { title: '복리후생가이드.docx', page: 5 }
    ]
  },
  {
    id: '2',
    userMessage: '재택근무 제도는 어떻게 운영되나요?',
    assistantMessage: '재택근무 정책에 대해 안내드리겠습니다.\n\n**재택근무 대상:**\n• 전 직원 신청 가능\n• 주 2회까지 허용\n\n**신청 방법:**\n1. 전날까지 팀장 승인 필요\n2. 근무시스템에 사전 등록\n3. 업무시간 준수 (09:00-18:00)\n\n**장비 지원:**\n• 노트북 및 모니터 제공\n• VPN 및 보안 솔루션 설치 필수',
    sources: [
      { title: '근무제도안내.pdf', page: 12 },
      { title: 'IT정책가이드.docx', page: 8 }
    ]
  },
  {
    id: '3',
    userMessage: '복지포인트는 어떻게 사용할 수 있나요?',
    assistantMessage: '복지포인트 사용 방법을 안내드립니다.\n\n**연간 지급액:**\n• 일반직: 연 100만원\n• 관리직: 연 150만원\n\n**사용 가능 항목:**\n• 건강검진 및 의료비\n• 자기계발 (도서, 강의)\n• 여가 및 문화생활\n• 체육시설 이용\n\n**유의사항:**\n• 연도 내 소진 원칙\n• 미사용 포인트 소멸',
    sources: [
      { title: '복리후생가이드.docx', page: 15 },
      { title: '복지제도FAQ.pdf', page: 3 }
    ]
  }
]

function TypingText({ text, speed = 30, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)
      return () => clearTimeout(timeout)
    } else if (onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  return <span className="whitespace-pre-wrap">{displayedText}</span>
}

export function ChatPreview() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '안녕하세요! KCA-RAG 챗봇입니다. 업로드된 문서를 기반으로 질문에 답변해드립니다. 무엇을 도와드릴까요?',
      timestamp: new Date()
    }
  ])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentScenario, setCurrentScenario] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null)

  const startDemo = () => {
    setIsPlaying(true)
    setMessages([{
      id: '0',
      role: 'assistant',
      content: '안녕하세요! KCA-RAG 챗봇입니다. 업로드된 문서를 기반으로 질문에 답변해드립니다. 무엇을 도와드릴까요?',
      timestamp: new Date()
    }])
    setCurrentScenario(0)
    playScenario(0)
  }

  const pauseDemo = () => {
    setIsPlaying(false)
  }

  const playScenario = (index: number) => {
    if (index >= demoScenarios.length) {
      setIsPlaying(false)
      return
    }

    const scenario = demoScenarios[index]
    setIsTyping(true)

    // 사용자 메시지 추가
    setTimeout(() => {
      const userMsg: Message = {
        id: `user-${index}`,
        role: 'user',
        content: scenario.userMessage,
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, userMsg])

      // 어시스턴트 메시지 추가 (타이핑 효과 포함)
      setTimeout(() => {
        const assistantMsg: Message = {
          id: `assistant-${index}`,
          role: 'assistant',
          content: scenario.assistantMessage,
          timestamp: new Date(),
          sources: scenario.sources
        }
        setMessages((prev) => [...prev, assistantMsg])
        setIsTyping(false)

        // 다음 시나리오로 이동
        setTimeout(() => {
          if (isPlaying) {
            setCurrentScenario(index + 1)
            playScenario(index + 1)
          }
        }, 3000)
      }, 1500)
    }, 1000)
  }

  const handleQueryClick = (query: string, index: number) => {
    setSelectedQuery(query)
    const scenario = demoScenarios[index]

    const userMsg: Message = {
      id: `manual-user-${Date.now()}`,
      role: 'user',
      content: scenario.userMessage,
      timestamp: new Date()
    }
    setMessages([messages[0], userMsg])

    setTimeout(() => {
      const assistantMsg: Message = {
        id: `manual-assistant-${Date.now()}`,
        role: 'assistant',
        content: scenario.assistantMessage,
        timestamp: new Date(),
        sources: scenario.sources
      }
      setMessages((prev) => [...prev, assistantMsg])
    }, 1000)
  }

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
              <Button
                variant="outline"
                size="sm"
                onClick={isPlaying ? pauseDemo : startDemo}
                className="gap-2"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    일시정지
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    자동 데모
                  </>
                )}
              </Button>
              <Badge variant="outline" className="bg-muted text-foreground">
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
          {/* 샘플 질문 선택 */}
          <div className="p-4 border-b bg-muted/30">
            <p className="text-sm font-medium mb-2">샘플 질문 선택:</p>
            <div className="flex flex-wrap gap-2">
              {demoScenarios.map((scenario, index) => (
                <Button
                  key={scenario.id}
                  variant={selectedQuery === scenario.userMessage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQueryClick(scenario.userMessage, index)}
                  disabled={isPlaying}
                  className="text-xs"
                >
                  {scenario.userMessage}
                </Button>
              ))}
            </div>
          </div>

          {/* 채팅 메시지 영역 */}
          <ScrollArea className="h-[400px] p-4">
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-3",
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
                        <p className="text-sm">
                          {message.role === 'assistant' && index > 0 ? (
                            <TypingText
                              text={message.content}
                              speed={20}
                            />
                          ) : (
                            message.content
                          )}
                        </p>
                      </div>
                      {message.sources && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="flex flex-wrap gap-1 mt-2"
                        >
                          {message.sources.map((source, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              {source.title} {source.page && `(p.${source.page})`}
                            </Badge>
                          ))}
                        </motion.div>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="p-2 rounded-full bg-muted h-fit order-1">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="p-2 rounded-full bg-primary/10 h-fit">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                        className="w-2 h-2 bg-primary rounded-full"
                      />
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                        className="w-2 h-2 bg-primary rounded-full"
                      />
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                        className="w-2 h-2 bg-primary rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
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
