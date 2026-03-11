"use client";

import { useState, memo, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Code2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CodeExecution } from "../types";

// ============================================================================
// Python Syntax Highlighting
// ============================================================================

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
]);

const PYTHON_BUILTINS = new Set([
  "print", "len", "range", "type", "int", "float", "str", "list",
  "dict", "set", "tuple", "bool", "enumerate", "zip", "map", "filter",
  "sorted", "reversed", "sum", "min", "max", "abs", "round", "open",
  "isinstance", "hasattr", "getattr", "setattr", "super", "property",
  "staticmethod", "classmethod", "ValueError", "TypeError", "KeyError",
  "IndexError", "Exception", "RuntimeError",
]);

interface Token {
  type: "keyword" | "builtin" | "string" | "comment" | "number" | "decorator" | "text";
  value: string;
}

function tokenizePython(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Comments
    if (code[i] === "#") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = code.length;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Triple-quoted strings
    if (
      (code[i] === '"' && code.slice(i, i + 3) === '"""') ||
      (code[i] === "'" && code.slice(i, i + 3) === "'''")
    ) {
      const quote = code.slice(i, i + 3);
      let end = code.indexOf(quote, i + 3);
      if (end === -1) end = code.length - 3;
      tokens.push({ type: "string", value: code.slice(i, end + 3) });
      i = end + 3;
      continue;
    }

    // Strings
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // f-string prefix
    if ((code[i] === "f" || code[i] === "r" || code[i] === "b") && (code[i + 1] === '"' || code[i + 1] === "'")) {
      const quote = code[i + 1];
      let j = i + 2;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Decorators
    if (code[i] === "@" && (i === 0 || code[i - 1] === "\n")) {
      let end = i + 1;
      while (end < code.length && /[\w.]/.test(code[end])) end++;
      tokens.push({ type: "decorator", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Numbers
    if (/\d/.test(code[i]) && (i === 0 || !/[\w]/.test(code[i - 1]))) {
      let end = i;
      while (end < code.length && /[\d._eExXoObB]/.test(code[end])) end++;
      tokens.push({ type: "number", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Words (keywords, builtins, identifiers)
    if (/[a-zA-Z_]/.test(code[i])) {
      let end = i;
      while (end < code.length && /[\w]/.test(code[end])) end++;
      const word = code.slice(i, end);
      if (PYTHON_KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (PYTHON_BUILTINS.has(word)) {
        tokens.push({ type: "builtin", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }
      i = end;
      continue;
    }

    // Everything else
    tokens.push({ type: "text", value: code[i] });
    i++;
  }

  return tokens;
}

const TOKEN_STYLES: Record<Token["type"], string> = {
  keyword: "text-purple-400",
  builtin: "text-blue-400",
  string: "text-amber-400",
  comment: "text-green-600 italic",
  number: "text-cyan-400",
  decorator: "text-yellow-400",
  text: "",
};

function HighlightedCode({ code }: { code: string }) {
  const tokens = useMemo(() => tokenizePython(code), [code]);

  return (
    <>
      {tokens.map((token, i) =>
        token.type === "text" ? (
          <span key={i}>{token.value}</span>
        ) : (
          <span key={i} className={TOKEN_STYLES[token.type]}>
            {token.value}
          </span>
        )
      )}
    </>
  );
}

// ============================================================================
// Table Detection & Rendering
// ============================================================================

interface TableData {
  headers: string[];
  rows: string[][];
}

function detectAndParseTable(text: string): { tables: { start: number; end: number; data: TableData }[]; lines: string[] } | null {
  const lines = text.split("\n");
  const tables: { start: number; end: number; data: TableData }[] = [];

  let i = 0;
  while (i < lines.length) {
    // Detect markdown-style table: header row with |, separator with ---|
    const line = lines[i];
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^[\s|:\-+]+$/.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      const start = i;
      const headers = line.split("|").map(s => s.trim()).filter(Boolean);
      i += 2; // skip header and separator

      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && !/^[\s|:\-+]+$/.test(lines[i])) {
        rows.push(lines[i].split("|").map(s => s.trim()).filter(Boolean));
        i++;
      }

      if (headers.length > 0 && rows.length > 0) {
        tables.push({ start, end: i, data: { headers, rows } });
      }
      continue;
    }
    i++;
  }

  if (tables.length === 0) return null;
  return { tables, lines };
}

function StyledTable({ data }: { data: TableData }) {
  return (
    <div className="overflow-x-auto my-2 rounded border border-border/30">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 border-b border-border/30">
            {data.headers.map((h, i) => (
              <th key={i} className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1 whitespace-nowrap text-foreground/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COLLAPSED_HEIGHT = 300;

function OutputContent({ text, expanded }: { text: string; expanded: boolean }) {
  const parsed = useMemo(() => detectAndParseTable(text), [text]);

  if (!parsed) {
    return (
      <pre className={cn(
        "px-3 pb-3 text-xs overflow-x-auto text-foreground/80 bg-background/30 font-mono whitespace-pre-wrap",
        expanded ? "" : "max-h-[300px] overflow-y-auto"
      )}>
        {text}
      </pre>
    );
  }

  // Render mixed content: text blocks and tables
  const { tables, lines } = parsed;
  const segments: React.ReactNode[] = [];
  let lastEnd = 0;

  tables.forEach((table, idx) => {
    // Text before table
    if (table.start > lastEnd) {
      const textBefore = lines.slice(lastEnd, table.start).join("\n");
      if (textBefore.trim()) {
        segments.push(
          <pre key={`text-${idx}`} className="px-3 py-1 text-xs overflow-x-auto text-foreground/80 bg-background/30 font-mono whitespace-pre-wrap">
            {textBefore}
          </pre>
        );
      }
    }
    // Table
    segments.push(<StyledTable key={`table-${idx}`} data={table.data} />);
    lastEnd = table.end;
  });

  // Text after last table
  if (lastEnd < lines.length) {
    const textAfter = lines.slice(lastEnd).join("\n");
    if (textAfter.trim()) {
      segments.push(
        <pre key="text-end" className="px-3 pb-3 text-xs overflow-x-auto text-foreground/80 bg-background/30 font-mono whitespace-pre-wrap">
          {textAfter}
        </pre>
      );
    }
  }

  return (
    <div className={expanded ? "" : "max-h-[300px] overflow-y-auto"}>
      {segments}
    </div>
  );
}

// ============================================================================
// CodeExecutionBlock
// ============================================================================

interface CodeExecutionBlockProps {
  executions: CodeExecution[];
}

export const CodeExecutionBlock = memo(function CodeExecutionBlock({
  executions,
}: CodeExecutionBlockProps) {
  if (!executions || executions.length === 0) return null;

  // Determine which executions should be dimmed
  // Non-last error/failed blocks are dimmed when there are subsequent attempts
  const lastIndex = executions.length - 1;

  return (
    <div className="space-y-3 my-3">
      {executions.map((exec, index) => {
        const isDimmed =
          index < lastIndex &&
          (exec.status === "error" || exec.status === "failed");

        return (
          <SingleExecution
            key={index}
            execution={exec}
            index={index}
            isDimmed={isDimmed}
          />
        );
      })}
    </div>
  );
});

interface SingleExecutionProps {
  execution: CodeExecution;
  index: number;
  isDimmed?: boolean;
}

function SingleExecution({ execution, index, isDimmed = false }: SingleExecutionProps) {
  const [codeExpanded, setCodeExpanded] = useState(
    isDimmed ? false : execution.status === "running"
  );
  const [outputExpanded, setOutputExpanded] = useState(!isDimmed);
  const [outputFullHeight, setOutputFullHeight] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const outputContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Detect if output content overflows the collapsed height
  useEffect(() => {
    if (outputExpanded && outputContainerRef.current) {
      // The first child of the ref container is the OutputContent element
      // which has the max-h constraint - check its scrollHeight vs clientHeight
      const inner = outputContainerRef.current.firstElementChild as HTMLElement;
      if (inner) {
        setIsOverflowing(inner.scrollHeight > COLLAPSED_HEIGHT);
      }
    }
  }, [outputExpanded, execution.stdout]);

  const handleCopy = async () => {
    // 코드 + 실행 결과를 함께 복사
    const parts: string[] = [];
    if (execution.code) {
      parts.push("```python");
      parts.push(execution.code);
      parts.push("```");
    }
    if (execution.stdout && execution.stdout.trim()) {
      parts.push("\n실행 결과:");
      parts.push(execution.stdout);
    }
    if (execution.images && execution.images.length > 0) {
      parts.push(`\n(차트 ${execution.images.length}개 생성됨)`);
    }
    if (parts.length > 0) {
      await navigator.clipboard.writeText(parts.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyOutput = async () => {
    if (execution.stdout) {
      await navigator.clipboard.writeText(execution.stdout);
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 2000);
    }
  };

  const handleDownloadImage = (base64: string, imageIndex: number) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${base64}`;
    link.download = `chart_${index + 1}_${imageIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusConfig = {
    running: { icon: Loader2, label: "실행 중", color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", iconClass: "animate-spin" },
    success: { icon: CheckCircle, label: "성공", color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/30", iconClass: "" },
    error: { icon: AlertTriangle, label: "에러", color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30", iconClass: "" },
    failed: { icon: XCircle, label: "실패", color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/30", iconClass: "" },
  };

  const config = statusConfig[execution.status] || statusConfig.running;
  const StatusIcon = config.icon;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden transition-opacity duration-200",
      config.borderColor,
      config.bgColor,
      isDimmed && "opacity-40"
    )}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-background/50">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Python</span>
          <StatusIcon className={cn("h-3.5 w-3.5", config.color, config.iconClass)} />
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
            {execution.attempt && execution.attempt > 1 && ` (${execution.attempt}/${execution.attempt})`}
          </span>
          {execution.executionTimeMs && execution.status !== "running" && (
            <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
              {(execution.executionTimeMs / 1000).toFixed(1)}s
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
            title="코드 + 결과 복사"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCodeExpanded(!codeExpanded)}
            title={codeExpanded ? "코드 접기" : "코드 펼치기"}
          >
            {codeExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* 코드 블록 (with syntax highlighting) */}
      {codeExpanded && execution.code && (
        <div className="border-t border-border/30">
          <pre className="p-3 text-xs overflow-x-auto max-h-[300px] overflow-y-auto bg-zinc-950 dark:bg-zinc-900">
            <code className="text-zinc-200">
              <HighlightedCode code={execution.code} />
            </code>
          </pre>
        </div>
      )}

      {/* 설명 */}
      {execution.description && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border/30 bg-background/30">
          {execution.description}
        </div>
      )}

      {/* 에러 표시 */}
      {execution.error && (
        <div className="px-3 py-2 text-xs text-red-500 border-t border-red-500/20 bg-red-500/5 font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {execution.error}
        </div>
      )}

      {/* 출력 결과 (with table detection) */}
      {execution.stdout && (
        <div className="border-t border-border/30">
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
            <button
              className="flex items-center gap-1 hover:bg-muted/30 rounded px-1 -ml-1 transition-colors"
              onClick={() => setOutputExpanded(!outputExpanded)}
            >
              <span>출력 결과</span>
              {outputExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {outputExpanded && (
              <button
                className="p-1 hover:bg-muted/50 rounded transition-colors"
                onClick={handleCopyOutput}
                title="결과 복사"
              >
                {outputCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
          {outputExpanded && (
            <div className="relative" ref={outputContainerRef}>
              <OutputContent text={execution.stdout} expanded={outputFullHeight} />
              {isOverflowing && !outputFullHeight && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent pt-8 pb-1 flex justify-center">
                  <button
                    className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50 transition-colors"
                    onClick={() => setOutputFullHeight(true)}
                  >
                    전체 보기
                  </button>
                </div>
              )}
              {isOverflowing && outputFullHeight && (
                <div className="flex justify-center py-1 border-t border-border/20">
                  <button
                    className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50 transition-colors"
                    onClick={() => setOutputFullHeight(false)}
                  >
                    접기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 차트 이미지 */}
      {execution.images && execution.images.length > 0 && (
        <div className="border-t border-border/30 p-3">
          <div className={cn(
            "gap-3",
            execution.images.length === 1 ? "flex justify-center" : "grid grid-cols-1 sm:grid-cols-2"
          )}>
            {execution.images.map((img, imgIdx) => (
              <div key={imgIdx} className="relative group rounded-lg overflow-hidden border bg-white">
                <img
                  src={`data:image/png;base64,${img}`}
                  alt={`Chart ${imgIdx + 1}`}
                  className="w-full h-auto cursor-pointer"
                  onClick={() => setEnlargedImage(img)}
                />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadImage(img, imgIdx);
                    }}
                    title="다운로드"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 shadow-md"
                    onClick={() => setEnlargedImage(img)}
                    title="확대"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이미지 확대 모달 */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogTitle className="sr-only">차트 확대 보기</DialogTitle>
          {enlargedImage && (
            <div className="relative">
              <img
                src={`data:image/png;base64,${enlargedImage}`}
                alt="Enlarged chart"
                className="w-full h-auto rounded-lg bg-white"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 shadow-md"
                onClick={() => {
                  const idx = execution.images?.indexOf(enlargedImage) ?? 0;
                  handleDownloadImage(enlargedImage, idx);
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                다운로드
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
