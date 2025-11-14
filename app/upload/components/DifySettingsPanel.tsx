"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Settings, Save } from "lucide-react"
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-500" />
          <CardTitle>Dify API 설정</CardTitle>
        </div>
        <CardDescription>
          Dify API 키와 데이터셋을 설정하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
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

          <div className="space-y-2">
            <Label htmlFor="dify-baseUrl">Base URL</Label>
            <Input
              id="dify-baseUrl"
              placeholder="https://api.dify.ai/v1"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>동작</Label>
            <div className="flex gap-2">
              <Button
                onClick={onFetchDatasets}
                disabled={loadingDatasets || !apiKey}
                variant="outline"
                className="flex-1"
              >
                {loadingDatasets && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                불러오기
              </Button>
              <Dialog open={saveDialogOpen} onOpenChange={onSaveDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!apiKey || !baseUrl}>
                    <Save className="mr-2 h-4 w-4" />
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
                      <Save className="mr-2 h-4 w-4" />
                      저장
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {datasets.length > 0 && (
          <div className="mt-4">
            <Label htmlFor="dify-dataset">데이터셋 선택</Label>
            <Select value={selectedDataset} onValueChange={onSelectedDatasetChange}>
              <SelectTrigger id="dify-dataset" className="w-full mt-2">
                <SelectValue placeholder="업로드할 데이터셋 선택" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    {dataset.name} ({dataset.document_count} 문서, {Math.round(dataset.word_count / 1000)}K 단어)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
