import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, CircleAlert, Clock3, CopyPlus,
  Download, Eye, FileUp, GripVertical, History, Images, LayoutTemplate, Plus,
  Redo2, Save, Sigma, Trash2, Undo2, X,
} from 'lucide-react';
import { mathBranches, slugify } from '../../data/branches';
import {
  createEmptyArticle, exportArticleJson, getArticleById, getAllArticles,
  saveLocalArticle, parseImportedArticle, getArticleBySlug,
} from '../../engine/articleStorage';
import { createArticleFork } from '../../engine/articleForking';
import { saveArticleRevision, getArticleRevisions, restoreArticleRevision } from '../../engine/articleHistory';
import { getArticlePublishingIssues } from '../../engine/articlePublishing';
import { ARTICLE_DIFFICULTIES, ARTICLE_LEVELS, BLOCK_LABELS } from '../../types/article';
import type { ArticleBlock, MathArticle, StatementBlockType } from '../../types/article';
import { validateArticle } from '../../engine/articleValidation';
import MathExpression from './MathExpression';

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createBlock(type: ArticleBlock['type']): ArticleBlock {
  const id = newId();
  switch (type) {
    case 'text': return { id, type, heading: 'New section', content: '' };
    case 'latex': return { id, type, heading: 'Equation', latex: 'a + b = c', display: true, explanation: '', numbered: false };
    case 'image': return { id, type, heading: 'Illustration', src: '', alt: '', caption: '', assetName: 'New image' };
    case 'video': return { id, type, heading: 'Video lesson', url: '', caption: '' };
    case 'graph': return { id, type, heading: 'Interactive graph', expression: 'x^2', xMin: -5, xMax: 5, xLabel: 'x', yLabel: 'y', caption: '' };
    case 'example': return { id, type, heading: 'Worked example', question: '', steps: [''], answer: '' };
    case 'definition': return { id, type, heading: 'Definition', content: '' };
    case 'table': return { id, type, heading: 'Table', headers: ['Column 1', 'Column 2'], rows: [['', '']] };
    case 'exercise': return { id, type, heading: 'Practice', question: '', hint: '', answer: '' };
    case 'theorem':
    case 'lemma':
    case 'corollary':
    case 'proposition':
    case 'axiom': return { id, type, heading: `${type.charAt(0).toUpperCase()}${type.slice(1)}`, statement: '', label: '', attribution: '' };
    case 'proof': return { id, type, heading: 'Proof', content: '', targetLabel: '', conclusion: '∎' };
    case 'callout': return { id, type, heading: 'Important note', variant: 'note', content: '' };
    case 'comparison': return { id, type, heading: 'Comparison', leftTitle: 'First concept', leftContent: '', rightTitle: 'Second concept', rightContent: '' };
    case 'steps': return { id, type, heading: 'Step-by-step method', steps: [''] };
    case 'disclosure': return { id, type, heading: 'Additional explanation', summary: 'Show explanation', content: '', initiallyOpen: false };
    case 'citation': return { id, type, heading: 'Reference', citation: '', url: '', author: '', year: '' };
    case 'resource': return { id, type, heading: 'Further reading', label: 'Open resource', url: '', description: '', resourceType: 'web' };
    case 'reference': return { id, type, heading: 'Cross-reference', targetLabel: '', prefix: 'See ', suffix: '.' };
    case 'parameter': return { id, type, heading: 'Interactive parameter', expression: 'a^2 + 1', parameter: 'a', min: -5, max: 5, step: 0.1, initial: 1, caption: '' };
  }
}

function cloneArticle(article: MathArticle): MathArticle {
  return JSON.parse(JSON.stringify(article)) as MathArticle;
}

interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  blockCount: number;
  blocks: () => ArticleBlock[];
}

const articleTemplates: TemplateDefinition[] = [
  {
    id: 'concept', blockCount: 4, title: 'Mathematical concept', description: 'Introduction, definition, example and practice.',
    blocks: () => [
      { ...createBlock('text'), heading: 'Introduction', content: 'Introduce the concept and explain why it is useful.' },
      { ...createBlock('definition'), content: 'Write a precise definition.' },
      { ...createBlock('example'), question: 'State a representative problem.', steps: ['Identify the known information.', 'Apply the relevant mathematical rule.', 'Simplify the result.'], answer: 'Write the final answer.' },
      { ...createBlock('exercise'), question: 'Add a practice question.', hint: 'Add a useful hint.', answer: 'Add the worked answer.' },
    ],
  },
  {
    id: 'theorem', blockCount: 4, title: 'Theorem and proof', description: 'Formal statement, assumptions and proof.',
    blocks: () => [
      { ...createBlock('text'), heading: 'Context', content: 'Introduce the result and its mathematical context.' },
      { ...createBlock('theorem'), statement: 'State the theorem precisely.', label: 'thm:main' },
      { ...createBlock('proof'), content: 'Write the proof in logically ordered paragraphs.', targetLabel: 'thm:main', conclusion: '∎' },
      { ...createBlock('corollary'), statement: 'State a direct consequence.', label: 'cor:main' },
    ],
  },
  {
    id: 'formula', blockCount: 4, title: 'Formula reference', description: 'Formula, variable definitions, worked use and notes.',
    blocks: () => [
      { ...createBlock('definition'), heading: 'Formula', content: 'Describe what the formula calculates.' },
      { ...createBlock('latex'), heading: 'General form', latex: 'y = mx + b', display: true, numbered: true, label: 'eq:general' },
      { ...createBlock('table'), heading: 'Variables', headers: ['Symbol', 'Meaning'], rows: [['m', 'Slope'], ['b', 'Vertical intercept']] },
      { ...createBlock('example'), heading: 'Worked example', question: 'Substitute known values.', steps: ['Identify each variable.', 'Substitute values.', 'Calculate the result.'], answer: 'State the result.' },
    ],
  },
  {
    id: 'problem', blockCount: 3, title: 'Worked problem', description: 'Problem statement followed by a structured solution.',
    blocks: () => [
      { ...createBlock('text'), heading: 'Problem', content: 'Describe the problem and list the known information.' },
      { ...createBlock('example'), heading: 'Solution', question: 'Write the question here.', steps: ['Step one.', 'Step two.', 'Step three.'], answer: 'Final answer.' },
      { ...createBlock('callout'), heading: 'Key idea', variant: 'tip', content: 'Explain the main idea behind the solution.' },
    ],
  },
  {
    id: 'method', blockCount: 3, title: 'Mathematical method', description: 'Explain a repeatable process with numbered steps.',
    blocks: () => [
      { ...createBlock('text'), heading: 'When to use this method', content: 'Explain the problem types this method addresses.' },
      { ...createBlock('steps'), heading: 'Procedure', steps: ['Prepare the expression or data.', 'Apply the first operation.', 'Simplify and verify the result.'] },
      { ...createBlock('example'), heading: 'Example', question: 'Demonstrate the method.', steps: ['Apply the method.', 'Check the result.'], answer: 'Final result.' },
    ],
  },
  {
    id: 'comparison', blockCount: 3, title: 'Concept comparison', description: 'Compare two ideas using parallel columns.',
    blocks: () => [
      { ...createBlock('text'), heading: 'Overview', content: 'Introduce the concepts and explain why they are compared.' },
      { ...createBlock('comparison'), heading: 'Key differences', leftTitle: 'Concept A', leftContent: 'Explain the first concept.', rightTitle: 'Concept B', rightContent: 'Explain the second concept.' },
      { ...createBlock('callout'), variant: 'important', content: 'Summarize the most important distinction.' },
    ],
  },
  {
    id: 'interactive', blockCount: 4, title: 'Interactive lesson', description: 'Explanations supported by graphs and parameters.',
    blocks: () => [
      { ...createBlock('text'), heading: 'Concept', content: 'Introduce the mathematical relationship.' },
      { ...createBlock('latex'), heading: 'Equation', latex: 'y = ax^2', display: true },
      { ...createBlock('parameter'), heading: 'Explore a parameter', expression: 'a^2 + 1', parameter: 'a', min: -5, max: 5, step: 0.1, initial: 1 },
      { ...createBlock('graph'), heading: 'Visualize the function', expression: 'x^2', xMin: -5, xMax: 5 },
    ],
  },
];

const coreBlockTypes: ArticleBlock['type'][] = ['text', 'definition', 'latex', 'example', 'exercise', 'table', 'image', 'video', 'graph'];
const academicBlockTypes: ArticleBlock['type'][] = ['theorem', 'lemma', 'corollary', 'proposition', 'axiom', 'proof', 'steps'];
const referenceBlockTypes: ArticleBlock['type'][] = ['callout', 'comparison', 'disclosure', 'citation', 'resource', 'reference', 'parameter'];

export default function ArticleEditor({ isNew = false }: { isNew?: boolean }) {
  const { articleId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceSlug = isNew ? searchParams.get('source') : null;
  const sourceArticle = useMemo(() => sourceSlug ? getArticleBySlug(sourceSlug) : undefined, [sourceSlug]);
  const fileInput = useRef<HTMLInputElement>(null);
  const articleRef = useRef<MathArticle>(createEmptyArticle());
  const undoStack = useRef<MathArticle[]>([]);
  const redoStack = useRef<MathArticle[]>([]);
  const dragIndex = useRef<number | null>(null);
  const initial = useMemo(() => !isNew && articleId ? getArticleById(articleId) : undefined, [articleId, isNew]);
  const [article, setArticle] = useState<MathArticle>(() => {
    const next = initial ? cloneArticle(initial) : sourceArticle ? createArticleFork(sourceArticle, getAllArticles().map((item) => item.slug)) : createEmptyArticle();
    articleRef.current = next;
    return next;
  });
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [importError, setImportError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState(() => initial ? getArticleRevisions(initial.id) : []);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [publishingOpen, setPublishingOpen] = useState(true);

  useEffect(() => {
    if (!initial) {
      if (isNew) {
        const next = sourceArticle ? createArticleFork(sourceArticle, getAllArticles().map((item) => item.slug)) : createEmptyArticle();
        articleRef.current = next;
        setArticle(next);
        setHistoryItems([]);
      }
      return;
    }
    const next = cloneArticle(initial);
    articleRef.current = next;
    setArticle(next);
    setHistoryItems(getArticleRevisions(initial.id));
    setSelectedBlockIds([]);
    undoStack.current = [];
    redoStack.current = [];
  }, [initial?.id, isNew, sourceArticle?.id]);

  const commitArticle = useCallback((updater: (current: MathArticle) => MathArticle) => {
    const current = articleRef.current;
    const next = updater(current);
    if (next === current) return;
    undoStack.current = [...undoStack.current.slice(-49), cloneArticle(current)];
    redoStack.current = [];
    articleRef.current = next;
    setArticle(next);
    setSaveState('unsaved');
    setSaveError('');
  }, []);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current = [...redoStack.current, cloneArticle(articleRef.current)].slice(-50);
    articleRef.current = previous;
    setArticle(previous);
    setSaveState('unsaved');
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current = [...undoStack.current, cloneArticle(articleRef.current)].slice(-50);
    articleRef.current = next;
    setArticle(next);
    setSaveState('unsaved');
  }, []);

  const persistArticle = useCallback(() => {
    const current = articleRef.current;
    try {
      saveLocalArticle({ ...current, status: current.status === 'ready' ? 'ready' : 'draft' });
      saveArticleRevision(current);
      setHistoryItems(getArticleRevisions(current.id));
      setSaveState('saved');
      setSaveError('');
      return true;
    } catch (error) {
      setSaveState('unsaved');
      setSaveError(error instanceof Error ? error.message : 'The browser could not save this draft. Export your work before leaving the page.');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!article.title.trim()) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => { persistArticle(); }, 550);
    return () => window.clearTimeout(timer);
  }, [article, persistArticle]);

  useEffect(() => {
    if (saveState === 'saved') return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [saveState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        persistArticle();
      } else if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault(); redo();
      } else if (event.key.toLowerCase() === 'z' && !isTyping) {
        event.preventDefault(); undo();
      } else if (event.key.toLowerCase() === 'y' && !isTyping) {
        event.preventDefault(); redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [persistArticle, redo, undo]);

  const updateArticle = <K extends keyof MathArticle>(key: K, value: MathArticle[K]) => commitArticle((current) => ({ ...current, [key]: value }));
  const updateTitle = (title: string) => commitArticle((current) => ({ ...current, title, slug: slugify(title) || current.slug }));
  const updateBlock = (blockId: string, patch: Partial<ArticleBlock>) => commitArticle((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === blockId ? ({ ...block, ...patch } as ArticleBlock) : block) }));
  const addBlock = (type: ArticleBlock['type']) => commitArticle((current) => ({ ...current, blocks: [...current.blocks, createBlock(type)] }));
  const removeBlock = (blockId: string) => {
    commitArticle((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== blockId) }));
    setSelectedBlockIds((selected) => selected.filter((id) => id !== blockId));
  };
  const reorderBlocks = (from: number, to: number) => commitArticle((current) => {
    if (from < 0 || to < 0 || from >= current.blocks.length || to >= current.blocks.length || from === to) return current;
    const blocks = [...current.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    return { ...current, blocks };
  });
  const moveBlock = (index: number, direction: -1 | 1) => reorderBlocks(index, index + direction);
  const duplicateBlock = (blockId: string) => commitArticle((current) => {
    const index = current.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return current;
    const duplicate = { ...cloneArticle({ ...current, blocks: [current.blocks[index]] }).blocks[0], id: newId() } as ArticleBlock;
    const blocks = [...current.blocks];
    blocks.splice(index + 1, 0, duplicate);
    return { ...current, blocks };
  });
  const toggleSelected = (blockId: string) => setSelectedBlockIds((current) => current.includes(blockId) ? current.filter((id) => id !== blockId) : [...current, blockId]);
  const deleteSelected = () => {
    if (!selectedBlockIds.length) return;
    if (!window.confirm(`Delete ${selectedBlockIds.length} selected content block(s)?`)) return;
    const selected = new Set(selectedBlockIds);
    commitArticle((current) => ({ ...current, blocks: current.blocks.filter((block) => !selected.has(block.id)) }));
    setSelectedBlockIds([]);
  };
  const duplicateSelected = () => {
    if (!selectedBlockIds.length) return;
    commitArticle((current) => {
      const selected = new Set(selectedBlockIds);
      const duplicates = current.blocks.filter((block) => selected.has(block.id)).map((block) => ({ ...block, id: newId() } as ArticleBlock));
      const lastIndex = Math.max(...current.blocks.map((block, index) => selected.has(block.id) ? index : -1));
      const blocks = [...current.blocks];
      blocks.splice(lastIndex + 1, 0, ...duplicates);
      return { ...current, blocks };
    });
    setSelectedBlockIds([]);
  };

  const moveSelected = (direction: -1 | 1) => {
    if (!selectedBlockIds.length) return;
    const selected = new Set(selectedBlockIds);
    commitArticle((current) => {
      const blocks = [...current.blocks];
      if (direction < 0) {
        for (let index = 1; index < blocks.length; index += 1) {
          if (selected.has(blocks[index].id) && !selected.has(blocks[index - 1].id)) {
            [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
          }
        }
      } else {
        for (let index = blocks.length - 2; index >= 0; index -= 1) {
          if (selected.has(blocks[index].id) && !selected.has(blocks[index + 1].id)) {
            [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
          }
        }
      }
      return blocks.every((block, index) => block === current.blocks[index]) ? current : { ...current, blocks };
    });
  };

  const applyTemplate = (template: TemplateDefinition) => {
    if (article.blocks.some((block) => hasBlockContent(block)) && !window.confirm(`Replace the current ${article.blocks.length} block(s) with the “${template.title}” template?`)) return;
    commitArticle((current) => ({ ...current, blocks: template.blocks() }));
    setTemplatesOpen(false);
    setSelectedBlockIds([]);
  };

  const validation = useMemo(() => validateArticle(article), [article]);
  const publishingIssues = useMemo(() => getArticlePublishingIssues(article), [article]);
  const errorCount = publishingIssues.filter((issue) => issue.severity === 'error').length;
  const warningCount = publishingIssues.filter((issue) => issue.severity === 'warning').length;
  const slugConflict = getAllArticles().some((item) => item.slug === article.slug && item.id !== article.id);
  const articleIsValid = Boolean(article.title.trim() && article.slug.trim() && article.blocks.length > 0 && !slugConflict && validation.valid);
  const canPublish = articleIsValid && errorCount === 0;

  const preview = () => {
    if (!persistArticle()) return;
    navigate(`/articles/${article.slug || article.id}`);
  };

  const leaveEditor = () => {
    if (saveState !== 'saved' && !persistArticle()) {
      const leaveAnyway = window.confirm('This draft could not be saved. Leave the editor and risk losing the latest changes?');
      if (!leaveAnyway) return;
    }
    navigate('/branches');
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseImportedArticle(JSON.parse(await file.text()));
      commitArticle(() => parsed);
      setImportError('');
      setSaveError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import this file.');
    }
  };

  const exportPublishable = () => {
    if (!canPublish) {
      setPublishingOpen(true);
      setSaveError('Resolve all publishing errors before exporting a publish-ready article.');
      return;
    }
    exportArticleJson({ ...article, status: 'ready' });
  };

  const markReady = () => {
    if (!canPublish) {
      setPublishingOpen(true);
      return;
    }
    updateArticle('status', 'ready');
    setPublishingOpen(true);
  };

  const restoreRevision = (revisionId: string) => {
    const restored = restoreArticleRevision(article.id, revisionId);
    if (!restored) return;
    if (!window.confirm('Restore this version? Your current editor content will be placed in undo history.')) return;
    commitArticle(() => restored);
    setHistoryOpen(false);
  };

  const addImageBlock = () => {
    addBlock('image');
    setMediaOpen(false);
  };

  if (!isNew && articleId && !initial) {
    return <div className="article-not-found"><h1>Draft not found</h1><p>This page is not available in this browser.</p><Link to="/my-pages">Open My Pages</Link></div>;
  }

  return <div className="editor-page editor-page-advanced">
    <div className="editor-topline"><button type="button" className="editor-back editor-back-button" onClick={leaveEditor}><ArrowLeft size={14} /> Back to library</button><span className={`editor-save-state ${saveState}`}><Check size={13} /> {saveState === 'saved' ? 'Saved locally' : saveState === 'saving' ? 'Saving draft…' : 'Not saved'}</span></div>
    {saveError && <div className="editor-error" role="alert">{saveError}</div>}
    <div className="editor-heading-row"><div><div className="eyebrow">ARTICLE WORKSPACE</div><h1>{isNew ? (sourceArticle ? 'Create an editable copy' : 'Create a page') : `Edit: ${article.title}`}</h1><p>{sourceArticle ? `A separate draft copied from “${sourceArticle.title}”. The published source remains unchanged.` : 'Author, structure, validate and prepare mathematical articles for publication.'}</p></div><div className="editor-actions editor-actions-wrap">
      <button className="button button-secondary" onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl/Cmd + Z)"><Undo2 size={14}/> Undo</button>
      <button className="button button-secondary" onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl/Cmd + Shift + Z)"><Redo2 size={14}/> Redo</button>
      <button className="button button-secondary" onClick={() => setHistoryOpen(true)}><History size={14}/> History</button>
      <button className="button button-secondary" onClick={() => setMediaOpen(true)}><Images size={14}/> Media</button>
      <button className="button button-secondary" onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={14}/> Templates</button>
      <button className="button button-secondary" onClick={() => fileInput.current?.click()}><FileUp size={14}/> Import</button>
      <button className="button button-secondary" onClick={preview} disabled={!articleIsValid}><Eye size={14}/> Preview</button>
      <button className="button button-primary" onClick={exportPublishable} disabled={!canPublish}><Download size={14}/> Export publish-ready</button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { void handleImport(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
    </div></div>
    {importError && <div className="editor-error" role="alert">{importError}</div>}
    {slugConflict && <div className="editor-error" role="alert">This URL slug is already used by another article. Choose a unique slug before previewing or exporting.</div>}
    {!validation.valid && validation.issues.length > 0 && <div className="editor-error" role="status">Article validation: {validation.issues[0].path} — {validation.issues[0].message}</div>}

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

    <section className="publishing-manager editor-card">
      <button className="publishing-manager-head" onClick={() => setPublishingOpen((value) => !value)} aria-expanded={publishingOpen}>
        <span><strong>Publishing preflight</strong><small>Validate your article before exporting it to the repository.</small></span>
        <span className="publishing-manager-status">{errorCount ? `${errorCount} errors` : 'No blocking errors'} · {warningCount} warnings</span>
      </button>
      {publishingOpen && <div className="publishing-manager-body">
        <div className="publishing-status-row"><label>Article status<select value={article.status} onChange={(event) => updateArticle('status', event.target.value as MathArticle['status'])}><option value="draft">Draft</option><option value="ready">Ready to publish</option></select></label><span className={`publish-status-pill ${canPublish ? 'is-ready' : 'needs-work'}`}>{canPublish ? 'Ready for export' : 'Needs attention'}</span></div>
        <div className="publishing-issue-list">{publishingIssues.length ? publishingIssues.map((issue, index) => <div className={`publishing-issue ${issue.severity}`} key={`${issue.path}-${index}`}><span>{issue.severity === 'error' ? <CircleAlert size={13}/> : <Clock3 size={13}/>}</span><div><strong>{issue.path}</strong><p>{issue.message}</p></div></div>) : <div className="publishing-clean"><Check size={15}/> Article passes the publication checks.</div>}</div>
        {slugConflict && <div className="publishing-issue error"><CircleAlert size={13}/><div><strong>URL slug</strong><p>This slug is already used by another article.</p></div></div>}
        <div className="publishing-actions"><button className="button button-secondary" onClick={() => { void persistArticle(); }}>Save draft</button><button className="button button-secondary" onClick={markReady} disabled={errorCount > 0}>Mark ready</button><button className="button button-primary" onClick={exportPublishable} disabled={!canPublish || slugConflict}><Download size={14}/> Export JSON</button></div>
      </div>}
    </section>

    <section className="editor-blocks-section"><div className="editor-card-heading editor-blocks-heading"><div><strong>Article content</strong><span>{article.blocks.length} content blocks · select, duplicate, reorder or drag blocks to control the reading flow.</span></div><span className="editor-shortcuts">Ctrl/Cmd + S save · Ctrl/Cmd + Z undo</span></div>
      {selectedBlockIds.length > 0 && <div className="bulk-block-toolbar"><span>{selectedBlockIds.length} selected</span><button onClick={() => moveSelected(-1)}><ArrowUp size={13}/> Move up</button><button onClick={() => moveSelected(1)}><ArrowDown size={13}/> Move down</button><button onClick={duplicateSelected}><CopyPlus size={13}/> Duplicate selected</button><button className="bulk-danger" onClick={deleteSelected}><Trash2 size={13}/> Delete selected</button><button onClick={() => setSelectedBlockIds([])}><X size={13}/> Clear</button></div>}
      {article.blocks.map((block, index) => <BlockEditor key={block.id} block={block} index={index} count={article.blocks.length} selected={selectedBlockIds.includes(block.id)} onSelect={() => toggleSelected(block.id)} onUpdate={(patch) => updateBlock(block.id, patch)} onMove={moveBlock} onRemove={() => removeBlock(block.id)} onDuplicate={() => duplicateBlock(block.id)} onDragStart={() => { dragIndex.current = index; }} onDrop={() => { if (dragIndex.current !== null) reorderBlocks(dragIndex.current, index); dragIndex.current = null; }} />)}
      <div className="add-block-panel"><div><strong>Add a content block</strong><span>Core content, academic structures and reference components.</span></div>
        <BlockTypeGroup title="Core content" types={coreBlockTypes} onAdd={addBlock}/>
        <BlockTypeGroup title="Academic structures" types={academicBlockTypes} onAdd={addBlock}/>
        <BlockTypeGroup title="Reference & interactive" types={referenceBlockTypes} onAdd={addBlock}/>
      </div>
    </section>
    <div className="editor-bottom-actions"><span>Drafts and revisions are stored in this browser. Export JSON to publish through your GitHub repository.</span><button className="button button-primary" onClick={persistArticle} disabled={!article.title.trim() || !article.slug.trim()}><Save size={15}/> Save draft</button></div>

    {historyOpen && <RevisionHistoryDialog article={article} items={historyItems} onClose={() => setHistoryOpen(false)} onRestore={restoreRevision}/>}
    {mediaOpen && <MediaManagerDialog article={article} onClose={() => setMediaOpen(false)} onUpdateBlock={updateBlock} onRemoveBlock={removeBlock} onAddImage={addImageBlock}/>}
    {templatesOpen && <TemplateDialog onClose={() => setTemplatesOpen(false)} onApply={applyTemplate}/>}
  </div>;
}

function hasBlockContent(block: ArticleBlock): boolean {
  if (block.type === 'text' || block.type === 'definition' || block.type === 'proof' || block.type === 'callout') return Boolean(block.content.trim());
  if (block.type === 'latex') return Boolean(block.latex.trim());
  if (block.type === 'image') return Boolean(block.src.trim());
  if (block.type === 'video') return Boolean(block.url.trim());
  if (block.type === 'graph') return Boolean(block.expression.trim());
  if (block.type === 'example') return Boolean(block.question.trim() || block.answer.trim());
  if (block.type === 'table') return block.rows.some((row) => row.some((cell) => cell.trim()));
  if (block.type === 'exercise') return Boolean(block.question.trim());
  if (isStatementBlock(block)) return Boolean(block.statement.trim());
  if (block.type === 'comparison') return Boolean(block.leftContent.trim() || block.rightContent.trim());
  if (block.type === 'steps') return block.steps.some((step) => step.trim());
  if (block.type === 'disclosure') return Boolean(block.content.trim());
  if (block.type === 'citation') return Boolean(block.citation.trim());
  if (block.type === 'resource') return Boolean(block.url.trim());
  if (block.type === 'reference') return Boolean(block.targetLabel.trim());
  if (block.type === 'parameter') return Boolean(block.expression.trim());
  return false;
}

function BlockTypeGroup({ title, types, onAdd }: { title: string; types: ArticleBlock['type'][]; onAdd: (type: ArticleBlock['type']) => void }) {
  return <div className="block-type-group"><span>{title}</span><div className="add-block-grid">{types.map((type) => <button key={type} className="add-block-button" onClick={() => onAdd(type)}><Plus size={13}/> {BLOCK_LABELS[type]}</button>)}</div></div>;
}

function BlockEditor({
  block, index, count, selected, onSelect, onUpdate, onMove, onRemove, onDuplicate, onDragStart, onDrop,
}: {
  block: ArticleBlock;
  index: number;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<ArticleBlock>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [imageWarning, setImageWarning] = useState('');
  const uploadImage = (file?: File) => {
    setImageWarning('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setImageWarning('Use a PNG, JPEG, WebP or GIF image.'); return; }
    if (file.size > 1024 * 1024) { setImageWarning('Keep uploaded images under 1 MB so local drafts remain lightweight.'); return; }
    const reader = new FileReader();
    reader.onload = () => onUpdate({ src: String(reader.result), assetName: file.name } as Partial<ArticleBlock>);
    reader.onerror = () => setImageWarning('This image could not be read. Try another file.');
    reader.readAsDataURL(file);
  };
  return <section className={`block-editor-card ${selected ? 'is-selected' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(); }}>
    <div className="block-editor-head"><div className="block-editor-type"><label className="block-select-control" aria-label={`Select ${BLOCK_LABELS[block.type]} block`}><input type="checkbox" checked={selected} onChange={onSelect}/></label><span className="block-number">{String(index + 1).padStart(2, '0')}</span><strong>{BLOCK_LABELS[block.type]}</strong></div><div className="block-editor-actions">
      <button title="Drag to reorder" aria-label="Drag block to reorder" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; onDragStart(); }}><GripVertical size={14}/></button>
      <button title="Move up" aria-label="Move block up" disabled={index === 0} onClick={() => onMove(index, -1)}><ArrowUp size={14}/></button>
      <button title="Move down" aria-label="Move block down" disabled={index === count - 1} onClick={() => onMove(index, 1)}><ArrowDown size={14}/></button>
      <button title="Duplicate block" aria-label="Duplicate block" onClick={onDuplicate}><CopyPlus size={14}/></button>
      <button title="Delete block" aria-label="Delete block" onClick={onRemove}><Trash2 size={14}/></button>
    </div></div>
    <div className="block-editor-fields">
      <label className="editor-field"><span>Section heading <small>Optional; appears in page navigation</small></span><input value={block.heading || ''} onChange={(event) => onUpdate({ heading: event.target.value })} placeholder="Section heading" /></label>
      {block.type === 'text' && <label className="editor-field"><span>Text</span><textarea rows={5} value={block.content} onChange={(event) => onUpdate({ content: event.target.value })} placeholder="Write the explanation..." /></label>}
      {block.type === 'definition' && <label className="editor-field"><span>Definition</span><textarea rows={3} value={block.content} onChange={(event) => onUpdate({ content: event.target.value })} /></label>}
      {block.type === 'latex' && <EquationComposer block={block} onUpdate={onUpdate}/>}
      {block.type === 'image' && <><label className="editor-field"><span>Asset name</span><input value={block.assetName || ''} onChange={(event) => onUpdate({ assetName: event.target.value })} placeholder="Diagram name"/></label><label className="editor-field"><span>Image URL or relative asset path</span><input value={block.src} onChange={(event) => onUpdate({ src: event.target.value })} placeholder="images/diagram.png"/></label><label className="editor-field"><span>Upload image <small>PNG, JPEG, WebP or GIF · maximum 1 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { uploadImage(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label>{imageWarning && <div className="editor-inline-warning">{imageWarning}</div>}{block.src && <img className="editor-image-preview" src={block.src} alt={block.alt || 'Image preview'}/>}<label className="editor-field"><span>Alternative text</span><input value={block.alt} onChange={(event) => onUpdate({ alt: event.target.value })} placeholder="Describe the image for accessibility"/></label><label className="editor-field"><span>Caption</span><input value={block.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value })}/></label></>}
      {block.type === 'video' && <><label className="editor-field"><span>Video URL</span><input value={block.url} onChange={(event) => onUpdate({ url: event.target.value })} placeholder="https://www.youtube.com/watch?v=..."/></label><label className="editor-field"><span>Caption</span><input value={block.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value })}/></label></>}
      {block.type === 'graph' && <><label className="editor-field"><span>Expression in x</span><input className="latex-input" value={block.expression} onChange={(event) => onUpdate({ expression: event.target.value })} placeholder="x^2"/></label><div className="editor-inline-fields"><label className="editor-field"><span>Minimum x</span><input type="number" value={block.xMin} onChange={(event) => onUpdate({ xMin: Number(event.target.value) })}/></label><label className="editor-field"><span>Maximum x</span><input type="number" value={block.xMax} onChange={(event) => onUpdate({ xMax: Number(event.target.value) })}/></label><label className="editor-field"><span>Horizontal label</span><input value={block.xLabel || 'x'} onChange={(event) => onUpdate({ xLabel: event.target.value })}/></label><label className="editor-field"><span>Vertical label</span><input value={block.yLabel || 'y'} onChange={(event) => onUpdate({ yLabel: event.target.value })}/></label></div><label className="editor-field"><span>Caption</span><input value={block.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value })}/></label></>}
      {block.type === 'example' && <><label className="editor-field"><span>Question</span><textarea rows={2} value={block.question} onChange={(event) => onUpdate({ question: event.target.value })}/></label><label className="editor-field"><span>Steps <small>One step per line</small></span><textarea rows={4} value={block.steps.join('\n')} onChange={(event) => onUpdate({ steps: event.target.value.split('\n') })}/></label><label className="editor-field"><span>Answer</span><textarea rows={2} value={block.answer} onChange={(event) => onUpdate({ answer: event.target.value })}/></label></>}
      {block.type === 'table' && <><label className="editor-field"><span>Column headings <small>Separate with commas</small></span><input value={block.headers.join(', ')} onChange={(event) => { const headers = event.target.value.split(',').map((item) => item.trim()); onUpdate({ headers, rows: block.rows.map((row) => headers.map((_, column) => row[column] || '')) }); }}/></label><label className="editor-field"><span>Rows <small>One row per line; separate cells with |</small></span><textarea rows={4} value={block.rows.map((row) => row.join(' | ')).join('\n')} onChange={(event) => onUpdate({ rows: event.target.value.split('\n').map((row) => row.split('|').map((cell) => cell.trim())) })}/></label></>}
      {block.type === 'exercise' && <><label className="editor-field"><span>Question</span><textarea rows={2} value={block.question} onChange={(event) => onUpdate({ question: event.target.value })}/></label><label className="editor-field"><span>Hint</span><input value={block.hint || ''} onChange={(event) => onUpdate({ hint: event.target.value })}/></label><label className="editor-field"><span>Answer</span><textarea rows={2} value={block.answer || ''} onChange={(event) => onUpdate({ answer: event.target.value })}/></label></>}
      {isStatementBlock(block) && <><label className="editor-field"><span>Statement</span><textarea rows={4} value={block.statement} onChange={(event) => onUpdate({ statement: event.target.value })}/></label><label className="editor-field"><span>Reference label <small>Optional; e.g. thm:sum</small></span><input value={block.label || ''} onChange={(event) => onUpdate({ label: event.target.value })}/></label><label className="editor-field"><span>Attribution</span><input value={block.attribution || ''} onChange={(event) => onUpdate({ attribution: event.target.value })}/></label></>}
      {block.type === 'proof' && <><label className="editor-field"><span>Proves label <small>Must match a theorem/lemma label</small></span><input value={block.targetLabel || ''} onChange={(event) => onUpdate({ targetLabel: event.target.value })} placeholder="thm:sum"/></label><label className="editor-field"><span>Proof</span><textarea rows={6} value={block.content} onChange={(event) => onUpdate({ content: event.target.value })}/></label><label className="editor-field"><span>Conclusion marker</span><input value={block.conclusion || ''} onChange={(event) => onUpdate({ conclusion: event.target.value })}/></label></>}
      {block.type === 'callout' && <><label className="editor-field"><span>Callout style</span><select value={block.variant} onChange={(event) => onUpdate({ variant: event.target.value as typeof block.variant })}><option value="note">Note</option><option value="important">Important</option><option value="warning">Warning</option><option value="tip">Tip</option></select></label><label className="editor-field"><span>Content</span><textarea rows={3} value={block.content} onChange={(event) => onUpdate({ content: event.target.value })}/></label></>}
      {block.type === 'comparison' && <div className="editor-inline-fields"><label className="editor-field"><span>Left title</span><input value={block.leftTitle} onChange={(event) => onUpdate({ leftTitle: event.target.value })}/></label><label className="editor-field"><span>Right title</span><input value={block.rightTitle} onChange={(event) => onUpdate({ rightTitle: event.target.value })}/></label><label className="editor-field"><span>Left content</span><textarea rows={4} value={block.leftContent} onChange={(event) => onUpdate({ leftContent: event.target.value })}/></label><label className="editor-field"><span>Right content</span><textarea rows={4} value={block.rightContent} onChange={(event) => onUpdate({ rightContent: event.target.value })}/></label></div>}
      {block.type === 'steps' && <label className="editor-field"><span>Steps <small>One step per line</small></span><textarea rows={5} value={block.steps.join('\n')} onChange={(event) => onUpdate({ steps: event.target.value.split('\n') })}/></label>}
      {block.type === 'disclosure' && <><label className="editor-field"><span>Expandable label</span><input value={block.summary} onChange={(event) => onUpdate({ summary: event.target.value })}/></label><label className="editor-field"><span>Expanded content</span><textarea rows={4} value={block.content} onChange={(event) => onUpdate({ content: event.target.value })}/></label><label className="editor-checkbox"><input type="checkbox" checked={Boolean(block.initiallyOpen)} onChange={(event) => onUpdate({ initiallyOpen: event.target.checked })}/> Open by default</label></>}
      {block.type === 'citation' && <><label className="editor-field"><span>Citation text</span><textarea rows={3} value={block.citation} onChange={(event) => onUpdate({ citation: event.target.value })}/></label><div className="editor-inline-fields"><label className="editor-field"><span>Author</span><input value={block.author || ''} onChange={(event) => onUpdate({ author: event.target.value })}/></label><label className="editor-field"><span>Year</span><input value={block.year || ''} onChange={(event) => onUpdate({ year: event.target.value })}/></label></div><label className="editor-field"><span>Source URL</span><input value={block.url || ''} onChange={(event) => onUpdate({ url: event.target.value })} placeholder="https://..."/></label></>}
      {block.type === 'resource' && <><label className="editor-field"><span>Resource label</span><input value={block.label} onChange={(event) => onUpdate({ label: event.target.value })}/></label><label className="editor-field"><span>URL or relative path</span><input value={block.url} onChange={(event) => onUpdate({ url: event.target.value })} placeholder="https://... or /resources/file.pdf"/></label><label className="editor-field"><span>Description</span><textarea rows={2} value={block.description || ''} onChange={(event) => onUpdate({ description: event.target.value })}/></label><label className="editor-field"><span>Resource type</span><select value={block.resourceType} onChange={(event) => onUpdate({ resourceType: event.target.value as typeof block.resourceType })}><option value="web">Web page</option><option value="pdf">PDF</option><option value="download">Download</option></select></label></>}
      {block.type === 'reference' && <><label className="editor-field"><span>Target label</span><input value={block.targetLabel} onChange={(event) => onUpdate({ targetLabel: event.target.value })} placeholder="eq:main or thm:sum"/></label><div className="editor-inline-fields"><label className="editor-field"><span>Prefix</span><input value={block.prefix || ''} onChange={(event) => onUpdate({ prefix: event.target.value })}/></label><label className="editor-field"><span>Suffix</span><input value={block.suffix || ''} onChange={(event) => onUpdate({ suffix: event.target.value })}/></label></div></>}
      {block.type === 'parameter' && <><label className="editor-field"><span>Expression</span><input className="latex-input" value={block.expression} onChange={(event) => onUpdate({ expression: event.target.value })} placeholder="a^2 + 1"/></label><div className="editor-inline-fields"><label className="editor-field"><span>Parameter name</span><input value={block.parameter} onChange={(event) => onUpdate({ parameter: event.target.value })}/></label><label className="editor-field"><span>Initial value</span><input type="number" value={block.initial} onChange={(event) => onUpdate({ initial: Number(event.target.value) })}/></label><label className="editor-field"><span>Minimum</span><input type="number" value={block.min} onChange={(event) => onUpdate({ min: Number(event.target.value) })}/></label><label className="editor-field"><span>Maximum</span><input type="number" value={block.max} onChange={(event) => onUpdate({ max: Number(event.target.value) })}/></label><label className="editor-field"><span>Step</span><input type="number" min="0.000001" value={block.step} onChange={(event) => onUpdate({ step: Number(event.target.value) })}/></label></div><label className="editor-field"><span>Caption</span><input value={block.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value })}/></label></>}
    </div>
  </section>;
}

function isStatementBlock(block: ArticleBlock): block is Extract<ArticleBlock, { type: StatementBlockType }> {
  return block.type === 'theorem' || block.type === 'lemma' || block.type === 'corollary' || block.type === 'proposition' || block.type === 'axiom';
}

function EquationComposer({ block, onUpdate }: { block: Extract<ArticleBlock, { type: 'latex' }>; onUpdate: (patch: Partial<ArticleBlock>) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insert = (snippet: string) => {
    const field = textareaRef.current;
    if (!field) { onUpdate({ latex: `${block.latex}${snippet}` }); return; }
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const next = `${block.latex.slice(0, start)}${snippet}${block.latex.slice(end)}`;
    onUpdate({ latex: next });
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + snippet.length, start + snippet.length); });
  };
  const templates = [
    ['Fraction', '\\frac{a}{b}'], ['Square root', '\\sqrt{x}'], ['Integral', '\\int_{a}^{b} f(x)\\,dx'],
    ['Summation', '\\sum_{i=1}^{n} a_i'], ['Limit', '\\lim_{x\\to a} f(x)'], ['Matrix', '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'],
    ['Cases', '\\begin{cases}x,&x>0\\\\0,&x=0\\end{cases}'], ['Product', '\\prod_{i=1}^{n} a_i'],
  ];
  return <div className="equation-composer"><label className="editor-field"><span>LaTeX source</span><textarea ref={textareaRef} rows={3} className="latex-input" value={block.latex} onChange={(event) => onUpdate({ latex: event.target.value })} placeholder="\\sum_{i=1}^{n} a_i"/></label><div className="equation-template-toolbar"><span>Insert structure</span>{templates.map(([label, snippet]) => <button type="button" key={label} onClick={() => insert(snippet)}>{label}</button>)}</div><div className="equation-live-preview"><div className="equation-preview-head"><span>Live preview</span><Sigma size={13}/></div><MathExpression latex={block.latex} display={block.display}/></div><label className="editor-field"><span>Explanation</span><textarea rows={2} value={block.explanation || ''} onChange={(event) => onUpdate({ explanation: event.target.value })}/></label><div className="editor-inline-fields"><label className="editor-field"><span>Reference label <small>Optional; e.g. eq:sum</small></span><input value={block.label || ''} onChange={(event) => onUpdate({ label: event.target.value })}/></label><label className="editor-checkbox"><input type="checkbox" checked={block.display} onChange={(event) => onUpdate({ display: event.target.checked })}/> Display equation</label><label className="editor-checkbox"><input type="checkbox" checked={Boolean(block.numbered)} onChange={(event) => onUpdate({ numbered: event.target.checked })}/> Number this equation</label></div></div>;
}

function RevisionHistoryDialog({ article, items, onClose, onRestore }: { article: MathArticle; items: ReturnType<typeof getArticleRevisions>; onClose: () => void; onRestore: (id: string) => void }) {
  return <div className="editor-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="revision-title"><div className="editor-modal-head"><div><span className="eyebrow">LOCAL VERSION HISTORY</span><h2 id="revision-title">Revision history</h2><p>Recent valid snapshots of this article on this device.</p></div><button onClick={onClose} aria-label="Close revision history"><X size={17}/></button></div>{items.length ? <div className="revision-list">{items.map((item) => <div className="revision-row" key={item.id}><div><strong>{item.title || article.title}</strong><span>{new Date(item.savedAt).toLocaleString()} · {item.article.blocks.length} blocks</span></div><button className="button button-secondary" onClick={() => onRestore(item.id)}>Restore this version</button></div>)}</div> : <div className="editor-modal-empty"><History size={22}/><strong>No revisions yet</strong><span>Valid autosaved versions will appear here. Large embedded-media snapshots may be skipped to protect browser storage.</span></div>}<div className="editor-modal-foot"><span>Up to 12 compact revisions are retained.</span><button className="button button-secondary" onClick={onClose}>Close</button></div></section></div>;
}

function MediaManagerDialog({ article, onClose, onUpdateBlock, onRemoveBlock, onAddImage }: { article: MathArticle; onClose: () => void; onUpdateBlock: (id: string, patch: Partial<ArticleBlock>) => void; onRemoveBlock: (id: string) => void; onAddImage: () => void }) {
  const media = article.blocks.filter((block): block is Extract<ArticleBlock, { type: 'image' }> => block.type === 'image');
  return <div className="editor-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="editor-modal media-manager-modal" role="dialog" aria-modal="true" aria-labelledby="media-title"><div className="editor-modal-head"><div><span className="eyebrow">ARTICLE ASSETS</span><h2 id="media-title">Media manager</h2><p>Manage image assets attached to this article.</p></div><button onClick={onClose} aria-label="Close media manager"><X size={17}/></button></div>{media.length ? <div className="media-manager-list">{media.map((item, index) => <MediaManagerRow key={item.id} block={item} index={index} onUpdate={(patch) => onUpdateBlock(item.id, patch)} onRemove={() => onRemoveBlock(item.id)}/>)}</div> : <div className="editor-modal-empty"><Images size={23}/><strong>No article images</strong><span>Add an image block to begin managing this article's media.</span></div>}<div className="editor-modal-foot"><span>{media.length} image asset{media.length === 1 ? '' : 's'} · embedded image data is included in article JSON exports.</span><div><button className="button button-secondary" onClick={onAddImage}><Plus size={13}/> Add image</button><button className="button button-primary" onClick={onClose}>Done</button></div></div></section></div>;
}

function MediaManagerRow({ block, index, onUpdate, onRemove }: { block: Extract<ArticleBlock, { type: 'image' }>; index: number; onUpdate: (patch: Partial<ArticleBlock>) => void; onRemove: () => void }) {
  const [warning, setWarning] = useState('');
  const replace = (file?: File) => {
    setWarning('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setWarning('Unsupported image format.'); return; }
    if (file.size > 1024 * 1024) { setWarning('Image must be 1 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => onUpdate({ src: String(reader.result), assetName: file.name });
    reader.onerror = () => setWarning('Could not read this image.');
    reader.readAsDataURL(file);
  };
  return <article className="media-manager-row"><div className="media-manager-preview">{block.src ? <img src={block.src} alt={block.alt || ''}/> : <Images size={22}/>}</div><div className="media-manager-fields"><strong>Image {String(index + 1).padStart(2, '0')}</strong><label className="editor-field"><span>Asset name</span><input value={block.assetName || ''} onChange={(event) => onUpdate({ assetName: event.target.value })}/></label><label className="editor-field"><span>Alternative text</span><input value={block.alt} onChange={(event) => onUpdate({ alt: event.target.value })}/></label><label className="editor-field"><span>Caption</span><input value={block.caption || ''} onChange={(event) => onUpdate({ caption: event.target.value })}/></label>{warning && <small className="editor-inline-warning">{warning}</small>}<div className="media-manager-actions"><label className="button button-secondary media-replace-button">Replace image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { replace(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label><button className="button button-secondary" onClick={onRemove}><Trash2 size={13}/> Remove asset</button></div></div></article>;
}

function TemplateDialog({ onClose, onApply }: { onClose: () => void; onApply: (template: TemplateDefinition) => void }) {
  return <div className="editor-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="editor-modal template-modal" role="dialog" aria-modal="true" aria-labelledby="template-title"><div className="editor-modal-head"><div><span className="eyebrow">STARTING STRUCTURES</span><h2 id="template-title">Article templates</h2><p>Choose a structure, then replace the example prompts with your own content.</p></div><button onClick={onClose} aria-label="Close templates"><X size={17}/></button></div><div className="template-grid">{articleTemplates.map((template) => <button className="template-card" key={template.id} onClick={() => onApply(template)}><LayoutTemplate size={17}/><strong>{template.title}</strong><span>{template.description}</span><small>{template.blockCount} starter blocks</small></button>)}</div><div className="editor-modal-foot"><span>Applying a template replaces the current block list after confirmation.</span><button className="button button-secondary" onClick={onClose}>Cancel</button></div></section></div>;
}
