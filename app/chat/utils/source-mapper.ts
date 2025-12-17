// app/chat/utils/source-mapper.ts
// 소스 문서 매핑 유틸리티 함수

import type { Source, RetrievedDocument } from "../types";

/**
 * RetrievedDocument를 Source 타입으로 변환
 * - headings가 있으면 title로 사용, 없으면 filename 사용
 * - section은 title과 중복되지 않도록 조건부 설정
 */
export function mapRetrievedDocToSource(doc: RetrievedDocument): Source {
  const filename = doc.metadata?.filename;
  const headings = doc.metadata?.headings;
  const hasHeadings = headings && headings.length > 0;

  // title: headings가 있으면 사용, 없으면 filename
  const title = hasHeadings ? headings.join(" > ") : (filename || `문서 ${doc.id}`);

  // section: headings가 있고 filename과 다를 때만 설정 (중복 방지)
  const section = hasHeadings && headings.join(" > ") !== filename
    ? headings.join(" > ")
    : undefined;

  return {
    id: doc.id,
    title,
    content: doc.text,
    score: doc.score,
    metadata: {
      file: filename,
      section,
      chunk_index: doc.metadata?.chunk_index,
      document_id: doc.metadata?.document_id,
      num_tokens: doc.metadata?.num_tokens,
      page: doc.metadata?.page,
      url: doc.metadata?.url,
    },
  };
}

/**
 * RetrievedDocument 배열을 Source 배열로 변환
 */
export function mapRetrievedDocsToSources(docs: RetrievedDocument[]): Source[] {
  return docs.map(mapRetrievedDocToSource);
}
