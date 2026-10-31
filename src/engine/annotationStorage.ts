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
