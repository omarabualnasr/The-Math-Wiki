import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function MathExpression({ latex, display = false, className = '' }: { latex: string; display?: boolean; className?: string }) {
  let html = '';
  try {
    html = katex.renderToString(latex || '\\,', {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    html = `<span>${escapeHtml(latex)}</span>`;
  }
  return <span className={`math-expression ${display ? 'math-expression-display' : ''} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] || character);
}
