/**
 * 참조문서 content 정제 유틸리티
 *
 * Docling/Qwen3-VL 파싱 시 삽입되는 메타데이터 헤더를 동적으로 감지하고 제거
 * 하드코딩 없이 패턴 기반으로 처리
 */

/**
 * 메타데이터 패턴 정의
 * 각 패턴은 정규식으로 정의되며, 매칭되면 해당 라인을 제거
 */
interface MetadataPattern {
  /** 패턴 설명 (디버깅용) */
  description: string;
  /** 라인 단위 매칭 정규식 */
  regex: RegExp;
  /** 패턴이 여러 줄에 걸쳐 있을 때 사용할 multiline 정규식 */
  multilineRegex?: RegExp;
}

/**
 * 제거할 메타데이터 패턴 목록
 * 동적으로 구성 가능하도록 설계됨
 */
const METADATA_PATTERNS: MetadataPattern[] = [
  {
    // 파일명.pdf 또는 파일명.docx 등 (확장자로 끝나는 라인)
    // 마크다운 헤더 형식 (#) 또는 plain text 형식 모두 지원
    description: "문서 파일명 (확장자로 끝나는 라인)",
    regex: /^#{0,6}\s*.+\.(pdf|docx?|pptx?|xlsx?|hwp)\s*$/i,
  },
  {
    // **총 페이지:** N페이지 (페이지 수 정보)
    description: "총 페이지 정보",
    regex: /^\*{0,2}총\s*페이지[:\s]*\*{0,2}\s*\d+\s*페이지\s*$/i,
  },
  {
    // 페이지 N 또는 ## 페이지 N (페이지 구분자)
    // 마크다운 헤더 형식 또는 plain text 형식 모두 지원
    description: "페이지 구분자 (페이지 N)",
    regex: /^#{0,6}\s*페이지\s*\d+\s*$/,
  },
  {
    // --- (구분선, 단독으로 있을 때만 제거)
    description: "구분선",
    regex: /^-{3,}\s*$/,
  },
  {
    // 파일 정보 헤더 (예: **파일명:** xxx.pdf)
    description: "파일명 정보",
    regex: /^\*{0,2}파일명?[:\s]*\*{0,2}\s*.+\.(pdf|docx?|pptx?|xlsx?|hwp)\s*$/i,
  },
  {
    // 문서 정보 헤더 (예: **문서:** xxx)
    description: "문서 정보 헤더",
    regex: /^\*{0,2}문서[:\s]*\*{0,2}\s*.+\.(pdf|docx?|pptx?|xlsx?|hwp)\s*$/i,
  },
];

/**
 * 빈 줄이 연속으로 너무 많으면 정리
 */
function normalizeEmptyLines(content: string): string {
  // 3개 이상 연속된 빈 줄을 2개로 정리
  return content.replace(/\n{3,}/g, "\n\n");
}

/**
 * content 앞부분의 메타데이터 헤더를 제거
 * (뒤쪽에 있는 실제 내용 부분의 페이지 정보는 유지)
 */
function removeLeadingMetadata(lines: string[]): string[] {
  const result: string[] = [];
  let foundContentStart = false;
  let consecutiveEmptyOrMeta = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 빈 줄인 경우
    if (trimmedLine === "") {
      if (foundContentStart) {
        result.push(line);
      } else {
        consecutiveEmptyOrMeta++;
      }
      continue;
    }

    // 메타데이터 패턴과 매칭되는지 확인
    const isMetadata = METADATA_PATTERNS.some((pattern) =>
      pattern.regex.test(trimmedLine)
    );

    if (isMetadata && !foundContentStart) {
      // 아직 실제 내용을 찾지 못했고, 메타데이터면 스킵
      consecutiveEmptyOrMeta++;

      // 하지만 너무 많은 줄을 스킵하면 실제 내용일 수 있으므로 제한
      if (consecutiveEmptyOrMeta > 15) {
        // 15줄 넘게 스킵했으면 실제 내용으로 간주
        foundContentStart = true;
        result.push(line);
      }
      continue;
    }

    // 실제 내용 발견
    foundContentStart = true;
    result.push(line);
  }

  return result;
}

/**
 * 참조문서 content에서 Docling/Qwen3 메타데이터 헤더를 정제
 *
 * @param content - 원본 content 문자열
 * @returns 정제된 content 문자열
 *
 * @example
 * ```ts
 * const cleaned = sanitizeSourceContent(`# document.pdf
 *
 * **총 페이지:** 10페이지
 *
 * ---
 *
 * ## 페이지 1
 *
 * 실제 내용입니다.`);
 *
 * // 결과: "실제 내용입니다."
 * ```
 */
export function sanitizeSourceContent(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  // 줄 단위로 분리
  const lines = content.split("\n");

  // 앞부분 메타데이터 제거
  const cleanedLines = removeLeadingMetadata(lines);

  // 다시 합치기
  let result = cleanedLines.join("\n");

  // 빈 줄 정리
  result = normalizeEmptyLines(result);

  // 앞뒤 공백 제거
  result = result.trim();

  return result;
}

/**
 * 코드 블록으로 감싸진 콘텐츠에서 코드 블록 구분자를 제거
 * Docling 청킹 결과가 ``` 코드 블록으로 감싸져 있을 때 마크다운 렌더링을 위해 제거
 *
 * @param content - 원본 content 문자열
 * @returns 코드 블록 구분자가 제거된 content 문자열
 */
export function stripCodeBlockWrapper(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  const lines = content.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // 코드 블록 시작/종료 감지
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        // 코드 블록 시작
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        // 언어 지정이 없거나 markdown인 경우 코드 블록 구분자 제거
        if (
          !codeBlockLang ||
          codeBlockLang === "markdown" ||
          codeBlockLang === "md"
        ) {
          continue; // 구분자 제거
        }
      } else {
        // 코드 블록 종료
        inCodeBlock = false;
        if (
          !codeBlockLang ||
          codeBlockLang === "markdown" ||
          codeBlockLang === "md"
        ) {
          continue; // 구분자 제거
        }
      }
    }

    result.push(line);
  }

  return result.join("\n").trim();
}

/**
 * 참조문서 content를 완전히 정제 (메타데이터 제거 + 코드 블록 처리)
 *
 * @param content - 원본 content 문자열
 * @returns 완전히 정제된 content 문자열
 */
export function cleanSourceContent(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  // 1. 코드 블록 wrapper 제거
  let cleaned = stripCodeBlockWrapper(content);

  // 2. 메타데이터 헤더 제거
  cleaned = sanitizeSourceContent(cleaned);

  return cleaned;
}

/**
 * 디버깅용: 어떤 패턴이 매칭되었는지 확인
 *
 * @param content - 분석할 content 문자열
 * @returns 매칭된 패턴 정보 배열
 */
export function analyzeMetadataPatterns(
  content: string
): { line: string; matchedPattern: string }[] {
  if (!content || typeof content !== "string") {
    return [];
  }

  const lines = content.split("\n");
  const matches: { line: string; matchedPattern: string }[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    for (const pattern of METADATA_PATTERNS) {
      if (pattern.regex.test(trimmedLine)) {
        matches.push({
          line: trimmedLine,
          matchedPattern: pattern.description,
        });
        break;
      }
    }
  }

  return matches;
}
