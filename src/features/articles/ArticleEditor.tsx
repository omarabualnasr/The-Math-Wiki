import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Download, Eye, FileUp, Plus, Save, Trash2 } from 'lucide-react';
import { mathBranches, slugify } from '../../data/branches';
import { createEmptyArticle, exportArticleJson, getArticleById, getAllArticles, saveLocalArticle, parseImportedArticle } from '../../engine/articleStorage';
import { ARTICLE_DIFFICULTIES, ARTICLE_LEVELS, BLOCK_LABELS } from '../../types/article';
import type { ArticleBlock, MathArticle } from '../../types/article';

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createBlock(type: ArticleBlock['type']): ArticleBlock {
  const id = newId();
  switch (type) {
    case 'text': return { id, type, heading: 'New section', content: '' };
    case 'latex': return { id, type, heading: 'Equation', latex: 'a + b = c', display: true, explanation: '' };
    case 'image': return { id, type, heading: 'Illustration', src: '', alt: '', caption: '' };
    case 'video': return { id, type, heading: 'Video lesson', url: '', caption: '' };
    case 'graph': return { id, type, heading: 'Interactive graph', expression: 'x^2', xMin: -5, xMax: 5, xLabel: 'x', yLabel: 'y', caption: '' };
    case 'example': return { id, type, heading: 'Worked example', question: '', steps: [''], answer: '' };
    case 'definition': return { id, type, heading: 'Definition', content: '' };
    case 'table': return { id, type, heading: 'Table', headers: ['Column 1', 'Column 2'], rows: [['', '']] };
    case 'exercise': return { id, type, heading: 'Practice', question: '', hint: '', answer: '' };
  }
}

export default function ArticleEditor({ isNew = false }: { isNew?: boolean }) {
  const { articleId = '' } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const initial = useMemo(() => !isNew && articleId ? getArticleById(articleId) : undefined, [articleId, isNew]);
  const [article, setArticle] = useState<MathArticle>(() => initial ? { ...initial, blocks: initial.blocks.map((block) => ({ ...block })) } : createEmptyArticle());
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [importError, setImportError] = useState('');
  const slugConflict = getAllArticles().some((item) => item.slug === article.slug && item.id !== article.id);
  const articleIsValid = Boolean(article.title.trim() && article.slug.trim() && article.blocks.length > 0 && !slugConflict);

  useEffect(() => {
    if (!article.title.trim()) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      try {
        saveLocalArticle(article);
        setSaveState('saved');
      } catch {
        setSaveState('unsaved');
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [article]);

  const updateArticle = <K extends keyof MathArticle>(key: K, value: MathArticle[K]) => {
    setArticle((current) => ({ ...current, [key]: value }));
    setSaveState('unsaved');
  };

  const updateBlock = (index: number, patch: Partial<ArticleBlock>) => {
    setArticle((current) => ({ ...current, blocks: current.blocks.map((block, blockIndex) => blockIndex === index ? ({ ...block, ...patch } as ArticleBlock) : block) }));
    setSaveState('unsaved');
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setArticle((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...current, blocks };
    });
  };

  const addBlock = (type: ArticleBlock['type']) => updateArticle('blocks', [...article.blocks, createBlock(type)]);
  const removeBlock = (index: number) => updateArticle('blocks', article.blocks.filter((_, blockIndex) => blockIndex !== index));

  const persistArticle = () => {
    try {
      saveLocalArticle({ ...article, status: 'draft' });
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('unsaved');
      setImportError('The browser could not save this draft. Check available site storage and try again.');
      return false;
    }
  };

  const preview = () => {
    if (!persistArticle()) return;
    navigate(`/articles/${article.slug || article.id}`);
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseImportedArticle(JSON.parse(await file.text()));
      setArticle(parsed);
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import this file.');
    }
  };

  const updateTitle = (title: string) => {
    setArticle((current) => ({ ...current, title, slug: slugify(title) || current.slug }));
    setSaveState('unsaved');
  };

  if (!isNew && articleId && !initial) {
    return <div className="article-not-found"><h1>Draft not found</h1><p>This page is not available in this browser.</p><Link to="/my-pages">Open My Pages</Link></div>;
  }

  return <div className="editor-page">
    <div className="editor-topline"><Link to="/branches" className="editor-back"><ArrowLeft size={14} /> Back to library</Link><span className={`editor-save-state ${saveState}`}><Check size={13} /> {saveState === 'saved' ? 'Saved locally' : saveState === 'saving' ? 'Saving draft…' : 'Not saved'}</span></div>
    <div className="editor-heading-row"><div><div className="eyebrow">ARTICLE WORKSPACE</div><h1>{isNew ? 'Create a page' : `Edit: ${article.title}`}</h1><p>Build a structured mathematics article using reusable content blocks.</p></div><div className="editor-actions"><button className="button button-secondary" onClick={() => fileInput.current?.click()}><FileUp size={15} /> Import JSON</button><button className="button button-secondary" onClick={preview} disabled={!articleIsValid}><Eye size={15} /> Preview</button><button className="button button-primary" onClick={() => exportArticleJson(article)} disabled={!articleIsValid}><Download size={15} /> Export JSON</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => handleImport(event.target.files?.[0])} /></div></div>
    {importError && <div className="editor-error" role="alert">{importError}</div>}
    {slugConflict && <div className="editor-error" role="alert">This URL slug is already used by another article. Choose a unique slug before previewing or exporting.</div>}

    <section className="editor-card"><div className="editor-card-heading"><div><strong>Article details</strong><span>Metadata shown at the top of the published page.</span></div></div>
      <div className="editor-fields">
        <label className="editor-field editor-field-wide"><span>Title</span><input value={article.title} onChange={(event) => updateTitle(event.target.value)} placeholder="e.g. Addition" /></label>
        <label className="editor-field"><span>URL slug</span><input value={article.slug} onChange={(event) => updateArticle('slug', slugify(event.target.value))} placeholder="article-name" /></label>
        <label className="editor-field"><span>Branch</span><select value={article.branch} onChange={(event) => updateArticle('branch', event.target.value)}>{mathBranches.map((branch) => <option value={branch.id} key={branch.id}>{branch.title}</option>)}</select></label>
        <label className="editor-field"><span>Level</span><select value={article.level} onChange={(event) => updateArticle('level', event.target.value as MathArticle['level'])}>{ARTICLE_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
        <label className="editor-field"><span>Difficulty</span><select value={article.difficulty} onChange={(event) => updateArticle('difficulty', event.target.value as MathArticle['difficulty'])}>{ARTICLE_DIFFICULTIES.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label>
        <label className="editor-field editor-field-wide"><span>Also known as <small>Separate alternatives with commas</small></span><input value={article.aliases.join(', ')} onChange={(event) => updateArticle('aliases', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Alternative terms" /></label>
        <label className="editor-field editor-field-wide"><span>Summary</span><textarea rows={2} value={article.summary} onChange={(event) => updateArticle('summary', event.target.value)} placeholder="A short overview of this article." /></label>
        <label className="editor-field editor-field-wide"><span>Related topics <small>Separate topic slugs or names with commas</small></span><input value={article.relatedTopics.join(', ')} onChange={(event) => updateArticle('relatedTopics', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="addition, sequences and series" /></label>
      </div>
    </section>

    <section className="editor-blocks-section"><div className="editor-card-heading editor-blocks-heading"><div><strong>Article content</strong><span>{article.blocks.length} content blocks · reorder them to control the reading flow.</span></div></div>
      {article.blocks.map((block, index) => <BlockEditor key={block.id} block={block} index={index} count={article.blocks.length} onUpdate={(patch) => updateBlock(index, patch)} onMove={moveBlock} onRemove={removeBlock} />)}
      <div className="add-block-panel"><div><strong>Add a content block</strong><span>Choose a block type to extend the article.</span></div><div className="add-block-grid">{(Object.keys(BLOCK_LABELS) as ArticleBlock['type'][]).map((type) => <button key={type} className="add-block-button" onClick={() => addBlock(type)}><Plus size={14} /> {BLOCK_LABELS[type]}</button>)}</div></div>
    </section>
    <div className="editor-bottom-actions"><span>Drafts are stored in this browser. Export JSON to move an article into your GitHub repository.</span><button className="button button-primary" onClick={persistArticle} disabled={!article.title.trim() || !article.slug.trim()}> <Save size={15} /> Save draft</button></div>
  </div>;
}

function BlockEditor({ block, index, count, onUpdate, onMove, onRemove }: { block: ArticleBlock; index: number; count: number; onUpdate: (patch: Partial<ArticleBlock>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (index: number) => void }) {
  const [imageWarning, setImageWarning] = useState('');
  const fields = block as ArticleBlock & { content?: string; latex?: string; explanation?: string; src?: string; alt?: string; caption?: string; url?: string; expression?: string; xMin?: number; xMax?: number; xLabel?: string; yLabel?: string; question?: string; answer?: string; hint?: string; steps?: string[]; headers?: string[]; rows?: string[][]; display?: boolean };
  const uploadImage = (file?: File) => {
    setImageWarning('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageWarning('Use a PNG, JPEG, WebP or GIF image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setImageWarning('Keep uploaded images under 1 MB so local drafts remain lightweight.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpdate({ src: String(reader.result) } as Partial<ArticleBlock>);
    reader.onerror = () => setImageWarning('This image could not be read. Try another file.');
    reader.readAsDataURL(file);
  };
  return <section className="block-editor-card">
    <div className="block-editor-head"><div className="block-editor-type"><span className="block-number">{String(index + 1).padStart(2, '0')}</span><strong>{BLOCK_LABELS[block.type]}</strong></div><div className="block-editor-actions"><button title="Move up" aria-label="Move block up" disabled={index === 0} onClick={() => onMove(index, -1)}><ArrowUp size={14} /></button><button title="Move down" aria-label="Move block down" disabled={index === count - 1} onClick={() => onMove(index, 1)}><ArrowDown size={14} /></button><button title="Delete block" aria-label="Delete block" onClick={() => onRemove(index)}><Trash2 size={14} /></button></div></div>
    <div className="block-editor-fields">
      <label className="editor-field"><span>Section heading <small>Optional; appears in page navigation</small></span><input value={block.heading || ''} onChange={(event) => onUpdate({ heading: event.target.value })} placeholder="Section heading" /></label>
      {block.type === 'text' && <label className="editor-field"><span>Text</span><textarea rows={5} value={fields.content || ''} onChange={(event) => onUpdate({ content: event.target.value } as Partial<ArticleBlock>)} placeholder="Write the explanation..." /></label>}
      {block.type === 'definition' && <label className="editor-field"><span>Definition</span><textarea rows={3} value={fields.content || ''} onChange={(event) => onUpdate({ content: event.target.value } as Partial<ArticleBlock>)} /></label>}
      {block.type === 'latex' && <><label className="editor-field"><span>LaTeX expression</span><textarea rows={2} className="latex-input" value={fields.latex || ''} onChange={(event) => onUpdate({ latex: event.target.value } as Partial<ArticleBlock>)} placeholder="\\sum_{i=1}^{n} a_i" /></label><label className="editor-field"><span>Explanation</span><textarea rows={2} value={fields.explanation || ''} onChange={(event) => onUpdate({ explanation: event.target.value } as Partial<ArticleBlock>)} /></label><label className="editor-checkbox"><input type="checkbox" checked={fields.display !== false} onChange={(event) => onUpdate({ display: event.target.checked } as Partial<ArticleBlock>)} /> Display as a centered equation</label></>}
      {block.type === 'image' && <><label className="editor-field"><span>Image URL or relative asset path</span><input value={fields.src || ''} onChange={(event) => onUpdate({ src: event.target.value } as Partial<ArticleBlock>)} placeholder="images/diagram.png" /></label><label className="editor-field"><span>Upload an image <small>PNG, JPEG, WebP or GIF · maximum 1 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadImage(event.target.files?.[0])} /></label>{imageWarning && <div className="editor-inline-warning">{imageWarning}</div>}{fields.src && <img className="editor-image-preview" src={fields.src} alt={fields.alt || 'Image preview'} />}<label className="editor-field"><span>Alternative text</span><input value={fields.alt || ''} onChange={(event) => onUpdate({ alt: event.target.value } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Caption</span><input value={fields.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value } as Partial<ArticleBlock>)} /></label></>}
      {block.type === 'video' && <><label className="editor-field"><span>Video URL</span><input value={fields.url || ''} onChange={(event) => onUpdate({ url: event.target.value } as Partial<ArticleBlock>)} placeholder="https://www.youtube.com/watch?v=..." /></label><label className="editor-field"><span>Caption</span><input value={fields.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value } as Partial<ArticleBlock>)} /></label></>}
      {block.type === 'graph' && <><label className="editor-field"><span>Expression in x</span><input className="latex-input" value={fields.expression || ''} onChange={(event) => onUpdate({ expression: event.target.value } as Partial<ArticleBlock>)} placeholder="x^2" /></label><div className="editor-inline-fields"><label className="editor-field"><span>Minimum x</span><input type="number" value={fields.xMin ?? -5} onChange={(event) => onUpdate({ xMin: Number(event.target.value) } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Maximum x</span><input type="number" value={fields.xMax ?? 5} onChange={(event) => onUpdate({ xMax: Number(event.target.value) } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Horizontal label</span><input value={fields.xLabel || 'x'} onChange={(event) => onUpdate({ xLabel: event.target.value } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Vertical label</span><input value={fields.yLabel || 'y'} onChange={(event) => onUpdate({ yLabel: event.target.value } as Partial<ArticleBlock>)} /></label></div><label className="editor-field"><span>Caption</span><input value={fields.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value } as Partial<ArticleBlock>)} /></label></>}
      {block.type === 'example' && <><label className="editor-field"><span>Question</span><textarea rows={2} value={fields.question || ''} onChange={(event) => onUpdate({ question: event.target.value } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Steps <small>One step per line</small></span><textarea rows={4} value={(fields.steps || []).join('\n')} onChange={(event) => onUpdate({ steps: event.target.value.split('\n') } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Answer</span><textarea rows={2} value={fields.answer || ''} onChange={(event) => onUpdate({ answer: event.target.value } as Partial<ArticleBlock>)} /></label></>}
      {block.type === 'table' && <><label className="editor-field"><span>Column headings <small>Separate with commas</small></span><input value={(fields.headers || []).join(', ')} onChange={(event) => { const headers = event.target.value.split(',').map((item) => item.trim()); onUpdate({ headers, rows: (fields.rows || []).map((row) => headers.map((_, i) => row[i] || '')) } as Partial<ArticleBlock>); }} /></label><label className="editor-field"><span>Rows <small>One row per line; separate cells with |</small></span><textarea rows={4} value={(fields.rows || []).map((row) => row.join(' | ')).join('\n')} onChange={(event) => onUpdate({ rows: event.target.value.split('\n').map((row) => row.split('|').map((cell) => cell.trim())) } as Partial<ArticleBlock>)} /></label></>}
      {block.type === 'exercise' && <><label className="editor-field"><span>Question</span><textarea rows={2} value={fields.question || ''} onChange={(event) => onUpdate({ question: event.target.value } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Hint</span><input value={fields.hint || ''} onChange={(event) => onUpdate({ hint: event.target.value } as Partial<ArticleBlock>)} /></label><label className="editor-field"><span>Answer</span><textarea rows={2} value={fields.answer || ''} onChange={(event) => onUpdate({ answer: event.target.value } as Partial<ArticleBlock>)} /></label></>}
    </div>
  </section>;
}
