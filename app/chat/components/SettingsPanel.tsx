"use client";

import { memo } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatSettings {
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

interface SettingsPanelProps {
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
}

export const SettingsPanel = memo(function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const updateSetting = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* AI 설정 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">AI 파라미터</h3>
            </div>

            {/* 추론 수준 */}
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="reasoning-level" className="text-sm whitespace-nowrap">추론 수준</Label>
              <Select
                value={settings.reasoningLevel}
                onValueChange={(value) => updateSetting("reasoningLevel", value)}
              >
                <SelectTrigger id="reasoning-level" className="w-[140px]">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">빠른 응답</SelectItem>
                  <SelectItem value="medium">균형</SelectItem>
                  <SelectItem value="high">깊은 추론</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* 스트리밍 모드 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="stream-mode" className="text-sm">
                  스트리밍 모드
                </Label>
                <p className="text-xs text-muted-foreground">
                  실시간으로 응답 표시
                </p>
              </div>
              <Switch
                id="stream-mode"
                checked={settings.streamMode}
                onCheckedChange={(checked) =>
                  updateSetting("streamMode", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="use-reranking" className="text-sm">
                  재순위 검색 (Reranking)
                </Label>
                <p className="text-xs text-muted-foreground">
                  검색 정확도 향상
                </p>
              </div>
              <Switch
                id="use-reranking"
                checked={settings.useReranking}
                onCheckedChange={(checked) =>
                  updateSetting("useReranking", checked)
                }
              />
            </div>

            <Separator />

            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="temperature" className="text-sm cursor-help">
                        Temperature
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        응답의 창의성을 조절합니다. 높을수록 다양한 답변,
                        낮을수록 일관된 답변을 생성합니다.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-sm text-muted-foreground font-mono">
                  {settings.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={[settings.temperature]}
                onValueChange={([value]) => updateSetting("temperature", value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>정확</span>
                <span>창의적</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="max-tokens" className="text-sm cursor-help">
                        Max Tokens
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        생성할 응답의 최대 길이입니다. 토큰은 대략 한글 1자 또는
                        영어 3-4자에 해당합니다.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-sm text-muted-foreground font-mono">
                  {settings.maxTokens}
                </span>
              </div>
              <Slider
                id="max-tokens"
                min={100}
                max={4000}
                step={100}
                value={[settings.maxTokens]}
                onValueChange={([value]) => updateSetting("maxTokens", value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>짧게</span>
                <span>길게</span>
              </div>
            </div>

            {/* 고급 설정 (접기 가능) */}
            <details className="space-y-3" open>
              <summary className="cursor-pointer text-sm font-medium">
                고급 설정
              </summary>

              <div className="space-y-4 pt-3">
                {/* Top P */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="top-p" className="text-sm">
                      Top P
                    </Label>
                    <span className="text-sm text-muted-foreground font-mono">
                      {settings.topP.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    id="top-p"
                    min={0}
                    max={1}
                    step={0.01}
                    value={[settings.topP]}
                    onValueChange={([value]) => updateSetting("topP", value)}
                    className="w-full"
                  />
                </div>

                {/* Top K */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="top-k" className="text-sm">
                      검색 문서 수
                    </Label>
                    <span className="text-sm text-muted-foreground font-mono">
                      {settings.topK}
                    </span>
                  </div>
                  <Slider
                    id="top-k"
                    min={1}
                    max={20}
                    step={1}
                    value={[settings.topK]}
                    onValueChange={([value]) => updateSetting("topK", value)}
                    className="w-full"
                  />
                </div>

                {/* Frequency Penalty */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="frequency-penalty" className="text-sm">
                      Frequency Penalty
                    </Label>
                    <span className="text-sm text-muted-foreground font-mono">
                      {settings.frequencyPenalty.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    id="frequency-penalty"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={[settings.frequencyPenalty]}
                    onValueChange={([value]) =>
                      updateSetting("frequencyPenalty", value)
                    }
                    className="w-full"
                  />
                </div>

                {/* Presence Penalty */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="presence-penalty" className="text-sm">
                      Presence Penalty
                    </Label>
                    <span className="text-sm text-muted-foreground font-mono">
                      {settings.presencePenalty.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    id="presence-penalty"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={[settings.presencePenalty]}
                    onValueChange={([value]) =>
                      updateSetting("presencePenalty", value)
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});