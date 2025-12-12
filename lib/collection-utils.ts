/**
 * Collection 관련 공통 유틸리티 함수
 */

/**
 * Collection의 메타데이터 인터페이스
 * description 필드에 JSON 형태로 저장됨
 */
export interface CollectionMetadata {
  koreanName?: string
  icon?: string
  keywords?: string[]
  priority?: number
  plainDescription?: string
}

/**
 * Collection description에서 메타데이터를 파싱
 * @param description - JSON 형식의 description 문자열
 * @returns 파싱된 메타데이터 객체
 */
export function parseCollectionMetadata(description?: string): CollectionMetadata {
  if (!description) return {}

  try {
    const parsed = JSON.parse(description)
    if (typeof parsed === "object" && parsed !== null) {
      return {
        koreanName: parsed.koreanName,
        icon: parsed.icon,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : undefined,
        priority: typeof parsed.priority === "number" ? parsed.priority : undefined,
        plainDescription: parsed.plainDescription,
      }
    }
  } catch {
    // JSON 파싱 실패 시 plain description으로 처리
    return { plainDescription: description }
  }

  return {}
}

/**
 * Collection의 표시명을 가져옴
 * 한글명이 있으면 한글명, 없으면 영문명 반환
 * @param collection - name과 description을 가진 객체
 * @returns 표시할 이름
 */
export function getCollectionDisplayName(
  collection: { name: string; description?: string }
): string {
  const metadata = parseCollectionMetadata(collection.description)
  return metadata.koreanName || collection.name
}

/**
 * Visibility 값에 대한 한글 레이블
 */
export function getVisibilityLabel(visibility?: string): string {
  switch (visibility) {
    case "private":
      return "비공개"
    case "shared":
      return "공유"
    default:
      return "공개"
  }
}
