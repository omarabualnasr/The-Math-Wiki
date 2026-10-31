import { useState } from 'react';
import { ChevronDown, Copy, ExternalLink, Play } from 'lucide-react';
import type { ArticleBlock } from '../../types/article';
import MathExpression from './MathExpression';
import GraphBlock from './GraphBlock';
import { articleBlockToText, copyText } from '../../engine/readerTools';

function paragraphs(content: string) {
  return content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph.split('\n').map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < paragraph.split('\n').length - 1 && <br />}</span>)}</p>);
}

function safeImageSource(source: string): string | null {
  const value = source.trim();
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return value;
  if (/^(https?:\/\/|\/|\.\.?\/|images\/)/i.test(value)) return value;
  return null;
}

function safeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch { return null; }
}

function videoEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'www.youtube.com' || host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const id = parsed.searchParams.get('v') || '';
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com' || host === 'www.vimeo.com' || host.endsWith('.vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop() || '';
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { return null; }
  return null;
}

export default function BlockRenderer({ block, onCopy }: { block: ArticleBlock; onCopy?: (message: string) => void }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const copyBlock = async () => {
    try { await copyText(articleBlockToText(block)); onCopy?.('Block copied'); }
    catch { onCopy?.('Could not copy this block'); }
  };
  return <section className="article-block" id={block.id} data-block-id={block.id} data-annotation-content>
    {(block.heading || onCopy) && <div className="article-block-heading-row">{block.heading ? <h2 className="article-section-heading">{block.heading}</h2> : <span />} {onCopy && <button className="block-copy-button" onClick={copyBlock} aria-label={`Copy ${block.heading || 'content'} block`} title="Copy this block"><Copy size={13}/><span>Copy block</span></button>}</div>}
    <div className="article-block-content">
      {block.type === 'text' && <div className="article-prose">{paragraphs(block.content)}</div>}
      {block.type === 'definition' && <div className="definition-panel"><span className="definition-label">DEFINITION</span><p>{block.content}</p></div>}
      {block.type === 'latex' && <div className="latex-panel">{block.explanation && <p className="article-prose latex-explanation">{block.explanation}</p>}<MathExpression latex={block.latex} display={block.display} /></div>}
      {block.type === 'image' && <figure className="article-figure">{safeImageSource(block.src) ? <img src={safeImageSource(block.src) || undefined} alt={block.alt} loading="lazy" /> : <div className="image-missing">Image source unavailable or unsupported.</div>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure>}
      {block.type === 'video' && <div className="video-block">{videoEmbed(block.url) ? <iframe src={videoEmbed(block.url) || undefined} title={block.caption || 'Educational video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div className="video-link-placeholder"><Play size={20} /><span>{block.url ? 'External video link' : 'Add a video URL in the editor'}</span>{safeExternalUrl(block.url) && <a href={safeExternalUrl(block.url) || undefined} target="_blank" rel="noreferrer">Open video <ExternalLink size={13} /></a>}</div>}{block.caption && <p className="block-caption">{block.caption}</p>}</div>}
      {block.type === 'graph' && <GraphBlock block={block} />}
      {block.type === 'example' && <div className="example-panel"><div className="example-label">WORKED EXAMPLE</div><p className="example-question">{block.question}</p><ol>{block.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><div className="example-answer"><strong>Answer</strong><span>{block.answer}</span></div></div>}
      {block.type === 'table' && <div className="article-table-wrap"><table className="article-table"><thead><tr>{block.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}
      {block.type === 'exercise' && <div className="exercise-panel"><div className="example-label">PRACTICE</div><p>{block.question}</p>{block.hint && <details><summary>Show hint <ChevronDown size={13} /></summary><p>{block.hint}</p></details>}{block.answer && <div className="exercise-answer-area"><button className="button button-secondary" onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? 'Hide answer' : 'Reveal answer'}</button>{showAnswer && <p className="exercise-answer">{block.answer}</p>}</div>}</div>}
    </div>
  </section>;
}
