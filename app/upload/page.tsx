"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Upload, Database, Sparkles, AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"
import { MarkdownViewerModal } from "@/components/markdown-viewer-modal"
import { DocumentSelector } from "./components/DocumentSelector"
import { DifySettingsPanel } from "./components/DifySettingsPanel"
import { QdrantSettingsPanel } from "./components/QdrantSettingsPanel"
import { UploadResults } from "./components/UploadResults"
import type { UploadTarget } from "./types"
import { useUploadPageData } from "./hooks/useUploadPageData"
import { useRequirePermission } from "@/hooks/useRequirePermission"

// 허용된 탭 값 검증
const VALID_TABS: UploadTarget[] = ["qdrant", "dify"]
const getSafeTab = (tab: string | null): UploadTarget => {
  if (tab && VALID_TABS.includes(tab as UploadTarget)) {
    return tab as UploadTarget
  }
  return "qdrant"
}

function UploadPageContent() {
  const { isReady } = useRequirePermission("qdrant", "upload")
  const searchParams = useSearchParams()
  const initialTab = getSafeTab(searchParams.get("tab"))
  const initialCollection = searchParams.get("collection")

  const {
    // 탭
    activeTab, setActiveTab,
    // 문서
    documents, selectedDocs, selectedDocsInfo, currentPage, totalPages, totalDocs, pageSize,
    searchInput, searchQuery, loadingDocuments,
    toggleDocument, toggleAll, deselectDocument,
    handleSearch, handleSearchReset, handlePageChange, openDocumentViewer,
    setSearchInput,
    // 카테고리
    categoryFilter, handleCategoryFilterChange, handleMoveCategory, movingCategory,
    handleDeleteSelectedDocuments, deletingDocuments,
    qdrantCollections,
    // Dify
    difyApiKey, setDifyApiKey, difyBaseUrl, setDifyBaseUrl,
    difyDatasets, selectedDifyDataset, setSelectedDifyDataset,
    loadingDifyDatasets, difySaveDialogOpen, setDifySaveDialogOpen,
    difyConfigName, setDifyConfigName, difyResults, uploadingDify,
    fetchDifyDatasets, saveDifyConfig, uploadToDify,
    // Qdrant
    selectedQdrantCollection, setSelectedQdrantCollection,
    chunkSize, setChunkSize, chunkOverlap, setChunkOverlap,
    loadingQdrantCollections, qdrantResults, uploadingQdrant,
    qdrantProgress, fetchQdrantCollections, uploadToQdrant, executeQdrantUpload,
    // 중복
    duplicateDialogOpen, setDuplicateDialogOpen, duplicateInfo, newDocumentIds,
    // 뷰어
    viewerOpen, setViewerOpen, selectedDocumentId,
    // 파생
    isDifyUploadDisabled, isQdrantUploadDisabled,
  } = useUploadPageData({ initialTab, initialCollection })

  if (!isReady) return null

  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="h-5 w-5 text-muted-foreground" />
          벡터임베딩
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6">
        {/* 좌측: 문서 목록 (70%) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4 min-w-0"
        >
          <DocumentSelector
            documents={documents}
            selectedDocs={selectedDocs}
            selectedDocsInfo={selectedDocsInfo}
            currentPage={currentPage}
            totalPages={totalPages}
            totalDocs={totalDocs}
            pageSize={pageSize}
            searchInput={searchInput}
            searchQuery={searchQuery}
            loadingDocuments={loadingDocuments}
            onToggleDocument={toggleDocument}
            onToggleAll={toggleAll}
            onDeselectDocument={deselectDocument}
            onSearch={handleSearch}
            onSearchInputChange={setSearchInput}
            onSearchReset={handleSearchReset}
            onPageChange={handlePageChange}
            onOpenDocumentViewer={openDocumentViewer}
            // 카테고리 관련 props
            collections={qdrantCollections}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={handleCategoryFilterChange}
            onMoveCategory={handleMoveCategory}
            movingCategory={movingCategory}
            onDeleteSelected={handleDeleteSelectedDocuments}
            deletingDocuments={deletingDocuments}
          />
        </motion.div>

        {/* 우측: Qdrant/Dify 설정 (30%) - Sticky */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:sticky lg:top-4 lg:self-start min-w-0 overflow-hidden"
        >
          <Card className="min-w-0 overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm shadow-xl shadow-[color:var(--chart-1)]/5">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UploadTarget)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[color:var(--chart-1)]/10 to-[color:var(--chart-2)]/10">
                    <Upload className="h-5 w-5 text-[color:var(--chart-1)]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">임베딩 업로드</CardTitle>
                    <CardDescription className="mt-0.5 text-sm">
                      벡터 DB 또는 지식베이스 선택
                    </CardDescription>
                  </div>
                </div>

                {/* Enhanced Tabs */}
                <TabsList className="w-full h-11 p-1 bg-muted/50">
                  <TabsTrigger value="qdrant" className="flex-1 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Database className="h-4 w-4" />
                    Vector DB
                  </TabsTrigger>
                  <TabsTrigger value="dify" className="flex-1 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    Dify
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>

                {/* Qdrant 탭 */}
                <TabsContent value="qdrant" className="space-y-4 m-0 p-0">
              <QdrantSettingsPanel
                selectedCollection={selectedQdrantCollection}
                collections={qdrantCollections}
                chunkSize={chunkSize}
                chunkOverlap={chunkOverlap}
                loadingCollections={loadingQdrantCollections}
                onSelectedCollectionChange={setSelectedQdrantCollection}
                onChunkSizeChange={setChunkSize}
                onChunkOverlapChange={setChunkOverlap}
                onFetchCollections={fetchQdrantCollections}
              />

              {!selectedQdrantCollection && selectedDocs.size > 0 && (
                <Alert variant="default" className="border-[color:var(--chart-1)]/20 bg-[color:var(--chart-1)]/5">
                  <AlertDescription className="text-sm">
                    업로드하려면 상단에서 Collection을 먼저 선택해주세요.
                  </AlertDescription>
                </Alert>
              )}

              {/* 업로드 버튼 */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={uploadToQdrant}
                  disabled={isQdrantUploadDisabled}
                  size="lg"
                  className="flex-1 gap-2 shadow-lg shadow-[color:var(--chart-1)]/20 hover:shadow-[color:var(--chart-1)]/40 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[color:var(--chart-1)] hover:bg-[color:var(--chart-1)]/90"
                >
                  {uploadingQdrant ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Vector DB 업로드
                    </>
                  )}
                </Button>
                {selectedDocs.size > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-2 bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] border-[color:var(--chart-1)]/20">
                    {selectedDocs.size}
                  </Badge>
                )}
              </div>

              {/* 진행률 표시 */}
              {qdrantProgress && uploadingQdrant && (
                <div className="space-y-3 p-4 rounded-lg border border-[color:var(--chart-1)]/20 bg-[color:var(--chart-1)]/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {qdrantProgress.filename && (
                        <span className="font-medium text-foreground">{qdrantProgress.filename}</span>
                      )}
                      {qdrantProgress.phase && (
                        <span className="ml-2 text-[color:var(--chart-1)]">
                          ({qdrantProgress.phase === "chunking" && "청킹 중"}
                          {qdrantProgress.phase === "embedding" && "임베딩 생성 중"}
                          {qdrantProgress.phase === "uploading" && "업로드 중"}
                          {qdrantProgress.phase === "completed" && "완료"})
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {qdrantProgress.current_doc_index} / {qdrantProgress.total_docs}
                    </span>
                  </div>
                  <Progress value={(qdrantProgress.current_doc_index / qdrantProgress.total_docs) * 100} className="h-2" />
                  {qdrantProgress.chunk_count && (
                    <div className="text-xs text-muted-foreground">
                      청크 수: {qdrantProgress.chunk_count}
                    </div>
                  )}
                </div>
              )}

              <UploadResults
                uploadTarget="qdrant"
                difyResults={[]}
                qdrantResults={qdrantResults}
              />
            </TabsContent>

              {/* Dify 탭 */}
              <TabsContent value="dify" className="space-y-4 m-0 p-0">
                <DifySettingsPanel
                apiKey={difyApiKey}
                baseUrl={difyBaseUrl}
                selectedDataset={selectedDifyDataset}
                datasets={difyDatasets}
                loadingDatasets={loadingDifyDatasets}
                saveDialogOpen={difySaveDialogOpen}
                configName={difyConfigName}
                onApiKeyChange={setDifyApiKey}
                onBaseUrlChange={setDifyBaseUrl}
                onSelectedDatasetChange={setSelectedDifyDataset}
                onFetchDatasets={fetchDifyDatasets}
                onSaveDialogOpenChange={setDifySaveDialogOpen}
                onConfigNameChange={setDifyConfigName}
                onSaveConfig={saveDifyConfig}
              />

              {(!difyApiKey || !selectedDifyDataset) && selectedDocs.size > 0 && (
                <Alert variant="default" className="border-[color:var(--chart-2)]/20 bg-[color:var(--chart-2)]/5">
                  <AlertDescription className="text-sm">
                    업로드하려면 상단에서 API Key와 데이터셋을 먼저 설정해주세요.
                  </AlertDescription>
                </Alert>
              )}

              {/* 업로드 버튼 */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={uploadToDify}
                  disabled={isDifyUploadDisabled}
                  size="lg"
                  className="flex-1 gap-2 shadow-lg shadow-[color:var(--chart-2)]/20 hover:shadow-[color:var(--chart-2)]/40 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[color:var(--chart-2)] hover:bg-[color:var(--chart-2)]/90"
                >
                  {uploadingDify ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Dify 업로드
                    </>
                  )}
                </Button>
                {selectedDocs.size > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-2 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)] border-[color:var(--chart-2)]/20">
                    {selectedDocs.size}
                  </Badge>
                )}
              </div>

              <UploadResults
                uploadTarget="dify"
                difyResults={difyResults}
                qdrantResults={[]}
              />
              </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </motion.div>
      </div>

      {/* Markdown Viewer 모달 */}
      <MarkdownViewerModal
        documentId={selectedDocumentId}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      {/* 중복 확인 다이얼로그 */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              중복 문서 발견
            </DialogTitle>
            <DialogDescription>
              다음 문서는 이미 "{selectedQdrantCollection}" 컬렉션에 업로드되어 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {duplicateInfo.map((dup) => (
              <div
                key={dup.document_id}
                className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
              >
                <span className="text-sm font-medium truncate">{dup.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(dup.uploaded_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            ))}
          </div>

          {newDocumentIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              신규 문서 {newDocumentIds.length}개는 업로드됩니다.
            </p>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
            >
              취소
            </Button>
            {newDocumentIds.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => executeQdrantUpload(newDocumentIds)}
              >
                신규만 업로드 ({newDocumentIds.length}개)
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => executeQdrantUpload([
                ...newDocumentIds,
                ...duplicateInfo.map(d => d.document_id)
              ])}
            >
              모두 업로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UploadPageContent />
    </Suspense>
  )
}
