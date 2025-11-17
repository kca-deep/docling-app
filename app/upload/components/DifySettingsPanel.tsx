"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Loader2, Settings, Save, RefreshCw } from "lucide-react"
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
  return (
    <div className="space-y-3">
        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="dify-apiKey">API Key</Label>
          <Input
            id="dify-apiKey"
            type="password"
            placeholder="dataset-xxxxxxxxxxxxx"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="dify-baseUrl">Base URL</Label>
          <Input
            id="dify-baseUrl"
            placeholder="https://api.dify.ai/v1"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
          />
        </div>

        {/* 동작 버튼 */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onFetchDatasets}
            disabled={loadingDatasets || !apiKey}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {loadingDatasets ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            불러오기
          </Button>
          <Dialog open={saveDialogOpen} onOpenChange={onSaveDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!apiKey || !baseUrl} className="flex-1">
                <Save className="h-4 w-4 mr-1" />
                저장
              </Button>
            </DialogTrigger>
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
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="dify-dataset">데이터셋</Label>
              <Select value={selectedDataset} onValueChange={onSelectedDatasetChange}>
                <SelectTrigger id="dify-dataset">
                  <SelectValue placeholder="업로드할 데이터셋 선택" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.document_count}문서)
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
