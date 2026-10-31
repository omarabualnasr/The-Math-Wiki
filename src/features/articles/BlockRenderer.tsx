import { useMemo, useState } from 'react';
import { ChevronDown, Copy, Download, ExternalLink, FileText, Info, Lightbulb, TriangleAlert, Play } from 'lucide-react';
import type { ArticleBlock, StatementBlockType } from '../../types/article';
import type { ArticleReferenceTarget } from '../../engine/articleReferences';
import MathExpression from './MathExpression';
import GraphBlock from './GraphBlock';
import { articleBlockToText, copyText } from '../../engine/readerTools';
import { evaluateMathExpression, formatNumber } from '../../engine/mathEngine';

function paragraphs(content: string) {
  return content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph.split('\n').map((line, lineIndex, lines) => <span key={lineIndex}>{line}{lineIndex < lines.length - 1 && <br />}</span>)}</p>);
}

function isStatementBlock(block: ArticleBlock): block is Extract<ArticleBlock, { type: StatementBlockType }> {
  return block.type === 'theorem'
    || block.type === 'lemma'
    || block.type === 'corollary'
    || block.type === 'proposition'
    || block.type === 'axiom';
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

function safeResourceUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^(\/|\.\.?\/|#)/.test(trimmed)) return trimmed;
  return safeExternalUrl(trimmed);
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

interface BlockRendererProps {
  block: ArticleBlock;
  onCopy?: (message: string) => void;
  numberLabel?: string;
  references?: Record<string, ArticleReferenceTarget>;
}

export default function BlockRenderer({ block, onCopy, numberLabel, references = {} }: BlockRendererProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const copyBlock = async () => {
    try { await copyText(articleBlockToText(block)); onCopy?.('Block copied'); }
    catch { onCopy?.('Could not copy this block'); }
  };
  const referenced = 'targetLabel' in block && block.targetLabel ? references[block.targetLabel] : undefined;
  const statement = isStatementBlock(block) ? block : null;

  return <section className="article-block" id={block.id} data-block-id={block.id} data-annotation-content>
    {(block.heading || onCopy) && <div className="article-block-heading-row">{block.heading ? <h2 className="article-section-heading">{block.heading}</h2> : <span />} {onCopy && <button className="block-copy-button" onClick={copyBlock} aria-label={`Copy ${block.heading || 'content'} block`} title="Copy this block"><Copy size={13}/><span>Copy block</span></button>}</div>}
    <div className="article-block-content">
      {block.type === 'text' && <div className="article-prose">{paragraphs(block.content)}</div>}
      {block.type === 'definition' && <div className="definition-panel"><span className="definition-label">DEFINITION</span><p>{block.content}</p></div>}
      {block.type === 'latex' && <div className="latex-panel">{block.explanation && <p className="article-prose latex-explanation">{block.explanation}</p>}<div className="numbered-equation"><MathExpression latex={block.latex} display={block.display} />{numberLabel && <span className="equation-number">({numberLabel.replace('Equation ', '')})</span>}</div></div>}
      {block.type === 'image' && <figure className="article-figure">{safeImageSource(block.src) ? <img src={safeImageSource(block.src) || undefined} alt={block.alt} loading="lazy" /> : <div className="image-missing">Image source unavailable or unsupported.</div>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure>}
      {block.type === 'video' && <div className="video-block">{videoEmbed(block.url) ? <iframe src={videoEmbed(block.url) || undefined} title={block.caption || 'Educational video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div className="video-link-placeholder"><Play size={20} /><span>{block.url ? 'External video link' : 'Add a video URL in the editor'}</span>{safeExternalUrl(block.url) && <a href={safeExternalUrl(block.url) || undefined} target="_blank" rel="noreferrer">Open video <ExternalLink size={13} /></a>}</div>}{block.caption && <p className="block-caption">{block.caption}</p>}</div>}
      {block.type === 'graph' && <GraphBlock block={block} />}
      {block.type === 'example' && <div className="example-panel"><div className="example-label">WORKED EXAMPLE</div><p className="example-question">{block.question}</p><ol>{block.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><div className="example-answer"><strong>Answer</strong><span>{block.answer}</span></div></div>}
      {block.type === 'table' && <div className="article-table-wrap"><table className="article-table"><thead><tr>{block.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}
      {block.type === 'exercise' && <div className="exercise-panel"><div className="example-label">PRACTICE</div><p>{block.question}</p>{block.hint && <details><summary>Show hint <ChevronDown size={13} /></summary><p>{block.hint}</p></details>}{block.answer && <div className="exercise-answer-area"><button className="button button-secondary" onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? 'Hide answer' : 'Reveal answer'}</button>{showAnswer && <p className="exercise-answer">{block.answer}</p>}</div>}</div>}
      {statement && <div className={`statement-panel statement-${statement.type}`}><div className="statement-panel-title"><strong>{statement.type.charAt(0).toUpperCase() + statement.type.slice(1)}{numberLabel ? ` ${numberLabel.split(' ').slice(-1)[0]}` : ''}</strong>{'attribution' in statement && statement.attribution && <span>{statement.attribution}</span>}</div><div className="statement-panel-content">{paragraphs(statement.statement)}</div></div>}
      {block.type === 'proof' && <div className="proof-panel"><div className="proof-panel-title">Proof{referenced ? ` of ${referenced.display}` : block.targetLabel ? ` of ${block.targetLabel}` : ''}</div><div className="article-prose">{paragraphs(block.content)}</div>{block.conclusion && <div className="proof-conclusion">{block.conclusion}<span>∎</span></div>}</div>}
      {block.type === 'callout' && <aside className={`article-callout callout-${block.variant}`}><span className="callout-icon">{block.variant === 'warning' ? <TriangleAlert size={16}/> : block.variant === 'tip' ? <Lightbulb size={16}/> : <Info size={16}/>}</span><div><strong>{block.variant.charAt(0).toUpperCase() + block.variant.slice(1)}</strong>{paragraphs(block.content)}</div></aside>}
      {block.type === 'comparison' && <div className="comparison-block"><section><h3>{block.leftTitle}</h3>{paragraphs(block.leftContent)}</section><section><h3>{block.rightTitle}</h3>{paragraphs(block.rightContent)}</section></div>}
      {block.type === 'steps' && <ol className="method-steps">{block.steps.map((step, index) => <li key={index}><span className="method-step-number">{index + 1}</span><div>{paragraphs(step)}</div></li>)}</ol>}
      {block.type === 'disclosure' && <details className="article-disclosure" open={block.initiallyOpen}><summary>{block.summary}<ChevronDown size={15}/></summary><div className="article-prose">{paragraphs(block.content)}</div></details>}
      {block.type === 'citation' && <div className="citation-block"><FileText size={15}/><div><p>{block.citation}</p><span>{[block.author, block.year].filter(Boolean).join(' · ')}</span>{safeResourceUrl(block.url || '') && <a href={safeResourceUrl(block.url || '') || undefined} target="_blank" rel="noreferrer">Open source <ExternalLink size={12}/></a>}</div></div>}
      {block.type === 'resource' && <div className="resource-block"><div className="resource-block-icon"><Download size={16}/></div><div><strong>{block.label}</strong>{block.description && <p>{block.description}</p>}</div>{safeResourceUrl(block.url) ? <a href={safeResourceUrl(block.url) || undefined} target={block.resourceType === 'web' ? '_blank' : undefined} rel="noreferrer" download={block.resourceType !== 'web'}>{block.resourceType === 'web' ? 'Open resource' : 'Download'} <ExternalLink size={12}/></a> : <span className="resource-unavailable">Link unavailable</span>}</div>}
      {block.type === 'reference' && <p className="cross-reference">{block.prefix || ''}{referenced ? <a href={`#${referenced.id}`}>{referenced.display}</a> : <span className="missing-reference">{block.targetLabel}</span>}{block.suffix || ''}</p>}
      {block.type === 'parameter' && <ParameterBlockView block={block}/>}
    </div>
  </section>;
}

function ParameterBlockView({ block }: { block: Extract<ArticleBlock, { type: 'parameter' }> }) {
  const [value, setValue] = useState(block.initial);
  const result = useMemo(() => {
    try { return { value: formatNumber(evaluateMathExpression(block.expression, { [block.parameter]: value })), error: '' }; }
    catch (error) { return { value: '', error: error instanceof Error ? error.message : 'Expression could not be evaluated.' }; }
  }, [block, value]);
  return <div className="parameter-block"><div className="parameter-expression">{block.expression}</div><label><span>{block.parameter} = <strong>{formatNumber(value)}</strong></span><input type="range" min={block.min} max={block.max} step={block.step} value={value} onChange={(event) => setValue(Number(event.target.value))}/></label><div className="parameter-result"><span>Result</span><strong>{result.error || result.value}</strong></div>{block.caption && <p>{block.caption}</p>}</div>;
}
