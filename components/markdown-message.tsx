"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Components } from "react-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarkdownMessageProps {
  content: string;
  /** compact 모드: 테이블 Collapsible 비활성화, 참조문서 패널용 */
  compact?: boolean;
}

// 테이블 컴포넌트 분리 (Collapsible 상태 관리)
function MarkdownTable({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="my-4 w-full max-w-full"
    >
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-sm font-semibold text-muted-foreground">
          표 데이터
        </span>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="sr-only">테이블 접기/펼치기</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="w-full rounded-md border overflow-x-auto max-w-full">
          <table className="w-full min-w-fit divide-y divide-border border-collapse text-sm">
            {children}
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Compact 테이블 (Collapsible 없이 단순 렌더링)
function CompactTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 w-full rounded-md border overflow-x-auto">
      <table className="w-full min-w-fit divide-y divide-border border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function MarkdownMessage({ content, compact = false }: MarkdownMessageProps) {
  // rehypeSanitize 스키마 커스터마이즈 - <br> 태그 허용
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), 'br'],
    attributes: {
      ...defaultSchema.attributes,
      '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'style'],
    },
  };

  // 테이블 컴포넌트 선택 (compact 모드면 Collapsible 없는 버전 사용)
  const TableComponent = compact ? CompactTable : MarkdownTable;

  const components: Components = {
    // 테이블 스타일링
    table: ({ children }) => <TableComponent>{children}</TableComponent>,
    thead: ({ children }) => (
      <thead className="bg-muted">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-border bg-background">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-muted/50 transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-sm font-semibold text-foreground whitespace-nowrap bg-muted/50">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-sm text-foreground align-top">
        <div className="max-w-[400px] break-words whitespace-normal">
          {children}
        </div>
      </td>
    ),

    // 제목 스타일링
    h1: ({ children }) => (
      <h1 className="text-xl font-bold mt-4 mb-3 text-foreground border-b border-border pb-2 break-words">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-bold mt-4 mb-2 text-foreground break-words">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold mt-3 mb-2 text-foreground break-words">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold mt-2 mb-1 text-foreground break-words">
        {children}
      </h4>
    ),

    // 리스트 스타일링
    ul: ({ children }) => (
      <ul className="list-disc list-inside my-2 space-y-1 text-foreground ml-3">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside my-2 space-y-1 text-foreground ml-3">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-sm leading-relaxed break-words">{children}</li>
    ),

    // 단락 스타일링
    p: ({ children }) => (
      <p className="my-2 text-sm leading-relaxed text-foreground break-words max-w-full">
        {children}
      </p>
    ),

    // 코드 블록 스타일링 (react-markdown v10+)
    // pre 태그 안의 code는 코드 블록, 그 외는 인라인 코드
    // node.properties를 통해 부모가 pre인지 확인하거나 className으로 판단
    code: ({ className, children, node, ...props }) => {
      // language-* 클래스가 있으면 코드 블록
      const hasLanguage = /language-(\w+)/.test(className || '');

      // 코드 블록 내부의 code 태그 (pre > code 구조)
      // react-markdown v10에서는 pre 안의 code에만 className이 전달됨
      // 언어 지정 없는 코드 블록도 처리하기 위해 node 정보 활용
      const isInPre = node?.position && String(children).includes('\n');
      const isCodeBlock = hasLanguage || isInPre;

      if (isCodeBlock) {
        // 코드 블록 (pre 태그 안) - pre에서 스타일링하므로 여기서는 최소한만
        return (
          <code className={`${className || ''} text-sm font-mono block`} {...props}>
            {children}
          </code>
        );
      }

      // 인라인 코드
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground break-all" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-muted p-3 rounded-md overflow-x-auto my-3 max-w-full border">
        {children}
      </pre>
    ),

    // 인용구 스타일링
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary pl-3 py-2 my-2 text-muted-foreground italic text-sm break-words">
        {children}
      </blockquote>
    ),

    // 링크 스타일링
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline font-medium text-sm break-all"
      >
        {children}
      </a>
    ),

    // 구분선
    hr: () => <hr className="my-4 border-border" />,

    // 강조
    strong: ({ children }) => (
      <strong className="font-bold text-foreground break-words">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-foreground break-words">{children}</em>
    ),

    // br 태그 처리
    br: () => <br />,
  };

  return (
    <div className={compact ? "markdown-content w-full max-w-full" : "markdown-content w-full max-w-full overflow-hidden"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema]
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
