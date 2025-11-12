"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
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

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const components: Components = {
    // 테이블 스타일링
    table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
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

    // 코드 블록 스타일링
    code: ({ inline, children }) => {
      if (inline) {
        return (
          <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-foreground break-all">
            {children}
          </code>
        );
      }
      return (
        <code className="block bg-muted p-2 rounded-md text-sm font-mono overflow-x-auto my-2 max-w-full">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-muted p-2 rounded-md overflow-x-auto my-2 max-w-full">
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
    <div className="markdown-content w-full max-w-full overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
