/**
 * Qdrant description 필드에 저장되는 메타데이터
 * JSON.parse(collection.description)로 파싱
 */
export interface CollectionMetadata {
  koreanName?: string;       // 한글명 (예: "인사관리")
  icon?: string;             // lucide-react 아이콘명 (예: "Briefcase")
  keywords?: string[];       // 검색 키워드 (예: ["채용", "승진", "평가"])
  priority?: number;         // 추천 우선순위 (1=핵심, 2=주요, 3=일반)
  plainDescription?: string; // 간단 설명 (메타데이터 없을 때 폴백용)
}

/**
 * API에서 받은 Collection에 파싱된 메타데이터 추가
 */
export interface CollectionWithMetadata {
  name: string;
  documents_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
  visibility?: string;
  description?: string;
  owner_id?: number;
  is_owner?: boolean;
  // 파싱된 메타데이터
  metadata: CollectionMetadata;
}

/**
 * description 필드에서 메타데이터 파싱
 * JSON 파싱 실패 시 빈 객체 반환
 */
export function parseCollectionMetadata(description?: string): CollectionMetadata {
  if (!description) return {};

  try {
    const parsed = JSON.parse(description);
    // 유효한 메타데이터 객체인지 확인
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        koreanName: parsed.koreanName,
        icon: parsed.icon,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : undefined,
        priority: typeof parsed.priority === 'number' ? parsed.priority : undefined,
        plainDescription: parsed.plainDescription,
      };
    }
  } catch {
    // JSON 파싱 실패 시 description을 plainDescription으로 사용
    return { plainDescription: description };
  }

  return {};
}

/**
 * 메타데이터를 description JSON 문자열로 직렬화
 */
export function serializeCollectionMetadata(metadata: CollectionMetadata): string {
  return JSON.stringify(metadata);
}
