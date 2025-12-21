"use client";

import React, { useState, isValidElement, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Components } from "react-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
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
          <table className="w-full divide-y divide-border border-collapse text-sm table-auto">
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
      <table className="w-full divide-y divide-border border-collapse text-sm table-auto">
        {children}
      </table>
    </div>
  );
}

// 코드 블록 컴포넌트 (복사 버튼 포함)
function CodeBlock({ children, language }: { children: React.ReactNode; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // children에서 텍스트 추출
      const extractText = (node: ReactNode): string => {
        if (typeof node === 'string') return node;
        if (typeof node === 'number') return String(node);
        if (!node) return '';
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (isValidElement(node)) {
          const props = node.props as { children?: ReactNode };
          return extractText(props.children);
        }
        return '';
      };

      const codeText = extractText(children).replace(/\n$/, '');
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative group my-3">
      {/* 상단 헤더 (언어 표시 + 복사 버튼) */}
      <div className="flex items-center justify-between bg-muted/80 border border-b-0 rounded-t-md px-3 py-1.5">
        <span className="text-xs text-muted-foreground font-mono">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              복사됨
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              복사
            </>
          )}
        </Button>
      </div>
      {/* 코드 영역 */}
      <pre className="bg-muted p-3 rounded-t-none rounded-b-md overflow-x-auto max-w-full border border-t-0">
        {children}
      </pre>
    </div>
  );
}

export function MarkdownMessage({ content, compact = false }: MarkdownMessageProps) {
  // rehypeSanitize 스키마 커스터마이즈 - <br>, <mark> 태그 허용
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), 'br', 'mark'],
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
      <th className="px-3 py-2 text-left text-sm font-semibold text-foreground bg-muted/50 break-keep">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-sm text-foreground align-top break-words [overflow-wrap:anywhere]">
        {children}
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

    // 리스트 스타일링 (list-outside로 bullet과 텍스트 분리 방지)
    ul: ({ children }) => (
      <ul className="list-disc list-outside my-2 space-y-1 text-foreground ml-5 pl-0">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside my-2 space-y-1 text-foreground ml-5 pl-0">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-sm leading-relaxed break-words pl-1">{children}</li>
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
    pre: ({ children }) => {
      // children에서 언어 정보 추출 (React element의 props에서)
      let language = '';
      const child = children as React.ReactElement<{ className?: string }>;
      if (child?.props?.className) {
        const match = child.props.className.match(/language-(\w+)/);
        if (match) {
          language = match[1];
        }
      }

      return <CodeBlock language={language}>{children}</CodeBlock>;
    },

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

    // mark 태그 처리 (하이라이트)
    mark: ({ children }) => (
      <mark className="underline decoration-teal-500 decoration-2 underline-offset-2 text-teal-700 dark:decoration-teal-400 dark:text-teal-300 font-medium bg-transparent">
        {children}
      </mark>
    ),
  };

  return (
    <div className={compact ? "markdown-content w-full max-w-full" : "markdown-content w-full max-w-full overflow-hidden"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
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
