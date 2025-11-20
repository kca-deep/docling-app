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
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="p-3 space-y-3">
          {/* 스트리밍 모드 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label htmlFor="stream-mode" className="text-xs font-medium">
                스트리밍 모드
              </Label>
              <p className="text-[10px] text-muted-foreground leading-tight">
                실시간 응답 표시
              </p>
            </div>
            <Switch
              id="stream-mode"
              checked={settings.streamMode}
              onCheckedChange={(checked) =>
                updateSetting("streamMode", checked)
              }
              className="scale-90"
            />
          </div>

          {/* 재순위 검색 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label htmlFor="use-reranking" className="text-xs font-medium">
                재순위 검색
              </Label>
              <p className="text-[10px] text-muted-foreground leading-tight">
                검색 정확도 향상
              </p>
            </div>
            <Switch
              id="use-reranking"
              checked={settings.useReranking}
              onCheckedChange={(checked) =>
                updateSetting("useReranking", checked)
              }
              className="scale-90"
            />
          </div>

          <Separator className="my-2" />

          {/* 창의성 (Temperature) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Label htmlFor="temperature" className="text-xs font-medium">
                  창의성
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[160px]">
                      <p className="text-[10px] leading-snug">
                        높을수록 다양한 답변
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
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
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>정확</span>
              <span>창의적</span>
            </div>
          </div>

          {/* 검색 문서 수 */}
          <div className="space-y-1.5 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Label htmlFor="top-k" className="text-xs font-medium">
                  검색 문서 수
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                      <p className="text-[10px] leading-snug">
                        .env 파일에서 설정됨 (변경 불가)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
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
              disabled
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>1</span>
              <span>20</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});