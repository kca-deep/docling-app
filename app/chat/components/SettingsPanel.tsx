"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Settings,
  Sparkles,
  Zap,
  Brain,
  Gauge,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface SettingsPanelProps {
  collections: Collection[];
  selectedCollection: string;
  onCollectionChange: (value: string) => void;
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
}

export function SettingsPanel({
  collections,
  selectedCollection,
  onCollectionChange,
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
          {/* 컬렉션 선택 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">문서 컬렉션</CardTitle>
              </div>
              <CardDescription className="text-xs">
                대화할 문서 컬렉션을 선택하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedCollection}
                onValueChange={onCollectionChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="컬렉션을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {collections.length === 0 ? (
                    <div className="p-4 text-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        사용 가능한 컬렉션이 없습니다
                      </p>
                    </div>
                  ) : (
                    collections.map((collection) => (
                      <SelectItem key={collection.name} value={collection.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{collection.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {collection.points_count.toLocaleString()} 문서
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* 선택된 컬렉션 정보 */}
              {selectedCollection && collections.length > 0 && (
                <div className="mt-3 p-2 bg-muted rounded-md">
                  {(() => {
                    const col = collections.find(
                      (c) => c.name === selectedCollection
                    );
                    if (!col) return null;

                    return (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">문서 수:</span>
                          <span className="font-mono">
                            {col.points_count.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">벡터 차원:</span>
                          <span className="font-mono">{col.vector_size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">거리 메트릭:</span>
                          <span className="font-mono">{col.distance}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* AI 설정 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">AI 파라미터</h3>
            </div>

            {/* 추론 수준 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">추론 수준</Label>
              </div>
              <RadioGroup
                value={settings.reasoningLevel}
                onValueChange={(value) => updateSetting("reasoningLevel", value)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="low" />
                  <Label
                    htmlFor="low"
                    className="font-normal cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      <div>
                        <div>빠른 응답</div>
                        <div className="text-muted-foreground">
                          간단한 답변, 빠른 처리
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="medium" />
                  <Label
                    htmlFor="medium"
                    className="font-normal cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3 w-3" />
                      <div>
                        <div>균형</div>
                        <div className="text-muted-foreground">
                          적절한 깊이의 답변
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="high" />
                  <Label
                    htmlFor="high"
                    className="font-normal cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Brain className="h-3 w-3" />
                      <div>
                        <div>깊은 추론</div>
                        <div className="text-muted-foreground">
                          상세하고 정확한 답변
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
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
            <details className="space-y-3">
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
                    max={100}
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
}