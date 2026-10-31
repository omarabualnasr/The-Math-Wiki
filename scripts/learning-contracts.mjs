import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-learning-'));
try {
  const localCompiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const command = existsSync(localCompiler) ? process.execPath : 'tsc';
  const prefix = existsSync(localCompiler) ? [localCompiler] : [];
  execFileSync(command, [
    ...prefix,
    'src/engine/learningEngine.ts',
    'src/engine/learningStorage.ts',
    'src/engine/polynomialEngine.ts',
    'src/engine/safeStorage.ts',
    '--target', 'ES2020', '--module', 'commonjs', '--strict', '--skipLibCheck', '--lib', 'ES2020,DOM', '--outDir', temp,
  ], { cwd: root, stdio: 'pipe' });
  const require = createRequire(import.meta.url);
  const learning = require(path.join(temp, 'engine/learningEngine.js'));
  const storage = require(path.join(temp, 'engine/learningStorage.js'));
  const article = {
    schemaVersion: 1, id: 'sum', slug: 'sum', title: 'Sum', level: 'Foundations', difficulty: 'Beginner',
    aliases: ['Total'], summary: 'Understand sums.', branch: 'arithmetic', status: 'published', relatedTopics: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    blocks: [
      { id: 'definition', type: 'definition', heading: 'Sum', content: 'A sum is the result obtained by combining quantities using addition.' },
      { id: 'example', type: 'example', heading: 'Simple example', question: 'Find the sum of 4, 3, and 2.', steps: ['Write 4 + 3 + 2.', 'Add to obtain 9.'], answer: 'The sum is 9.' },
      { id: 'formula', type: 'latex', heading: 'Sum formula', latex: 'S_n = n(n + 1)/2', display: true, explanation: 'The sum of the first n positive integers.' },
      { id: 'exercise', type: 'exercise', question: 'Calculate 6 + 7.', answer: '13', hint: 'Combine the two addends.' },
    ],
  };
  let seed = 42;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const questions = learning.generateQuestionSet(article, 10, 'Medium', random);
  assert.equal(questions.length, 10);
  assert.ok(questions.some((question) => question.generated), 'Arithmetic articles should include generated variants.');
  assert.ok(questions.some((question) => !question.generated), 'Article-authored questions should remain in the set.');
  const geometryArticle = { ...article, id: 'triangle', title: 'Triangle', branch: 'geometry', aliases: [], blocks: [], summary: 'A triangle is a polygon with three sides.' };
  const geometryQuestions = learning.generateQuestionSet(geometryArticle, 5, 'Easy', random);
  assert.equal(geometryQuestions.length, 1, 'Non-arithmetic topics must not be filled with unrelated arithmetic questions.');
  assert.equal(geometryQuestions[0].type, 'text');
  const numericQuestion = questions.find((question) => question.prompt === 'Find the sum of 4, 3, and 2.');
  assert.ok(numericQuestion);
  assert.equal(numericQuestion.type, 'numeric', 'Text-wrapped numeric answers should be checked numerically.');
  assert.equal(learning.checkLearningAnswer(numericQuestion, '4 + 3 + 2'), true);
  assert.equal(learning.checkLearningAnswer(numericQuestion, '8'), false);

  const formulaQuestion = { id: 'formula', prompt: 'Simplify', expectedAnswer: '(x + 2)*(x + 3)', type: 'expression', source: 'Algebra', topic: 'Algebra', difficulty: 'Medium', hintLevels: [], solutionSteps: [] };
  assert.equal(learning.checkLearningAnswer(formulaQuestion, 'x^2 + 5*x + 6'), true, 'Equivalent polynomial forms should be accepted.');
  assert.equal(learning.checkLearningAnswer(formulaQuestion, 'x^2 + 5*x + 7'), false);
  const textQuestion = { id: 'text', prompt: 'Define sum', expectedAnswer: 'A sum is the result obtained by combining quantities using addition.', type: 'text', source: 'Definition', topic: 'Sum', difficulty: 'Easy', hintLevels: [], solutionSteps: [] };
  assert.equal(learning.checkLearningAnswer(textQuestion, 'A sum is the result of combining quantities using addition.'), true);
  assert.equal(learning.checkLearningAnswer(textQuestion, 'I like mathematics.'), false);

  const score = learning.scoreQuestionSet([numericQuestion], { [numericQuestion.id]: '9' });
  assert.equal(score.score, 1);
  assert.equal(score.percent, 100);
  const cards = learning.buildArticleFlashcards(article);
  assert.ok(cards.length >= 4, 'Definitions, formula explanations, examples and exercises should become flashcards.');
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, 'Flashcard IDs should be stable and unique within an article.');

  const now = new Date('2026-10-31T08:00:00.000Z');
  const again = learning.scheduleFlashcardReview(cards[0], 'again', now);
  const good = learning.scheduleFlashcardReview(cards[0], 'good', now);
  const easy = learning.scheduleFlashcardReview(cards[0], 'easy', now);
  assert.ok(new Date(again.dueAt).getTime() - now.getTime() < 11 * 60 * 1000, 'Again should schedule a short retry.');
  assert.equal(new Date(good.dueAt).getTime() - now.getTime(), 24 * 60 * 60 * 1000, 'First Good rating should schedule one day.');
  assert.ok(new Date(easy.dueAt).getTime() - now.getTime() > 3 * 24 * 60 * 60 * 1000, 'Easy should schedule a longer interval.');
  assert.equal(good.reviewCount, 1);
  const attempt = learning.createLearningAttempt({ articleId: 'sum', articleTitle: 'Sum', mode: 'quiz', score: 1, total: 1, percent: 100, durationSeconds: 30, difficulty: 'Easy', results: score.results }, now);
  assert.equal(attempt.completedAt, now.toISOString());
  assert.equal(storage.isLearningState({ version: 1, attempts: [attempt], flashcards: cards }), true);
  assert.equal(storage.isLearningState({ version: 2, attempts: [], flashcards: [] }), false);
  assert.equal(storage.isLearningState({ version: 1, attempts: [{}], flashcards: [] }), false);

  const app = await readFile(path.join(root, 'src/app/App.tsx'), 'utf8');
  const articlePage = await readFile(path.join(root, 'src/features/articles/ArticlePage.tsx'), 'utf8');
  const studyPanel = await readFile(path.join(root, 'src/features/articles/StudyPanel.tsx'), 'utf8');
  const dashboard = await readFile(path.join(root, 'src/features/learning/LearningCenterPage.tsx'), 'utf8');
  const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(app, /path="\/learning" element={<LearningCenterPage \/>}/);
  assert.match(app, /label: 'Learning Center'/);
  assert.match(articlePage, /setStudyMode\('exam'\)/);
  assert.match(studyPanel, /progressive hints/i);
  assert.match(studyPanel, /Timed assessment/i);
  assert.match(dashboard, /SPACED REPETITION/);
  assert.match(dashboard, /Common mistakes/);
  assert.match(workflow, /npm run test:learning/);
  console.log('Learning contracts passed: article and generated questions, numerical and polynomial equivalence checking, text rubric checking, scoring, article flashcard generation, spaced-repetition scheduling, attempt records and learning-state validation.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
