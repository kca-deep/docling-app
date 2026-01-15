"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type {
  FeedbackRating,
  FeedbackCategory,
  FeedbackCreateRequest,
} from "../types";

interface FeedbackButtonProps {
  messageId: string;
  sessionId: string;
  collectionName: string;
  userQuery: string;
  assistantResponse?: string;
  llmModel?: string;
  reasoningLevel?: string;
  retrievedDocsCount?: number;
  disabled?: boolean;
  initialRating?: FeedbackRating | null;
}

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "inaccurate", label: "부정확" },
  { value: "incomplete", label: "불완전" },
  { value: "irrelevant", label: "관련없음" },
  { value: "outdated", label: "구버전" },
  { value: "other", label: "기타" },
];

export function FeedbackButton({
  messageId,
  sessionId,
  collectionName,
  userQuery,
  assistantResponse,
  llmModel,
  reasoningLevel,
  retrievedDocsCount,
  disabled = false,
  initialRating = null,
}: FeedbackButtonProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(initialRating);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | "">("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = async (
    feedbackRating: FeedbackRating,
    category?: FeedbackCategory,
    feedbackComment?: string
  ) => {
    setIsSubmitting(true);

    try {
      const requestBody: FeedbackCreateRequest = {
        message_id: messageId,
        session_id: sessionId,
        collection_name: collectionName,
        rating: feedbackRating,
        category: category,
        comment: feedbackComment,
        user_query: userQuery,
        assistant_response: assistantResponse?.slice(0, 500),
        llm_model: llmModel,
        reasoning_level: reasoningLevel,
        retrieved_docs_count: retrievedDocsCount,
      };

      const response = await fetch("http://localhost:8000/api/feedback/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("피드백 제출 실패");
      }

      setRating(feedbackRating);
      toast.success("피드백이 제출되었습니다");
    } catch (error) {
      console.error("피드백 제출 오류:", error);
      toast.error("피드백 제출에 실패했습니다");
    } finally {
      setIsSubmitting(false);
      setIsPopoverOpen(false);
      setSelectedCategory("");
      setComment("");
    }
  };

  const handlePositiveFeedback = async () => {
    if (rating === "positive") return;
    await submitFeedback("positive");
  };

  const handleNegativeFeedback = () => {
    if (rating === "negative") return;
    setIsPopoverOpen(true);
  };

  const handleNegativeSubmit = async () => {
    await submitFeedback(
      "negative",
      selectedCategory as FeedbackCategory || undefined,
      comment || undefined
    );
  };

  // 이미 피드백을 제출한 경우
  if (rating) {
    return (
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${
                rating === "positive"
                  ? "text-green-500 bg-green-500/10"
                  : "text-muted-foreground/50"
              }`}
              disabled
            >
              {rating === "positive" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {rating === "positive" ? "도움이 됨" : "도움됨"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${
                rating === "negative"
                  ? "text-red-500 bg-red-500/10"
                  : "text-muted-foreground/50"
              }`}
              disabled
            >
              {rating === "negative" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ThumbsDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {rating === "negative" ? "개선 필요" : "개선필요"}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* 긍정 피드백 버튼 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
            onClick={handlePositiveFeedback}
            disabled={disabled || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">도움됨</TooltipContent>
      </Tooltip>

      {/* 부정 피드백 버튼 + Popover */}
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                onClick={handleNegativeFeedback}
                disabled={disabled || isSubmitting}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">개선필요</TooltipContent>
        </Tooltip>

        <PopoverContent className="w-80" align="end" side="top">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">어떤 점이 아쉬웠나요?</h4>
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex flex-wrap gap-1"
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value as FeedbackCategory)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="text-xs px-2 py-1 h-7"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                추가 의견 (선택)
              </label>
              <Textarea
                placeholder="구체적인 의견을 남겨주세요..."
                className="h-20 text-sm resize-none"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsPopoverOpen(false);
                  setSelectedCategory("");
                  setComment("");
                }}
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleNegativeSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  "제출"
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
