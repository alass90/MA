import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { MermaidRenderer } from './mermaid-renderer';
import { isMermaidCode } from '@/lib/mermaid-utils';
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockFilename,
  CodeBlockCopyButton,
  CodeBlockBody,
  CodeBlockItem,
  CodeBlockContent,
} from "@/components/ui/shadcn-io/code-block";

export type MarkdownProps = {
  children: string;
  className?: string;
};

export const Markdown: React.FC<MarkdownProps> = React.memo(({
  children,
  className = ''
}) => {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom styling for markdown elements
          h1: ({ children }) => <h1 className="text-lg font-semibold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ children, className }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const code = String(children).replace(/\n$/, '');
            const isInline = !className?.includes('language-');

            if (isInline) {
              return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
            }

            // Check if this is a Mermaid diagram
            if (isMermaidCode(language, code)) {
              return <MermaidRenderer chart={code} className="my-2" />;
            }

            return (
              <CodeBlock
                data={[{
                  language: language || 'text',
                  filename: language || 'code',
                  code: code,
                }]}
                defaultValue={language || 'text'}
                className="my-4"
              >
                <div className="bg-muted border-b border-border px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground font-medium uppercase tracking-wider">
                    {language || 'code'}
                  </span>
                  <CodeBlockCopyButton className="h-7 w-7 text-muted-foreground hover:text-foreground" />
                </div>
                <CodeBlockBody>
                  {(item) => (
                    <CodeBlockItem value={item.language}>
                      <CodeBlockContent 
                         language={item.language as any}
                         themes={{
                            light: 'github-light',
                            dark: 'github-dark'
                         }}
                      >
                         {item.code}
                      </CodeBlockContent>
                    </CodeBlockItem>
                  )}
                </CodeBlockBody>
              </CodeBlock>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic mb-2">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-4 border-muted-foreground/20" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-muted-foreground/20 mb-2">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-muted-foreground/20 px-2 py-1 bg-muted font-semibold text-left text-xs">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-muted-foreground/20 px-2 py-1 text-xs">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = 'Markdown';
