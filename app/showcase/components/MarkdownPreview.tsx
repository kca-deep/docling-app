"use client"

import { isValidElement, type ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { CodeBlock } from "./CodeBlock"

interface Props {
  content: string
  className?: string
}

// children(ReactNode 트리)에서 순수 텍스트만 추출
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (!node) return ""
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return extractText(props.children)
  }
  return ""
}

const components: Components = {
  // 코드 렌더링: 블록 코드는 복사 버튼이 있는 CodeBlock, 인라인 코드는 작은 styled <code>
  code: ({ className, children, node, ...props }) => {
    const match = /language-(\w+)/.exec(className || "")
    const raw = extractText(children).replace(/\n$/, "")

    // 블록 코드 판별: 언어 지정이 있거나, 줄바꿈을 포함하거나, 부모 위치 정보가 있는 경우
    const isBlock = Boolean(match) || raw.includes("\n") || Boolean(node?.position)

    if (isBlock) {
      return <CodeBlock code={raw} language={match ? match[1] : undefined} className="my-3" />
    }

    return (
      <code
        className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono text-foreground break-all"
        {...props}
      >
        {children}
      </code>
    )
  },
  // CodeBlock 이 자체적으로 <pre> 를 렌더링하므로 기본 pre 래퍼는 children 만 통과
  pre: ({ children }) => <>{children}</>,

  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-3 text-foreground border-b border-border pb-2 break-words">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-4 mb-2 text-foreground break-words">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-2 text-foreground break-words">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold mt-2 mb-1 text-foreground break-words">{children}</h4>
  ),

  ul: ({ children }) => (
    <ul className="list-disc list-outside my-2 space-y-1 text-foreground ml-5 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside my-2 space-y-1 text-foreground ml-5 pl-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed break-words pl-1">{children}</li>
  ),

  p: ({ children }) => (
    <p className="my-2 text-sm leading-relaxed text-foreground break-words max-w-full">
      {children}
    </p>
  ),

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary pl-3 py-2 my-2 text-muted-foreground italic text-sm break-words">
      {children}
    </blockquote>
  ),

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

  hr: () => <hr className="my-4 border-border" />,

  strong: ({ children }) => (
    <strong className="font-bold text-foreground break-words">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground break-words">{children}</em>,

  table: ({ children }) => (
    <div className="my-3 w-full rounded-md border overflow-x-auto">
      <table className="w-full divide-y divide-border border-collapse text-sm table-auto">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
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
}

export function MarkdownPreview({ content, className }: Props) {
  return (
    <div className={className}>
      <div className="markdown-content w-full max-w-full overflow-hidden">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
