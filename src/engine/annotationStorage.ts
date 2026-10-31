import { safeStorageGetJson, safeStorageSetJson } from './safeStorage';

export type AnnotationTone = 'light' | 'mid' | 'dark' | 'red' | 'blue' | 'green' | 'yellow';

export interface TextAnnotation {
  id: string;
  articleId: string;
  blockId: string;
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
  tone: AnnotationTone;
  note: string;
  createdAt: string;
}

export interface DrawingPoint { x: number; y: number }
export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  tone: AnnotationTone;
  size: number;
  tool: 'pen' | 'eraser';
}

const TEXT_KEY = 'math-wiki:annotations:v1';
const DRAWING_KEY = 'math-wiki:drawings:v2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function readMap<T>(key: string): Record<string, T[]> {
  const value = safeStorageGetJson(key, {} as Record<string, unknown>, isRecord);
  return Object.fromEntries(Object.entries(value)
    .filter(([, records]) => Array.isArray(records))
    .map(([id, records]) => [id, (records as T[]).slice(-5000)]));
}
function writeMap<T>(key: string, map: Record<string, T[]>): void {
  if (!safeStorageSetJson(key, map)) {
    throw new Error('Annotations could not be saved. Browser storage may be unavailable or full.');
  }
}
function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const annotationTones = new Set<AnnotationTone>(['light', 'mid', 'dark', 'red', 'blue', 'green', 'yellow']);

function isTextAnnotation(value: unknown): value is TextAnnotation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.articleId === 'string'
    && typeof item.blockId === 'string'
    && typeof item.start === 'number' && Number.isFinite(item.start) && item.start >= 0
    && typeof item.end === 'number' && Number.isFinite(item.end) && item.end > item.start
    && typeof item.quote === 'string'
    && typeof item.prefix === 'string'
    && typeof item.suffix === 'string'
    && annotationTones.has(item.tone as AnnotationTone)
    && typeof item.note === 'string'
    && typeof item.createdAt === 'string';
}

function isDrawingPoint(value: unknown): value is DrawingPoint {
  if (!value || typeof value !== 'object') return false;

  const point = value as Record<string, unknown>;
  return typeof point.x === 'number'
    && Number.isFinite(point.x)
    && point.x >= 0
    && point.x <= 1
    && typeof point.y === 'number'
    && Number.isFinite(point.y)
    && point.y >= 0
    && point.y <= 1;
}

function isDrawingStroke(value: unknown): value is DrawingStroke {
  if (!value || typeof value !== 'object') return false;

  const stroke = value as Record<string, unknown>;
  return typeof stroke.id === 'string'
    && Array.isArray(stroke.points)
    && stroke.points.length > 0
    && stroke.points.every(isDrawingPoint)
    && annotationTones.has(stroke.tone as AnnotationTone)
    && typeof stroke.size === 'number'
    && Number.isFinite(stroke.size)
    && stroke.size > 0
    && stroke.size <= 100
    && (stroke.tool === 'pen' || stroke.tool === 'eraser');
}

export function getTextAnnotations(articleId: string): TextAnnotation[] {
  const value = readMap<unknown>(TEXT_KEY)[articleId];
  return Array.isArray(value) ? value.filter(isTextAnnotation) : [];
}

export function createTextAnnotation(input: Omit<TextAnnotation, 'id' | 'createdAt'>): TextAnnotation {
  const annotation: TextAnnotation = { ...input, id: makeId(), createdAt: new Date().toISOString() };
  const map = readMap<TextAnnotation>(TEXT_KEY);
  map[input.articleId] = [...(map[input.articleId] || []), annotation];
  writeMap(TEXT_KEY, map);
  return annotation;
}

export function removeTextAnnotation(articleId: string, annotationId: string): void {
  const map = readMap<TextAnnotation>(TEXT_KEY);
  map[articleId] = getTextAnnotations(articleId).filter((item) => item.id !== annotationId);
  writeMap(TEXT_KEY, map);
}

export function clearTextAnnotations(articleId: string): void {
  const map = readMap<TextAnnotation>(TEXT_KEY);
  map[articleId] = [];
  writeMap(TEXT_KEY, map);
}

export function updateTextAnnotation(articleId: string, annotationId: string, note: string): void {
  const map = readMap<TextAnnotation>(TEXT_KEY);
  map[articleId] = getTextAnnotations(articleId).map((item) => item.id === annotationId ? { ...item, note } : item);
  writeMap(TEXT_KEY, map);
}

export function getDrawingStrokes(articleId: string): DrawingStroke[] {
  const value = readMap<unknown>(DRAWING_KEY)[articleId];
  return Array.isArray(value) ? value.filter(isDrawingStroke) : [];
}

export function saveDrawingStrokes(articleId: string, strokes: DrawingStroke[]): boolean {
  try {
    const map = readMap<DrawingStroke>(DRAWING_KEY);
    map[articleId] = strokes;
    writeMap(DRAWING_KEY, map);
    return true;
  } catch { return false; }
}
