// app/chat/utils/sse-parser.ts
// SSE 스트림 파싱 유틸리티

/**
 * SSE 이벤트 타입
 */
export type SSEEventType = "stage" | "sources" | "sources_update" | "reasoning" | "content" | "done" | "unknown";

/**
 * SSE 이벤트 인터페이스
 */
export interface SSEEvent {
  type: SSEEventType;
  stage?: string;           // type === "stage" 일 때 단계명
  sources?: any[];          // type === "sources" 일 때 검색 문서 목록
  sourcesUpdate?: any[];    // type === "sources_update" 일 때 인용 정보가 추가된 문서 목록
  reasoning?: string;       // type === "reasoning" 일 때 추론 텍스트 청크
  content?: string;         // type === "content" 일 때 답변 텍스트 청크
  raw?: any;                // 원본 파싱 데이터
}

/**
 * 파싱된 JSON 데이터를 SSEEvent로 변환
 */
function parseSSEData(parsed: any): SSEEvent {
  // 1. stage 이벤트 (RAG 파이프라인 단계)
  if (parsed.type === "stage" && parsed.stage) {
    return { type: "stage", stage: parsed.stage, raw: parsed };
  }

  // 2. sources 이벤트 (검색된 문서)
  if (parsed.sources) {
    return { type: "sources", sources: parsed.sources, raw: parsed };
  }

  // 2.5. sources_update 이벤트 (인용 정보가 추가된 문서)
  if (parsed.sources_update) {
    return { type: "sources_update", sourcesUpdate: parsed.sources_update, raw: parsed };
  }

  // 3. reasoning_chunk 이벤트 (추론 과정)
  if (parsed.type === "reasoning_chunk" && parsed.content) {
    return { type: "reasoning", reasoning: parsed.content, raw: parsed };
  }

  // 4. content 이벤트 (OpenAI 스타일 delta)
  const delta = parsed.choices?.[0]?.delta;
  if (delta?.content) {
    return { type: "content", content: delta.content, raw: parsed };
  }

  // 5. 알 수 없는 이벤트
  return { type: "unknown", raw: parsed };
}

/**
 * SSE 스트림을 파싱하여 이벤트를 yield하는 AsyncGenerator
 *
 * @param reader - ReadableStreamDefaultReader
 * @yields SSEEvent - 파싱된 SSE 이벤트
 *
 * @example
 * ```typescript
 * const reader = response.body?.getReader();
 * if (reader) {
 *   for await (const event of parseSSEStream(reader)) {
 *     switch (event.type) {
 *       case "stage": setCurrentStage(event.stage!); break;
 *       case "sources": setSources(event.sources!); break;
 *       case "reasoning": reasoning += event.reasoning!; break;
 *       case "content": content += event.content!; break;
 *       case "done": break;
 *     }
 *   }
 * }
 * ```
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // SSE 버퍼링: 기존 버퍼에 새 청크 추가
      buffer += decoder.decode(value, { stream: true });

      // 완전한 라인들만 분리 (마지막 불완전한 라인은 버퍼에 유지)
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        // data: 접두사가 없는 라인은 무시
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6); // "data: " 제거

        // 스트리밍 종료 시그널
        if (data === "[DONE]") {
          yield { type: "done" };
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          yield parseSSEData(parsed);
        } catch {
          // JSON 파싱 실패 - 무시 (불완전한 데이터일 수 있음)
        }
      }
    }

    // 스트림 종료 후 버퍼에 남은 데이터 처리
    if (buffer.trim() && buffer.startsWith("data: ")) {
      const data = buffer.slice(6);
      if (data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          yield parseSSEData(parsed);
        } catch {
          // JSON 파싱 실패 - 무시
        }
      }
    }
  } finally {
    // reader가 취소되지 않았으면 릴리스
    try {
      reader.releaseLock();
    } catch {
      // 이미 릴리스되었거나 취소된 경우 무시
    }
  }
}
