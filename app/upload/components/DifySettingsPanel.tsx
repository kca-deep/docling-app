"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Settings, Save, RefreshCw, FileText, Sparkles } from "lucide-react"
import { DifyDataset } from "../types"

interface DifySettingsPanelProps {
  apiKey: string
  baseUrl: string
  selectedDataset: string
  datasets: DifyDataset[]
  loadingDatasets: boolean
  saveDialogOpen: boolean
  configName: string
  onApiKeyChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onSelectedDatasetChange: (value: string) => void
  onFetchDatasets: () => void
  onSaveDialogOpenChange: (open: boolean) => void
  onConfigNameChange: (value: string) => void
  onSaveConfig: () => void
}

export function DifySettingsPanel({
  apiKey,
  baseUrl,
  selectedDataset,
  datasets,
  loadingDatasets,
  saveDialogOpen,
  configName,
  onApiKeyChange,
  onBaseUrlChange,
  onSelectedDatasetChange,
  onFetchDatasets,
  onSaveDialogOpenChange,
  onConfigNameChange,
  onSaveConfig,
}: DifySettingsPanelProps) {
  // 선택된 데이터셋 정보 찾기
  const selectedDatasetInfo = datasets.find(ds => ds.id === selectedDataset)

  return (
    <div className="space-y-4">
      {/* API Key */}
      <div className="space-y-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="dify-apiKey" className="text-sm font-semibold cursor-help">
                API Key
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Dify API 키를 입력하세요</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Input
          id="dify-apiKey"
          type="password"
          placeholder="dataset-xxxxxxxxxxxxx"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="h-10"
        />
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="dify-baseUrl" className="text-sm font-semibold cursor-help">
                Base URL
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Dify API 엔드포인트 URL</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Input
          id="dify-baseUrl"
          placeholder="https://api.dify.ai/v1"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          className="h-10"
        />
      </div>

      {/* 동작 버튼 - Chat 스타일 */}
      <div className="flex items-center gap-1.5 justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onFetchDatasets}
                disabled={loadingDatasets || !apiKey}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
              >
                {loadingDatasets ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">데이터셋 목록 불러오기</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Dialog open={saveDialogOpen} onOpenChange={onSaveDialogOpenChange}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={!apiKey || !baseUrl} className="h-9 w-9">
                    <Save className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">현재 설정 저장</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Dify 설정 저장</DialogTitle>
                <DialogDescription>
                  현재 설정을 저장하여 다음에 다시 사용할 수 있습니다
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="configName">설정 이름</Label>
                  <Input
                    id="configName"
                    placeholder="예: 회사 Dify 설정"
                    value={configName}
                    onChange={(e) => onConfigNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input value={apiKey.substring(0, 20) + "..."} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input value={baseUrl} disabled />
                </div>
                {selectedDataset && (
                  <div className="space-y-2">
                    <Label>기본 데이터셋</Label>
                    <Input value={datasets.find(d => d.id === selectedDataset)?.name || ""} disabled />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => onSaveDialogOpenChange(false)}>
                  취소
                </Button>
                <Button onClick={onSaveConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  저장
                </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {datasets.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dify-dataset" className="text-sm font-semibold">데이터셋</Label>
              {selectedDatasetInfo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        {selectedDatasetInfo.document_count}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">문서 수</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select value={selectedDataset} onValueChange={onSelectedDatasetChange}>
              <SelectTrigger id="dify-dataset" className="h-10">
                <SelectValue placeholder="업로드할 데이터셋 선택" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-medium">{dataset.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {dataset.document_count}개
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  )
}
