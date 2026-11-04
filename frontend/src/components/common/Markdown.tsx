import { lazy, Suspense } from 'react';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

interface MarkdownProps {
  text: string;
  className?: string;
}

/**
 * Markdown text (visit reports, notes on a colony). The renderer is loaded
 * when first needed, so the pages without Markdown do not carry it; until it
 * arrives, the text shows as typed.
 */
export default function Markdown({ text, className = '' }: MarkdownProps) {
  return (
    <div className={`markdown-text text-break ${className}`}>
      <Suspense fallback={<div className="markdown-fallback">{text}</div>}>
        <MarkdownRenderer text={text} />
      </Suspense>
    </div>
  );
}
