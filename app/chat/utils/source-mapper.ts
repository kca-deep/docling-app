// app/chat/utils/source-mapper.ts
// 소스 문서 매핑 유틸리티 함수

import type { Source, RetrievedDocument } from "../types";

/**
 * 스트리밍/비스트리밍 두 형식 모두 지원하는 타입
 * - 비스트리밍: { text, metadata, keywords }
 * - 스트리밍: { payload: { text, ... }, keywords }
 */
interface RawDocument {
  id: string;
  score: number;
  text?: string;
  keywords?: string[];
  cited_phrases?: string[];  // 백엔드에서 오는 snake_case 형식
  metadata?: {
    filename?: string;
    headings?: string[];
    chunk_index?: number;
    document_id?: number;
    num_tokens?: number;
    page?: number;
    url?: string;
  };
  payload?: {
    text?: string;
    filename?: string;
    headings?: string[];
    chunk_index?: number;
    document_id?: number;
    num_tokens?: number;
    page?: number;
    url?: string;
  };
}

/**
 * RetrievedDocument를 Source 타입으로 변환
 * - headings가 있으면 title로 사용, 없으면 filename 사용
 * - section은 title과 중복되지 않도록 조건부 설정
 * - 스트리밍(payload 형식)과 비스트리밍(직접 형식) 모두 지원
 */
export function mapRetrievedDocToSource(doc: RetrievedDocument | RawDocument): Source {
  // 스트리밍(payload 형식)과 비스트리밍(직접 형식) 모두 지원
  const payload = (doc as RawDocument).payload;
  const text = (doc as RetrievedDocument).text ?? payload?.text ?? "";
  const metadata = (doc as RetrievedDocument).metadata ?? {};

  // payload에서 메타데이터 추출 (스트리밍 형식)
  const filename = metadata.filename ?? payload?.filename;
  const headings = metadata.headings ?? payload?.headings;
  const chunk_index = metadata.chunk_index ?? payload?.chunk_index;
  const document_id = metadata.document_id ?? payload?.document_id;
  const num_tokens = metadata.num_tokens ?? payload?.num_tokens;
  const page = metadata.page ?? payload?.page;
  const url = metadata.url ?? payload?.url;

  const hasHeadings = headings && headings.length > 0;

  // title: headings가 있으면 사용, 없으면 filename
  const title = hasHeadings ? headings.join(" > ") : (filename || `문서 ${doc.id}`);

  // section: headings가 있고 filename과 다를 때만 설정 (중복 방지)
  const section = hasHeadings && headings.join(" > ") !== filename
    ? headings.join(" > ")
    : undefined;

  // cited_phrases 처리 (snake_case → camelCase)
  const citedPhrases = (doc as RawDocument).cited_phrases;

  return {
    id: doc.id,
    title,
    content: text,
    score: doc.score,
    keywords: doc.keywords,  // 키워드 전달
    citedPhrases,  // 인용 구절 전달
    metadata: {
      file: filename,
      section,
      chunk_index,
      document_id,
      num_tokens,
      page,
      url,
    },
  };
}

/**
 * RetrievedDocument 배열을 Source 배열로 변환
 */
export function mapRetrievedDocsToSources(docs: RetrievedDocument[]): Source[] {
  return docs.map(mapRetrievedDocToSource);
}
