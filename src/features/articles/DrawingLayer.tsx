import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { Download, Eraser, PenLine, Redo2, Trash2, Undo2 } from 'lucide-react';
import { getDrawingStrokes, saveDrawingStrokes } from '../../engine/annotationStorage';
import type { AnnotationTone, DrawingPoint, DrawingStroke } from '../../engine/annotationStorage';

type Tool = 'pen' | 'eraser';
const toneColors: Record<AnnotationTone, string> = { light: '#bdbdbd', mid: '#666666', dark: '#111111', red: '#cf3f3f', blue: '#3267c8', green: '#258554', yellow: '#d7a928' };

export default function DrawingLayer({ articleId, containerRef, onNotice, onClearTextAnnotations }: {
  articleId: string;
  containerRef: RefObject<HTMLDivElement>;
  onNotice: (message: string) => void;
  onClearTextAnnotations: () => boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [tone, setTone] = useState<AnnotationTone>('dark');
  const [size, setSize] = useState(2.5);
  const [strokes, setStrokes] = useState<DrawingStroke[]>(() => getDrawingStrokes(articleId));
  const strokesRef = useRef(strokes);
  const [undoStack, setUndoStack] = useState<DrawingStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([]);
  const currentStroke = useRef<DrawingStroke | null>(null);
  const eraseOriginal = useRef<DrawingStroke[] | null>(null);
  const eraseChanged = useRef(false);
  const dimensions = useRef({ width: 0, height: 0, ratio: 1 });

  const redraw = useCallback((items: DrawingStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const { width, height, ratio } = dimensions.current;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    items.forEach((stroke) => {
      if (stroke.points.length === 0) return;
      context.beginPath();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = toneColors[stroke.tone];
      context.lineWidth = stroke.size;
      const toCanvasPoint = (point: DrawingPoint) => ({ x: point.x * width, y: point.y * height });
      const first = toCanvasPoint(stroke.points[0]);
      context.moveTo(first.x, first.y);
      stroke.points.slice(1).forEach((point) => { const scaled = toCanvasPoint(point); context.lineTo(scaled.x, scaled.y); });
      if (stroke.points.length === 1) context.lineTo(first.x + 0.01, first.y + 0.01);
      context.stroke();
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.scrollHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      dimensions.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      redraw(strokesRef.current);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const mutation = new MutationObserver(resize);
    mutation.observe(container, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', resize);
    const timer = window.setTimeout(resize, 80);
    return () => { window.clearTimeout(timer); observer.disconnect(); mutation.disconnect(); window.removeEventListener('resize', resize); };
  }, [containerRef, redraw]);

  useEffect(() => { strokesRef.current = strokes; redraw(strokes); }, [strokes, redraw]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!saveDrawingStrokes(articleId, strokes)) onNotice('Drawing could not be saved. This browser may be low on storage.');
    }, 180);
    return () => window.clearTimeout(timer);
  }, [articleId, strokes, onNotice]);
  useEffect(() => () => { saveDrawingStrokes(articleId, strokesRef.current); }, [articleId]);

  const commitStrokes = (next: DrawingStroke[]) => {
    setUndoStack((current) => [...current.slice(-39), strokes]);
    setRedoStack([]);
    setStrokes(next);
  };
  const distanceToSegment = (point: DrawingPoint, start: DrawingPoint, end: DrawingPoint) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
  };
  const strokeNearPoint = (stroke: DrawingStroke, point: DrawingPoint, radius: number) => {
    const { width, height } = dimensions.current;
    const scaled = stroke.points.map((item) => ({ x: item.x * width, y: item.y * height }));
    const target = { x: point.x * width, y: point.y * height };
    if (scaled.length === 1) return Math.hypot(scaled[0].x - target.x, scaled[0].y - target.y) <= radius;
    return scaled.slice(1).some((end, index) => distanceToSegment(target, scaled[index], end) <= radius);
  };
  const pointerPoint = (event: PointerEvent<HTMLCanvasElement>): DrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))) };
  };
  const canvasPoint = (point: DrawingPoint) => ({ x: point.x * dimensions.current.width, y: point.y * dimensions.current.height });
  const handleDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    if (tool === 'eraser') {
      eraseOriginal.current = strokes;
      eraseChanged.current = false;
      const radius = Math.max(12, size * 4);
      const next = strokes.filter((stroke) => !strokeNearPoint(stroke, point, radius));
      if (next.length !== strokes.length) {
        eraseChanged.current = true;
        setStrokes(next);
      }
      return;
    }
    currentStroke.current = { id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, points: [point], tone, size, tool: 'pen' };
    const context = event.currentTarget.getContext('2d');
    if (context) { const scaled = canvasPoint(point); context.beginPath(); context.fillStyle = toneColors[tone]; context.arc(scaled.x, scaled.y, size / 2, 0, Math.PI * 2); context.fill(); }
  };
  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    const point = pointerPoint(event);
    if (tool === 'eraser' && event.buttons) {
      const radius = Math.max(12, size * 4);
      setStrokes((current) => {
        const next = current.filter((stroke) => !strokeNearPoint(stroke, point, radius));
        if (next.length !== current.length) eraseChanged.current = true;
        return next;
      });
      return;
    }
    const stroke = currentStroke.current;
    if (!stroke) return;
    stroke.points.push(point);
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const previous = canvasPoint(stroke.points[stroke.points.length - 2]);
    const current = canvasPoint(point);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.strokeStyle = toneColors[stroke.tone];
    context.lineWidth = stroke.size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  };
  const handleUp = () => {
    if (currentStroke.current) {
      commitStrokes([...strokes, currentStroke.current as DrawingStroke]);
      currentStroke.current = null;
      return;
    }
    if (eraseChanged.current && eraseOriginal.current) {
      const previous = eraseOriginal.current;
      setUndoStack((current) => [...current.slice(-39), previous]);
      setRedoStack([]);
    }
    eraseOriginal.current = null;
    eraseChanged.current = false;
  };

  const undo = () => {
    if (!undoStack.length) return;
    setRedoStack((current) => [...current.slice(-39), strokes]);
    setStrokes(undoStack[undoStack.length - 1]);
    setUndoStack((current) => current.slice(0, -1));
  };
  const redo = () => {
    if (!redoStack.length) return;
    setUndoStack((current) => [...current.slice(-39), strokes]);
    setStrokes(redoStack[redoStack.length - 1]);
    setRedoStack((current) => current.slice(0, -1));
  };
  const clear = () => {
    if (!strokes.length || !window.confirm('Clear all saved drawings on this article?')) return;
    commitStrokes([]);
  };
  const clearAllAnnotations = () => {
    if (!window.confirm('Delete all drawings, text highlights and attached notes on this article?')) return;
    if (!onClearTextAnnotations()) return;
    commitStrokes([]);
    onNotice('All drawings, text highlights and notes were removed');
  };
  const exportView = async () => {
    const node = containerRef.current;
    if (!node) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff', filter: (candidate) => !(candidate instanceof HTMLElement && candidate.classList.contains('drawing-toolbar')) });
      const link = document.createElement('a');
      link.download = `${articleId}-annotated.png`;
      link.href = dataUrl;
      link.click();
      onNotice('Annotated article view exported as PNG');
    } catch {
      onNotice('PNG export could not capture an embedded resource. Try again after its images finish loading.');
    }
  };

  return <>
    <div className="drawing-toolbar" aria-label="Article annotation tools">
      <button className={`article-action ${active ? 'is-active' : ''}`} onClick={() => setActive((value) => !value)}><PenLine size={14}/><span>{active ? 'Finish annotating' : 'Annotate page'}</span></button>
      {active && <>
        <span className="drawing-toolbar-divider" />
        <button className={`article-action ${tool === 'pen' ? 'is-active' : ''}`} onClick={() => setTool('pen')} aria-pressed={tool === 'pen'}><PenLine size={13}/><span>Pen</span></button>
        <button className={`article-action ${tool === 'eraser' ? 'is-active' : ''}`} onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'}><Eraser size={13}/><span>Eraser</span></button>
        <select aria-label="Pen size" value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={1.5}>Thin</option><option value={2.5}>Medium</option><option value={5}>Thick</option><option value={8}>Extra thick</option></select>
        <div className="drawing-tone-picker" aria-label="Pen color">
          {(['dark', 'mid', 'light', 'red', 'blue', 'green', 'yellow'] as AnnotationTone[]).map((value) => <button key={value} className={`drawing-tone tone-${value} ${tone === value ? 'selected' : ''}`} aria-label={`${value} ink`} onClick={() => setTone(value)} />)}
        </div>
        <button className="article-action" onClick={undo} disabled={!undoStack.length} aria-label="Undo"><Undo2 size={14}/></button>
        <button className="article-action" onClick={redo} disabled={!redoStack.length} aria-label="Redo"><Redo2 size={14}/></button>
        <button className="article-action drawing-delete-button" onClick={clear} disabled={!strokes.length} title="Delete only pen drawings"><Trash2 size={13}/><span>Delete drawings only</span></button>
        <button className="article-action drawing-delete-all-button" onClick={clearAllAnnotations} title="Delete drawings, text highlights and notes together"><Trash2 size={13}/><span>Delete everything</span></button>
        <button className="article-action" onClick={exportView}><Download size={13}/><span>Save PNG</span></button>
      </>}
    </div>
    <canvas
      ref={canvasRef}
      className={`article-drawing-canvas ${active ? 'drawing-active' : ''} ${tool === 'eraser' ? 'drawing-eraser' : ''}`}
      aria-label="Drawing layer over article content"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
    />
  </>;
}
