import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, Bookmark, Check, Clock3, Columns2, Copy, Download, Highlighter, Link2, MessageSquareText, Share2, Trash2, X, Pencil } from 'lucide-react';
import { mathBranches } from '../../data/branches';
import { getArticleBySlug } from '../../engine/articleStorage';
import { buildArticleReferenceIndex } from '../../engine/articleReferences';
import { articleToText, copyText, isBookmarked, shareArticle, toggleBookmark } from '../../engine/readerTools';
import { createTextAnnotation, getTextAnnotations, removeTextAnnotation, updateTextAnnotation } from '../../engine/annotationStorage';
import type { AnnotationTone, TextAnnotation } from '../../engine/annotationStorage';
import BlockRenderer from './BlockRenderer';
import AnnotationHighlights from './AnnotationHighlights';
import DrawingLayer from './DrawingLayer';
import ReadAloud from './ReadAloud';
import StudyPanel from './StudyPanel';

type SelectionInfo = { blockId: string; start: number; end: number; quote: string; prefix: string; suffix: string; left: number; top: number };
type NotePopup = { id: string; note: string; quote: string; left: number; top: number };

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  try { range.setEnd(node, offset); } catch { return 0; }
  return range.toString().length;
}

function selectedScope(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>('[data-annotation-content]') || null;
}

function findAnnotationAtPoint(x: number, y: number, annotations: TextAnnotation[]): NotePopup | null {
  const documentWithCaret = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let caret: Range | null = documentWithCaret.caretRangeFromPoint?.(x, y) || null;
  if (!caret && documentWithCaret.caretPositionFromPoint) {
    const position = documentWithCaret.caretPositionFromPoint(x, y);
    if (position) { caret = document.createRange(); caret.setStart(position.offsetNode, position.offset); caret.collapse(true); }
  }
  if (!caret) return null;
  const root = selectedScope(caret.startContainer);
  const blockId = root?.dataset.blockId;
  if (!root || !blockId || !root.closest('.article-content-wrap')) return null;
  const offset = textOffset(root, caret.startContainer, caret.startOffset);
  const raw = root.textContent || '';
  const found = annotations.find((item) => {
    if (item.blockId !== blockId || !item.note.trim()) return false;
    let start = item.start;
    let end = item.end;
    if (raw.slice(start, end) !== item.quote) {
      const recovered = raw.indexOf(item.quote);
      if (!item.quote || recovered < 0 || raw.indexOf(item.quote, recovered + 1) >= 0) return false;
      start = recovered;
      end = recovered + item.quote.length;
    }
    return offset >= start && offset <= end;
  });
  if (!found) return null;
  return { id: found.id, note: found.note, quote: found.quote, left: Math.max(12, Math.min(x + 14, window.innerWidth - 292)), top: Math.max(12, y - 75) };
}

export default function ArticlePage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const article = getArticleBySlug(slug);
  const [bookmarked, setBookmarked] = useState(() => article ? isBookmarked(article.id) : false);
  const [notice, setNotice] = useState('');
  const [annotations, setAnnotations] = useState<TextAnnotation[]>(() => article ? getTextAnnotations(article.id) : []);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteEditDraft, setNoteEditDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [notePopup, setNotePopup] = useState<NotePopup | null>(null);
  const [studyMode, setStudyMode] = useState<'quiz' | 'worksheet' | 'exam' | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeNoteRef = useRef<string>('');
  const sections = useMemo(() => article?.blocks.filter((block) => Boolean(block.heading)) || [], [article]);
  const referenceIndex = useMemo(() => buildArticleReferenceIndex(article?.blocks || []), [article]);

  useEffect(() => {
    if (!article) return;
    setBookmarked(isBookmarked(article.id));
    setAnnotations(getTextAnnotations(article.id));
    setSelection(null);
    setStudyMode(null);
    const sync = () => setBookmarked(isBookmarked(article.id));
    window.addEventListener('math-wiki:bookmarks-changed', sync);
    return () => window.removeEventListener('math-wiki:bookmarks-changed', sync);
  }, [article?.id]);

  useEffect(() => {
    const target = new URLSearchParams(location.search).get('block');
    if (!target) return;
    const timer = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => window.clearTimeout(timer);
  }, [location.search, article?.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onSelection = () => {
      if (document.activeElement instanceof Element && document.activeElement.closest('.text-selection-tools')) return;
      const current = window.getSelection();
      if (!current || current.isCollapsed || !current.rangeCount) { setSelection(null); setAddingNote(false); return; }
      const range = current.getRangeAt(0);
      const root = selectedScope(range.commonAncestorContainer);
      if (!root || !root.closest('.article-content-wrap')) { setSelection(null); return; }
      const blockId = root.dataset.blockId;
      if (!blockId) return;
      const start = textOffset(root, range.startContainer, range.startOffset);
      const end = textOffset(root, range.endContainer, range.endOffset);
      const quote = (root.textContent || '').slice(start, end);
      if (!quote.trim() || quote.length > 2000 || end <= start) { setSelection(null); return; }
      const rect = range.getBoundingClientRect();
      setSelection({ blockId, start, end, quote, prefix: (root.textContent || '').slice(Math.max(0, start - 36), start), suffix: (root.textContent || '').slice(end, end + 36), left: Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - 330)), top: Math.max(12, rect.top - 54) });
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, [article?.id]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.annotation-note-popover')) return;
      if (event.pointerType === 'touch') return;
      const found = findAnnotationAtPoint(event.clientX, event.clientY, annotations);
      if (!found) { activeNoteRef.current = ''; setNotePopup(null); return; }
      if (activeNoteRef.current === found.id) return;
      activeNoteRef.current = found.id;
      setNotePopup(found);
      setNoteEditDraft(found.note);
      setEditingNote(false);
    };
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => document.removeEventListener('pointermove', onPointerMove);
  }, [annotations, article?.id]);

  if (!article) return <div className="article-not-found"><h1>Article not found</h1><p>This article may not exist or may have been removed.</p><Link to="/branches">Browse mathematics branches</Link></div>;
  const branch = mathBranches.find((item) => item.id === article.branch);

  const deleteCurrentNote = () => {
    if (!notePopup) return;
    try {
      removeTextAnnotation(article.id, notePopup.id);
      setAnnotations(getTextAnnotations(article.id));
      setNotePopup(null);
      setEditingNote(false);
      activeNoteRef.current = '';
      setNotice('Note removed');
    } catch {
      setNotice('Could not remove this note. Check available browser storage.');
    }
  };
  const saveEditedNote = () => {
    if (!notePopup || !noteEditDraft.trim()) return;
    try {
      updateTextAnnotation(article.id, notePopup.id, noteEditDraft.trim());
      setAnnotations(getTextAnnotations(article.id));
      setNotePopup({ ...notePopup, note: noteEditDraft.trim() });
      setEditingNote(false);
      setNotice('Note updated');
    } catch {
      setNotice('Could not update this note. Check available browser storage.');
    }
  };
  const copyArticle = async () => {
    try { await copyText(articleToText(article)); setNotice('Article copied to clipboard'); }
    catch { setNotice('Could not copy this article'); }
  };
  const saveBookmark = () => {
    try {
      const next = toggleBookmark(article.id);
      setBookmarked(next);
      setNotice(next ? 'Added to bookmarks' : 'Removed from bookmarks');
    } catch {
      setNotice('Bookmark could not be saved. Check browser storage settings.');
    }
  };

  const downloadPdf = () => {
    const previousTitle = document.title;
    document.title = article.title;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 1000);
  };
  const share = async () => {
    try {
      const result = await shareArticle(article);
      setNotice(result === 'shared' ? 'Share sheet opened' : 'Article link copied');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setNotice('Sharing is unavailable in this browser');
    }
  };
  const copySelectedText = async () => {
    if (!selection) return;
    try { await copyText(selection.quote); setNotice('Selected text copied'); }
    catch { setNotice('Could not copy selected text'); }
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };
  const saveHighlight = async (tone: AnnotationTone, note = '') => {
    if (!selection) return;
    try {
      createTextAnnotation({ articleId: article.id, blockId: selection.blockId, start: selection.start, end: selection.end, quote: selection.quote, prefix: selection.prefix, suffix: selection.suffix, tone, note });
      setAnnotations(getTextAnnotations(article.id));
      setSelection(null);
      setAddingNote(false);
      setNoteDraft('');
      window.getSelection()?.removeAllRanges();
      setNotice(note ? 'Note saved to selected text' : 'Text highlighted');
    } catch {
      setNotice('This browser could not save the annotation. Check available storage.');
    }
  };

  return <div className="article-layout">
    <article className="article-main" onClick={(event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.article-content-wrap') || target.closest('a, button, input, textarea, select')) return;
      const found = findAnnotationAtPoint(event.clientX, event.clientY, annotations);
      if (found) { activeNoteRef.current = found.id; setNotePopup(found); setNoteEditDraft(found.note); setEditingNote(false); }
    }}>
      <div className="article-breadcrumbs"><Link to="/branches">Mathematics</Link><span>/</span>{branch ? <Link to={`/branches/${branch.id}`}>{branch.title}</Link> : <span>Reference</span>}</div>
      <header className="article-header">
        <div className="article-eyebrow">{branch?.title || 'MATHEMATICS REFERENCE'}</div>
        <h1>{article.title}</h1>
        <div className="article-meta"><span><BookOpen size={14} /> {article.level}</span><span className="meta-divider"/><span>{article.difficulty}</span></div>
        {article.aliases.length > 0 && <p className="article-aliases"><strong>Also known as</strong> {article.aliases.join(', ')}</p>}
        {article.summary && <p className="article-summary">{article.summary}</p>}
        <div className="article-view-selector" role="group" aria-label="Article view">
          <button type="button" className="selected" aria-pressed="true">Page</button>
          <button type="button" disabled aria-disabled="true" title="Video view is under development">Video <span className="soon-pill">Soon</span></button>
          <button type="button" disabled aria-disabled="true" title="Book view is under development">Book <span className="soon-pill">Soon</span></button>
        </div>
        <div className="article-actions" aria-label="Article actions">
          <button className="article-action" onClick={downloadPdf}><Download size={14}/><span>Download PDF</span></button>
          <button className={`article-action ${bookmarked ? 'is-active' : ''}`} onClick={saveBookmark}><Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'}/><span>{bookmarked ? 'Bookmarked' : 'Bookmark'}</span></button>
          <button className="article-action" onClick={copyArticle}><Copy size={14}/><span>Copy article</span></button>
          <button className="article-action" onClick={share}><Share2 size={14}/><span>Share</span></button>
          <button className="article-action" onClick={() => navigate(`/split/${article.slug}`)}><Columns2 size={14}/><span>Split view</span></button>
          <button className="article-action" onClick={() => setStudyMode('quiz')}><BookOpen size={14}/><span>Create quiz</span></button>
          <button className="article-action" onClick={() => setStudyMode('worksheet')}><Download size={14}/><span>Worksheet</span></button>
          <button className="article-action" onClick={() => setStudyMode('exam')}><Clock3 size={14}/><span>Timed exam</span></button>
        </div>
        <div className="article-future-actions" aria-label="Upcoming article tools">
          <button type="button" disabled><Link2 size={13}/><span>Mind Linker</span><span className="soon-pill">Soon</span></button>
          <button type="button" disabled><Columns2 size={13}/><span>Compare Mode</span><span className="soon-pill">Soon</span></button>
        </div>
        <div className="article-read-row"><ReadAloud article={article}/></div>
        {notice && <div className="article-notice" role="status"><Check size={13}/>{notice}</div>}
        <div className="article-header-rule" />
      </header>
      <div className="article-content-wrap" ref={contentRef}>
        <DrawingLayer key={article.id} articleId={article.id} containerRef={contentRef} onNotice={setNotice}/>
        <div className="article-content">{article.blocks.map((block) => <BlockRenderer key={block.id} block={block} onCopy={setNotice} numberLabel={referenceIndex.byBlockId[block.id]?.display} references={referenceIndex.byLabel} />)}</div>
      </div>
      {studyMode && <StudyPanel article={article} mode={studyMode} onClose={() => setStudyMode(null)} />}
      {article.relatedTopics.length > 0 && <section className="article-related"><div className="article-section-heading">Related topics</div><div className="related-topic-links">{article.relatedTopics.map((topic) => <span key={topic}>{topic.replace(/-/g, ' ')}</span>)}</div></section>}
      <div className="article-end"><span>End of article</span><span /></div>
    </article>
    <aside className="article-outline">
      <div className="outline-sticky">
        <div className="outline-title">ON THIS PAGE</div>
        <nav aria-label="On this page">{sections.map((block) => <a href={`#${block.id}`} key={block.id}>{block.heading}</a>)}</nav>
        <div className="outline-edit"><Link to={article.status === 'published' ? `/editor/new?source=${encodeURIComponent(article.slug)}` : `/editor/${article.id}`}><ArrowUpRight size={13} /> {article.status === 'published' ? 'Create editable copy' : 'Edit this draft'}</Link></div>
      </div>
    </aside>
    <Link to={branch ? `/branches/${branch.id}` : '/branches'} className="article-back-link"><ArrowLeft size={14} /> Back to {branch?.title || 'mathematics'}</Link>
    <AnnotationHighlights annotations={annotations}/>
    {selection && <div className="text-selection-tools" style={{ left: selection.left, top: selection.top }}>
      <div className="selection-tool-actions" onMouseDown={(event) => event.preventDefault()}>
        <button onClick={copySelectedText} aria-label="Copy selected text"><Copy size={13}/><span>Copy</span></button>
        <span className="selection-tool-divider"/>
        <button onClick={() => saveHighlight('light')}><Highlighter size={13}/><span>Highlight</span></button>
        <button onClick={() => saveHighlight('red')} aria-label="Use red highlight"><span className="selection-tone-dot red"/></button>
        <button onClick={() => saveHighlight('blue')} aria-label="Use blue highlight"><span className="selection-tone-dot blue"/></button>
        <button onClick={() => saveHighlight('green')} aria-label="Use green highlight"><span className="selection-tone-dot green"/></button>
        <button onClick={() => saveHighlight('yellow')} aria-label="Use yellow highlight"><span className="selection-tone-dot yellow"/></button>
        <span className="selection-tool-divider"/>
        <button onClick={() => setAddingNote((value) => !value)}><MessageSquareText size={13}/><span>Add note</span></button>
        <button className="selection-close" onClick={() => setSelection(null)} aria-label="Close selection tools"><X size={13}/></button>
      </div>
      {addingNote && <div className="selection-note-form"><textarea rows={2} autoFocus value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write a note for this passage..."/><button className="button button-primary" onClick={() => saveHighlight('light', noteDraft.trim())} disabled={!noteDraft.trim()}>Save note</button></div>}
    </div>}
    {notePopup && <div className="annotation-note-popover" style={{ left: notePopup.left, top: notePopup.top }}><div className="annotation-note-title"><MessageSquareText size={12}/> PERSONAL NOTE{!editingNote && <button onClick={() => { setNoteEditDraft(notePopup.note); setEditingNote(true); }} aria-label="Edit note"><Pencil size={12}/> Edit</button>}<button onClick={deleteCurrentNote} aria-label="Delete note"><Trash2 size={12}/> Remove</button><button onClick={() => { setNotePopup(null); setEditingNote(false); activeNoteRef.current = ''; }} aria-label="Close note"><X size={12}/></button></div>{editingNote ? <div className="annotation-note-edit"><textarea rows={3} value={noteEditDraft} onChange={(event) => setNoteEditDraft(event.target.value)} aria-label="Edit personal note"/><div><button onClick={() => setEditingNote(false)}>Cancel</button><button onClick={saveEditedNote} disabled={!noteEditDraft.trim()}>Save note</button></div></div> : <><p>{notePopup.note}</p><small>“{notePopup.quote.slice(0, 110)}{notePopup.quote.length > 110 ? '…' : ''}”</small></>}</div>}
  </div>;
}
