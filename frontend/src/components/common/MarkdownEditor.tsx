import { useRef, useState, type ReactNode } from 'react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';
import { IconButton } from '../ui';
import { insertLink, prefixLines, wrapSelection, type Edit } from '../../utils/markdown';
import Markdown from './Markdown';

interface MarkdownEditorProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
}

/**
 * A Markdown text typed in the native text field (keyboard, dictation and
 * correction of the phone kept), with a toolbar that puts the marks around
 * the selection, and a preview of the rendering.
 */
export default function MarkdownEditor({ id, label, value, onChange, rows = 4, disabled }: MarkdownEditorProps) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);

  const apply = (edit: (text: string, start: number, end: number) => Edit) => {
    const field = area.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const next = edit(value, start, end);
    onChange(next.text);
    // Once React has put the new text in the field, select what was marked
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  };

  const tools: { icon: string; label: string; edit: (text: string, start: number, end: number) => Edit }[] = [
    { icon: 'type-bold', label: 'Gras', edit: (t, s, e) => wrapSelection(t, s, e, '**', 'gras') },
    { icon: 'type-italic', label: 'Italique', edit: (t, s, e) => wrapSelection(t, s, e, '_', 'italique') },
    { icon: 'type-h3', label: 'Titre', edit: (t, s, e) => prefixLines(t, s, e, () => '### ') },
    { icon: 'list-ul', label: 'Liste', edit: (t, s, e) => prefixLines(t, s, e, () => '- ') },
    { icon: 'list-ol', label: 'Liste numérotée', edit: (t, s, e) => prefixLines(t, s, e, (i) => `${i + 1}. `) },
    { icon: 'link-45deg', label: 'Lien', edit: insertLink },
  ];

  return (
    <Form.Group controlId={id}>
      <div className="d-flex align-items-center flex-wrap gap-1 mb-1">
        <Form.Label className="mb-0 flex-grow-1">{label}</Form.Label>
        <ButtonGroup aria-label="Mode">
          <Button variant={preview ? 'outline-secondary' : 'secondary'} aria-pressed={!preview}
            onClick={() => setPreview(false)}>Écrire</Button>
          <Button variant={preview ? 'secondary' : 'outline-secondary'} aria-pressed={preview}
            onClick={() => setPreview(true)} disabled={!value.trim()}>Aperçu</Button>
        </ButtonGroup>
      </div>
      {preview ? (
        <Markdown text={value} className="markdown-preview border rounded p-2" />
      ) : (
        <>
          <div className="markdown-toolbar d-flex flex-wrap" role="toolbar" aria-label="Mise en forme">
            {tools.map((tool) => (
              <IconButton key={tool.icon} variant="link" className="text-body" icon={tool.icon} label={tool.label}
                showLabel="never" disabled={disabled} onClick={() => apply(tool.edit)} />
            ))}
          </div>
          <Form.Control ref={area} as="textarea" rows={rows} value={value} disabled={disabled}
            onChange={(event) => onChange(event.target.value)} />
        </>
      )}
    </Form.Group>
  );
}
