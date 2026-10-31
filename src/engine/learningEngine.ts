import type { MathArticle, ArticleBlock } from '../types/article';
import { parsePolynomial } from './polynomialEngine';

export type PracticeDifficulty = 'Easy' | 'Medium' | 'Hard';
export type LearningQuestionType = 'numeric' | 'expression' | 'text' | 'choice';

export interface LearningQuestion {
  id: string;
  prompt: string;
  expectedAnswer: string;
  type: LearningQuestionType;
  source: string;
  topic: string;
  difficulty: PracticeDifficulty;
  choices?: string[];
  hintLevels: string[];
  solutionSteps: string[];
  generated?: boolean;
}

export interface QuestionResult {
  questionId: string;
  prompt: string;
  expectedAnswer: string;
  userAnswer: string;
  correct: boolean;
  topic: string;
}

export interface LearningAttempt {
  id: string;
  articleId: string;
  articleTitle: string;
  mode: 'quiz' | 'exam';
  score: number;
  total: number;
  percent: number;
  durationSeconds: number;
  completedAt: string;
  difficulty: PracticeDifficulty;
  results: QuestionResult[];
}

export interface Flashcard {
  id: string;
  articleId: string;
  articleTitle: string;
  front: string;
  back: string;
  createdAt: string;
  dueAt: string;
  lastReviewedAt?: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  reviewCount: number;
}

const STOP_WORDS = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'into', 'when', 'what', 'which', 'where', 'then', 'than', 'are', 'was', 'were', 'for', 'its', 'using', 'used', 'can', 'will', 'has', 'have', 'two', 'one', 'also', 'their', 'there', 'such', 'more', 'less', 'each', 'value', 'values']);

function makeId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${random}`;
}

function cleanText(value: string): string {
  return value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\s+/g, ' ').trim();
}

function classifyAnswer(answer: string): LearningQuestionType {
  const source = answer.trim();
  if (/^[A-D]$/i.test(source)) return 'choice';
  if (/^[\s\d.+\-*/^()=πpi]*$/i.test(source) && /\d/.test(source)) return source.includes('x') || source.includes('y') ? 'expression' : 'numeric';
  if (/=\s*-?\d+(?:\.\d+)?\s*\.?$/.test(source)) return 'numeric';
  const numbers = source.match(/-?\d+(?:\.\d+)?/g) || [];
  if (numbers.length === 1 && /(?:is|equals|result|answer|total|sum)\s+(?:equal to\s+)?-?\d/i.test(source)) return 'numeric';
  if (/[a-z]\s*[=+*/^()-]|[a-z]\^\d/i.test(source) && !/^(the |a |an )/i.test(source)) return 'expression';
  return 'text';
}

function questionFromBlock(block: ArticleBlock, article: MathArticle): LearningQuestion | null {
  const base = { id: `article-${article.id}-${block.id}`, source: block.heading || article.title, topic: block.heading || article.title, difficulty: 'Easy' as const, generated: false };
  if (block.type === 'exercise' && block.answer?.trim()) {
    return { ...base, prompt: block.question, expectedAnswer: cleanText(block.answer), type: classifyAnswer(block.answer), hintLevels: block.hint ? [block.hint, 'Identify the mathematical operation or definition involved.', 'Work through the expression one step at a time.'] : ['Identify the mathematical operation or definition involved.', 'Work through the expression one step at a time.', 'Check the result by substituting it back.'], solutionSteps: [] };
  }
  if (block.type === 'example') {
    return { ...base, prompt: block.question, expectedAnswer: cleanText(block.answer), type: classifyAnswer(block.answer), hintLevels: block.steps.slice(0, 3), solutionSteps: block.steps };
  }
  if (block.type === 'definition') {
    return { ...base, prompt: `Explain the definition of ${block.heading || article.title}.`, expectedAnswer: cleanText(block.content), type: 'text', hintLevels: ['Recall the key mathematical idea, not just the wording.', 'Identify the main object and the operation or property that defines it.', 'Use the essential terms from the article definition.'], solutionSteps: [cleanText(block.content)] };
  }
  if (block.type === 'theorem' || block.type === 'lemma' || block.type === 'corollary' || block.type === 'proposition' || block.type === 'axiom') {
    const label = block.type[0].toUpperCase() + block.type.slice(1);
    return { ...base, prompt: `State the ${label.toLowerCase()}${block.heading ? ` “${block.heading}”` : ''}.`, expectedAnswer: cleanText(block.statement), type: 'text', hintLevels: ['Recall the statement and its conditions.', 'Pay attention to the assumptions and conclusion.', 'State the complete mathematical relationship.'], solutionSteps: [cleanText(block.statement)] };
  }
  if (block.type === 'latex' && block.explanation?.trim() && block.heading) {
    return { ...base, prompt: `Which mathematical notation represents “${block.heading}”?`, expectedAnswer: cleanText(block.latex), type: 'expression', hintLevels: [cleanText(block.explanation)], solutionSteps: [cleanText(block.latex), cleanText(block.explanation)] };
  }
  return null;
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function makeChoices(answer: number, random: () => number): string[] {
  const candidates = new Set<number>([answer]);
  const offsets = [1, -1, 2, -2, 5, -5, 10, -10];
  while (candidates.size < 4) {
    const offset = offsets[randomInt(random, 0, offsets.length - 1)] * (random() < 0.35 ? 2 : 1);
    candidates.add(answer + offset);
  }
  return [...candidates].sort(() => random() - 0.5).map(String);
}

export function generateArithmeticQuestion(difficulty: PracticeDifficulty = 'Easy', random: () => number = Math.random): LearningQuestion {
  let left: number;
  let right: number;
  let operator: '+' | '−' | '×' | '÷';
  if (difficulty === 'Easy') {
    left = randomInt(random, 2, 25);
    right = randomInt(random, 1, 20);
    operator = random() < 0.72 ? '+' : '−';
    if (operator === '−' && right > left) [left, right] = [right, left];
  } else if (difficulty === 'Medium') {
    operator = random() < 0.5 ? '×' : '÷';
    if (operator === '×') { left = randomInt(random, 3, 15); right = randomInt(random, 3, 12); }
    else { right = randomInt(random, 2, 12); left = right * randomInt(random, 2, 15); }
  } else {
    operator = random() < 0.5 ? '+' : '×';
    left = randomInt(random, 12, 60);
    right = randomInt(random, 8, 40);
  }
  const answer = operator === '+' ? left + right : operator === '−' ? left - right : operator === '×' ? left * right : left / right;
  const prompt = `${left} ${operator} ${right} = ?`;
  return {
    id: makeId('generated-arithmetic'), prompt, expectedAnswer: String(answer), type: 'choice', source: 'Generated arithmetic', topic: 'Arithmetic', difficulty,
    choices: makeChoices(answer, random), generated: true,
    hintLevels: [`Identify the operation shown by ${operator}.`, operator === '×' || operator === '÷' ? 'Use multiplication facts or the inverse operation.' : 'Combine the two quantities carefully.', `Calculate ${left} ${operator} ${right}.`],
    solutionSteps: [`Start with ${left} ${operator} ${right}.`, `Apply ${operator === '+' ? 'addition' : operator === '−' ? 'subtraction' : operator === '×' ? 'multiplication' : 'division'}.`, `The result is ${answer}.`],
  };
}

export function generateIntegerSumQuestion(difficulty: PracticeDifficulty = 'Medium', random: () => number = Math.random): LearningQuestion {
  const n = randomInt(random, difficulty === 'Hard' ? 12 : 4, difficulty === 'Hard' ? 60 : 18);
  const answer = n * (n + 1) / 2;
  return {
    id: makeId('generated-sum'), prompt: `Find the sum of the first ${n} positive integers: 1 + 2 + 3 + ⋯ + ${n}.`, expectedAnswer: String(answer), type: 'numeric', source: 'Generated summation', topic: 'Summation', difficulty, generated: true,
    hintLevels: ['The terms form the sequence of positive integers.', 'Use the formula Sₙ = n(n + 1) / 2.', `Substitute n = ${n}.`],
    solutionSteps: [`Use Sₙ = n(n + 1) / 2.`, `Substitute n = ${n}: Sₙ = ${n} × ${n + 1} / 2.`, `Evaluate to obtain ${answer}.`],
  };
}

export function generateQuestionSet(article: MathArticle, count = 5, difficulty: PracticeDifficulty = 'Easy', random: () => number = Math.random): LearningQuestion[] {
  const total = Math.max(1, Math.min(30, Math.floor(count)));
  const authored = article.blocks.map((block) => questionFromBlock(block, article)).filter((item): item is LearningQuestion => item !== null);
  const arithmeticContext = article.branch === 'arithmetic' || /sum|addition|arithmetic|summation/i.test(`${article.title} ${article.aliases.join(' ')}`);
  const result: LearningQuestion[] = [];
  const pool = authored.slice().sort(() => random() - 0.5);
  const generatedTarget = arithmeticContext ? Math.min(total, Math.max(1, Math.ceil(total * 0.4))) : 0;
  const authoredTarget = Math.min(pool.length, total - generatedTarget);
  while (result.length < authoredTarget && pool.length) result.push(pool.shift()!);
  if (!arithmeticContext && authored.length === 0 && article.summary.trim()) {
    result.push({ id: `article-${article.id}-overview`, prompt: `Summarize the central idea of ${article.title}.`, expectedAnswer: cleanText(article.summary), type: 'text', source: 'Article overview', topic: article.title, difficulty, hintLevels: ['Identify the main mathematical object and what the article explains.', 'Use the essential concepts from the article summary.'], solutionSteps: [cleanText(article.summary)] });
  }
  while (result.length < total) {
    if (arithmeticContext) {
      result.push(random() < 0.42 ? generateIntegerSumQuestion(difficulty, random) : generateArithmeticQuestion(difficulty, random));
    } else if (authored.length > 0) {
      const repeated = authored[(result.length - authoredTarget) % authored.length];
      result.push({ ...repeated, id: `${repeated.id}-review-${result.length}`, prompt: `Review: ${repeated.prompt}` });
    } else {
      break;
    }
  }
  return result.map((question, index) => ({ ...question, id: `${question.id}-${index}-${makeId('q').slice(-7)}` }));
}

function parseScalar(source: string): number | null {
  const cleaned = source.replace(/,/g, '').replace(/−/g, '-').trim();
  if (!cleaned) return null;
  try {
    const polynomial = parsePolynomial(cleaned, 'x');
    if (polynomial.length === 1 && Number.isFinite(polynomial[0])) return polynomial[0];
  } catch { /* Try a plain numeric form below. */ }
  const match = cleaned.match(/(?:=|:|\bis\b)\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\.?$/i) || cleaned.match(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\.?$/i);
  if (match) {
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function polynomialEquivalent(actual: string, expected: string): boolean {
  try {
    const left = parsePolynomial(actual.replace(/\s/g, ''), 'x');
    const right = parsePolynomial(expected.replace(/\s/g, ''), 'x');
    const size = Math.max(left.length, right.length);
    return Array.from({ length: size }, (_, index) => Math.abs((left[index] || 0) - (right[index] || 0))).every((difference) => difference < 1e-9);
  } catch { return false; }
}

function normalizedWords(source: string): string[] {
  return source.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function checkLearningAnswer(question: LearningQuestion, submitted: string): boolean {
  const actual = submitted.trim();
  const expected = question.expectedAnswer.trim();
  if (!actual || !expected) return false;
  if (question.type === 'choice') return actual.toLowerCase() === expected.toLowerCase();
  if (question.type === 'numeric') {
    const a = parseScalar(actual);
    const b = parseScalar(expected);
    return a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  }
  if (question.type === 'expression') {
    if (polynomialEquivalent(actual, expected)) return true;
    return actual.replace(/\s/g, '').toLowerCase() === expected.replace(/\s/g, '').toLowerCase();
  }
  const normalizedActual = actual.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const normalizedExpected = expected.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  if (normalizedActual === normalizedExpected) return true;
  const keywords = [...new Set(normalizedWords(expected))];
  if (keywords.length < 3) return false;
  const supplied = new Set(normalizedWords(actual));
  const coverage = keywords.filter((word) => supplied.has(word)).length / keywords.length;
  return coverage >= 0.72;
}

export function scoreQuestionSet(questions: LearningQuestion[], answers: Record<string, string>): { score: number; percent: number; results: QuestionResult[] } {
  const results = questions.map((question) => {
    const userAnswer = answers[question.id] || '';
    return { questionId: question.id, prompt: question.prompt, expectedAnswer: question.expectedAnswer, userAnswer, correct: checkLearningAnswer(question, userAnswer), topic: question.topic };
  });
  const score = results.filter((result) => result.correct).length;
  return { score, percent: results.length ? Math.round(score / results.length * 100) : 0, results };
}

function stableId(source: string): string {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return `flash-${(hash >>> 0).toString(36)}`;
}

export function buildArticleFlashcards(article: MathArticle): Flashcard[] {
  const cards: Flashcard[] = [];
  const now = new Date().toISOString();
  const add = (blockId: string, index: number, front: string, back: string) => {
    if (!front.trim() || !back.trim()) return;
    cards.push({ id: stableId(`${article.id}:${blockId}:${index}`), articleId: article.id, articleTitle: article.title, front: front.trim(), back: back.trim(), createdAt: now, dueAt: now, intervalDays: 0, easeFactor: 2.5, repetitions: 0, reviewCount: 0 });
  };
  article.blocks.forEach((block) => {
    if (block.type === 'definition') add(block.id, 0, `Define: ${block.heading || article.title}`, block.content);
    else if (block.type === 'theorem' || block.type === 'lemma' || block.type === 'corollary' || block.type === 'proposition' || block.type === 'axiom') add(block.id, 0, `State the ${block.type}: ${block.heading || article.title}`, block.statement);
    else if (block.type === 'latex' && block.explanation) add(block.id, 0, `Recall the formula: ${block.heading || 'Mathematical formula'}`, `${block.latex}\n\n${block.explanation}`);
    else if (block.type === 'example') add(block.id, 0, block.question, `${block.answer}\n\n${block.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`);
    else if (block.type === 'exercise' && block.answer) add(block.id, 0, block.question, block.answer);
    else if (block.type === 'table') block.rows.forEach((row, index) => { if (row.length >= 2) add(block.id, index, `What is the ${row[0]} property?`, row.slice(1).join(' — ')); });
  });
  return cards;
}

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export function scheduleFlashcardReview(card: Flashcard, rating: FlashcardRating, now = new Date()): Flashcard {
  const next = { ...card, reviewCount: card.reviewCount + 1, lastReviewedAt: now.toISOString() };
  let ease = card.easeFactor;
  let interval = card.intervalDays;
  let repetitions = card.repetitions;
  if (rating === 'again') {
    repetitions = 0;
    interval = 10 / (24 * 60); // Retry after ten minutes.
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === 'hard') {
    repetitions += 1;
    interval = Math.max(1, interval === 0 ? 1 : interval * 1.2);
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === 'good') {
    repetitions += 1;
    interval = interval === 0 ? 1 : repetitions === 1 ? 3 : interval * ease;
  } else {
    repetitions += 1;
    interval = interval === 0 ? 4 : Math.max(4, interval * (ease + 0.3));
    ease = Math.min(3.2, ease + 0.15);
  }
  next.easeFactor = ease;
  next.intervalDays = Math.min(365, interval);
  next.repetitions = repetitions;
  next.dueAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
  return next;
}

export function createLearningAttempt(input: Omit<LearningAttempt, 'id' | 'completedAt'>, now = new Date()): LearningAttempt {
  return { ...input, id: makeId('attempt'), completedAt: now.toISOString() };
}
