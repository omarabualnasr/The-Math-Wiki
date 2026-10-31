import { useEffect } from 'react';
import type { TextAnnotation } from '../../engine/annotationStorage';

type HighlightRegistry = { set: (name: string, value: unknown) => void; delete: (name: string) => void };
type HighlightConstructor = new (...ranges: Range[]) => unknown;

function rangeForOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number; end: number }[] = [];
  let total = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const node = current as Text;
    const length = node.textContent?.length || 0;
    nodes.push({ node, start: total, end: total + length });
    total += length;
  }
  const first = nodes.find((item) => start >= item.start && start <= item.end);
  const last = nodes.find((item) => end >= item.start && end <= item.end);
  if (!first || !last || end <= start) return null;
  const range = document.createRange();
  range.setStart(first.node, Math.max(0, start - first.start));
  range.setEnd(last.node, Math.max(0, end - last.start));
  return range;
}

export default function AnnotationHighlights({ annotations }: { annotations: TextAnnotation[] }) {
  useEffect(() => {
    const css = CSS as typeof CSS & { highlights?: HighlightRegistry };
    const HighlightCtor = (window as Window & { Highlight?: HighlightConstructor }).Highlight;
    const tones = ['light', 'mid', 'dark', 'red', 'blue', 'green', 'yellow'];
    const names = tones.flatMap((tone) => [`mw-note-${tone}`, `mw-mark-${tone}`]);
    if (!css.highlights || !HighlightCtor) return;
    names.forEach((name) => css.highlights?.delete(name));
    const grouped = new Map<string, Range[]>();
    annotations.forEach((annotation) => {
      const root = document.querySelector<HTMLElement>(`[data-annotation-content][data-block-id="${CSS.escape(annotation.blockId)}"]`);
      if (!root) return;
      const raw = root.textContent || '';
      let start = annotation.start;
      let end = annotation.end;
      if (raw.slice(start, end) !== annotation.quote) {
        const recovered = raw.indexOf(annotation.quote);
        if (!annotation.quote || recovered < 0 || raw.indexOf(annotation.quote, recovered + 1) >= 0) return;
        start = recovered;
        end = recovered + annotation.quote.length;
      }
      const range = rangeForOffsets(root, start, end);
      if (!range) return;
      const prefix = annotation.note.trim() ? 'mw-note' : 'mw-mark';
      const name = `${prefix}-${annotation.tone}`;
      grouped.set(name, [...(grouped.get(name) || []), range]);
    });
    grouped.forEach((ranges, name) => css.highlights?.set(name, new HighlightCtor(...ranges)));
    return () => names.forEach((name) => css.highlights?.delete(name));
  }, [annotations]);
  return null;
}
