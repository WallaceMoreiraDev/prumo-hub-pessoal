import { memo, useMemo } from 'react';
import 'katex/dist/katex.min.css';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex, { type Options as RehypeKatexOptions } from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { prepareMarkdownMathContent } from '@/lib/markdownMath';
import { isSafeHttpUrl } from '@/lib/url';
import { cn } from '@/lib/utils';

export interface MarkdownMathRendererProps {
  content: string | null | undefined;
  className?: string;
}

const KATEX_OPTIONS: RehypeKatexOptions = {
  strict: false,
};

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkBreaks];
const REHYPE_PLUGINS: [[typeof rehypeKatex, RehypeKatexOptions]] = [
  [rehypeKatex, KATEX_OPTIONS],
];

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 text-base font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3.5 text-sm font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 text-sm font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 text-xs font-semibold uppercase tracking-wide text-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="leading-relaxed text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 text-foreground">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed [&>p]:my-0.5">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="rounded-r-lg border-l-2 border-primary/50 bg-muted/40 py-1.5 pl-3.5 pr-3 text-muted-foreground [&>p]:my-0.5">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-muted-foreground line-through">{children}</del>
  ),
  a: ({ href, children }) => {
    if (isSafeHttpUrl(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          {children}
        </a>
      );
    }
    return <span className="break-words text-muted-foreground">{children}</span>;
  },
  img: ({ alt }) => {
    const label = alt?.trim();
    return (
      <span className="inline-block rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {label ? `[imagem: ${label}]` : '[imagem]'}
      </span>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-xl border border-border bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground [&>code]:rounded-none [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlockCode =
      Boolean(className?.includes('language-')) ||
      (typeof children === 'string' && children.includes('\n'));

    if (isBlockCode) {
      return (
        <code
          className={cn('font-mono text-xs text-foreground', className)}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code
        className={cn(
          'rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-xs text-foreground">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border bg-muted/50 text-foreground">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border/60 last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
};

function sanitizeMarkdownUrl(url: string): string {
  return isSafeHttpUrl(url) ? url.trim() : '';
}

export const MarkdownMathRenderer = memo(function MarkdownMathRenderer({
  content,
  className,
}: MarkdownMathRendererProps) {
  const prepared = useMemo(
    () => (content ? prepareMarkdownMathContent(content) : ''),
    [content]
  );

  if (!prepared) {
    return null;
  }

  return (
    <div
      className={cn(
        'min-w-0 max-w-full space-y-2.5 break-words text-sm leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        urlTransform={sanitizeMarkdownUrl}
        components={MARKDOWN_COMPONENTS}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
});

MarkdownMathRenderer.displayName = 'MarkdownMathRenderer';
