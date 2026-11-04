import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  text: string;
}

/**
 * The Markdown renderer, loaded on first use (see `Markdown.tsx`). Raw HTML
 * shows as the text typed (escaped, never run nor dropped), no image (a remote one would make every reader's
 * device call another site), links open apart. A single line break stays a
 * line break, as people type in a text field.
 */
export default function MarkdownRenderer({ text }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      disallowedElements={['img']}
      unwrapDisallowed
      components={{
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
