"use client"

import { useState, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Loader2, CheckCircle2, XCircle, Upload, Database, FileText, Search, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Document {
  id: number
  task_id: string
  original_filename: string
  content_length: number | null
  content_preview: string | null
  processing_time: number | null
  created_at: string
}

interface QdrantCollection {
  name: string
  vectors_count: number
  points_count: number
  vector_size: number
  distance: string
}

interface UploadResult {
  document_id: number
  filename: string
  success: boolean
  chunk_count: number
  vector_ids: string[]
  error: string | null
}

export default function QdrantPage() {
  // 문서 관련 상태
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [pageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")

  // Collection 관련 상태
  const [collections, setCollections] = useState<QdrantCollection[]>([])
  const [selectedCollection, setSelectedCollection] = useState("")
  const [newCollectionName, setNewCollectionName] = useState("")
  const [vectorSize] = useState(1024) // BGE-M3 고정
  const [distance, setDistance] = useState("Cosine")

  // 청킹 설정
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)

  // 업로드 결과
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])

  // 로딩 상태
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 검색 테스트 관련
  const [searchTestQuery, setSearchTestQuery] = useState("")
  const [topK, setTopK] = useState(5)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // 저장된 문서 목록 가져오기
  const fetchDocuments = async (page = 1, search = "") => {
    setLoadingDocuments(true)
    try {
      const skip = (page - 1) * pageSize
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: pageSize.toString(),
      })

      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`http://localhost:8000/api/documents/saved?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.items || [])
        setTotalPages(data.total_pages || 1)
        setTotalDocs(data.total || 0)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast.error("문서 목록을 불러오는데 실패했습니다")
    } finally {
      setLoadingDocuments(false)
    }
  }

  // Collection 목록 가져오기
  const fetchCollections = async () => {
    setLoadingCollections(true)
    try {
      const response = await fetch("http://localhost:8000/api/qdrant/collections")
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
        toast.success(`${data.collections.length}개의 Collection을 불러왔습니다`)
      } else {
        toast.error("Collection 목록을 가져오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error)
      toast.error("Collection 목록을 가져오는데 실패했습니다")
    } finally {
      setLoadingCollections(false)
    }
  }

  // Collection 생성
  const createCollection = async () => {
    if (!newCollectionName) {
      toast.error("Collection 이름을 입력해주세요")
      return
    }

    try {
      const response = await fetch("http://localhost:8000/api/qdrant/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: newCollectionName,
          vector_size: vectorSize,
          distance: distance
        })
      })

      if (response.ok) {
        toast.success(`Collection '${newCollectionName}'이 생성되었습니다`)
        setNewCollectionName("")
        fetchCollections()
      } else {
        const error = await response.json()
        toast.error(error.detail || "Collection 생성에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to create collection:", error)
      toast.error("Collection 생성에 실패했습니다")
    }
  }

  // 문서 업로드
  const uploadDocuments = async () => {
    if (!selectedCollection) {
      toast.error("대상 Collection을 선택해주세요")
      return
    }

    if (selectedDocs.size === 0) {
      toast.error("업로드할 문서를 선택해주세요")
      return
    }

    setUploading(true)
    try {
      const response = await fetch("http://localhost:8000/api/qdrant/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
          document_ids: Array.from(selectedDocs),
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap
        })
      })

      if (response.ok) {
        const data = await response.json()
        setUploadResults(data.results)
        toast.success(`${data.success_count}건 성공, ${data.failure_count}건 실패`)
      } else {
        toast.error("업로드에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to upload documents:", error)
      toast.error("업로드에 실패했습니다")
    } finally {
      setUploading(false)
    }
  }

  // 검색 테스트
  const performSearch = async () => {
    if (!searchTestQuery || !selectedCollection) {
      toast.error("검색어와 Collection을 선택해주세요")
      return
    }

    setSearching(true)
    try {
      const response = await fetch("http://localhost:8000/api/qdrant/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
          query_text: searchTestQuery,
          top_k: topK
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
        toast.success(`${data.results.length}건의 결과를 찾았습니다`)
      } else {
        toast.error("검색에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to search:", error)
      toast.error("검색에 실패했습니다")
    } finally {
      setSearching(false)
    }
  }

  // 문서 선택/해제
  const toggleDocument = (docId: number) => {
    const newSelected = new Set(selectedDocs)
    if (newSelected.has(docId)) {
      newSelected.delete(docId)
    } else {
      newSelected.add(docId)
    }
    setSelectedDocs(newSelected)
  }

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(documents.map(d => d.id)))
    }
  }

  // 검색 실행
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
    fetchDocuments(1, searchInput)
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    fetchDocuments(page, searchQuery)
  }

  // 초기 로드
  useEffect(() => {
    fetchDocuments()
    fetchCollections()
  }, [])

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold">Qdrant Vector DB</h1>
          <p className="text-muted-foreground">문서를 벡터 데이터베이스에 임베딩하여 저장합니다</p>
        </div>

        {/* Collection 관리 섹션 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Collection 관리</CardTitle>
                <CardDescription>Qdrant Vector DB의 Collection을 관리합니다</CardDescription>
              </div>
              <Button onClick={fetchCollections} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                새로고침
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Collection 목록 */}
            {loadingCollections ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : collections.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Vectors</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Distance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((collection) => (
                      <TableRow key={collection.name}>
                        <TableCell className="font-medium">{collection.name}</TableCell>
                        <TableCell>{collection.vectors_count.toLocaleString()}</TableCell>
                        <TableCell>{collection.points_count.toLocaleString()}</TableCell>
                        <TableCell>{collection.vector_size}</TableCell>
                        <TableCell>{collection.distance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <Alert>
                <AlertDescription>Collection이 없습니다. 새로 생성해주세요.</AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Collection 생성 */}
            <div className="space-y-4">
              <h4 className="font-semibold">새 Collection 생성</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">Collection 이름</Label>
                  <Input
                    id="collection-name"
                    placeholder="예: documents"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vector-size">Vector 크기</Label>
                  <Input
                    id="vector-size"
                    value={vectorSize}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">BGE-M3 고정</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance Metric</Label>
                  <Select value={distance} onValueChange={setDistance}>
                    <SelectTrigger id="distance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cosine">Cosine</SelectItem>
                      <SelectItem value="Euclidean">Euclidean</SelectItem>
                      <SelectItem value="Dot">Dot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={createCollection}>
                <Database className="h-4 w-4 mr-2" />
                생성
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 문서 업로드 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle>문서 업로드</CardTitle>
            <CardDescription>파싱된 문서를 선택하여 Qdrant에 업로드합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 검색 */}
            <div className="flex gap-2">
              <Input
                placeholder="파일명으로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* 문서 목록 */}
            {loadingDocuments ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedDocs.size === documents.length && documents.length > 0}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      전체선택 | 선택: {selectedDocs.size}건
                    </span>
                  </div>
                </div>

                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>파일명</TableHead>
                        <TableHead>생성일</TableHead>
                        <TableHead>크기</TableHead>
                        <TableHead>미리보기</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedDocs.has(doc.id)}
                              onCheckedChange={() => toggleDocument(doc.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{doc.original_filename}</TableCell>
                          <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {doc.content_length ? `${(doc.content_length / 1024).toFixed(1)}KB` : "-"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                            {doc.content_preview || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* 페이징 */}
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => handlePageChange(currentPage - 1)}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {[...Array(totalPages)].map((_, i) => (
                        <PaginationItem key={i + 1}>
                          <PaginationLink
                            onClick={() => handlePageChange(i + 1)}
                            isActive={currentPage === i + 1}
                            className="cursor-pointer"
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => handlePageChange(currentPage + 1)}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}

            <Separator />

            {/* 청킹 설정 및 업로드 */}
            <div className="space-y-4">
              <h4 className="font-semibold">업로드 설정</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="chunk-size">Chunk Size (토큰)</Label>
                  <Input
                    id="chunk-size"
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chunk-overlap">Chunk Overlap (토큰)</Label>
                  <Input
                    id="chunk-overlap"
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-collection">대상 Collection</Label>
                  <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                    <SelectTrigger id="target-collection">
                      <SelectValue placeholder="Collection 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={uploadDocuments} disabled={uploading || selectedDocs.size === 0}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    선택한 문서 업로드 ({selectedDocs.size}건)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 업로드 결과 */}
        {uploadResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>업로드 결과</CardTitle>
              <CardDescription>
                <span className="text-green-600">
                  ✓ 성공: {uploadResults.filter(r => r.success).length}건
                </span>
                {" | "}
                <span className="text-red-600">
                  ✗ 실패: {uploadResults.filter(r => !r.success).length}건
                </span>
                {" | "}
                총 청크: {uploadResults.reduce((acc, r) => acc + r.chunk_count, 0)}개
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>파일명</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>청크 수</TableHead>
                      <TableHead>오류</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResults.map((result) => (
                      <TableRow key={result.document_id}>
                        <TableCell className="font-medium">{result.filename}</TableCell>
                        <TableCell>
                          {result.success ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              성공
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              실패
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{result.chunk_count}</TableCell>
                        <TableCell className="text-red-600 text-sm">
                          {result.error || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* 검색 테스트 */}
        <Card>
          <CardHeader>
            <CardTitle>검색 테스트</CardTitle>
            <CardDescription>업로드된 문서를 검색합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="search-query">검색어</Label>
                <Input
                  id="search-query"
                  placeholder="검색어를 입력하세요..."
                  value={searchTestQuery}
                  onChange={(e) => setSearchTestQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && performSearch()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="top-k">Top K</Label>
                <Select value={topK.toString()} onValueChange={(v) => setTopK(parseInt(v))}>
                  <SelectTrigger id="top-k">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={performSearch} disabled={searching}>
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  검색
                </>
              )}
            </Button>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="space-y-3 mt-4">
                <h4 className="font-semibold">검색 결과 ({searchResults.length}건)</h4>
                <ScrollArea className="h-[300px]">
                  {searchResults.map((result, idx) => (
                    <Card key={idx} className="mb-3">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm">
                            {idx + 1}. {result.metadata?.filename || "Unknown"}
                          </CardTitle>
                          <Badge variant="outline">Score: {result.score.toFixed(3)}</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Chunk #{result.metadata?.chunk_index || 0}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {result.text}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
