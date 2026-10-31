import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, FileQuestion, Printer, RotateCcw, X } from 'lucide-react';
import type { MathArticle } from '../../types/article';

type StudyMode = 'quiz' | 'worksheet';
interface StudyQuestion { id: string; question: string; answer: string; hint?: string; source: string }

function buildQuestions(article: MathArticle): StudyQuestion[] {
  const questions: StudyQuestion[] = [];
  article.blocks.forEach((block) => {
    if (block.type === 'exercise' && block.answer) {
      questions.push({ id: block.id, question: block.question, answer: block.answer, hint: block.hint, source: block.heading || 'Practice' });
    } else if (block.type === 'example') {
      questions.push({ id: block.id, question: block.question, answer: block.answer, source: block.heading || 'Worked example' });
    } else if (block.type === 'definition') {
      questions.push({ id: block.id, question: `Define ${block.heading?.toLowerCase() || article.title.toLowerCase()}.`, answer: block.content, source: block.heading || 'Definition' });
    }
  });
  if (questions.length === 0) {
    const explanation = article.blocks.find((block) => block.type === 'text' || block.type === 'definition');
    const answer = explanation && (explanation.type === 'text' || explanation.type === 'definition') ? explanation.content : article.summary;
    questions.push({ id: 'overview', question: `Explain the main idea of ${article.title}.`, answer, source: 'Article overview' });
  }
  return questions;
}

function normalize(value: string): string { return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' '); }
function finalNumber(value: string): string | null {
  const matches = value.match(/-?\d+(?:\.\d+)?/g);
  return matches?.[matches.length - 1] || null;
}
function isCorrect(userValue: string, expected: string): boolean {
  const actualNumber = finalNumber(userValue);
  const expectedNumber = finalNumber(expected);
  if (actualNumber && expectedNumber) return Number(actualNumber) === Number(expectedNumber);
  const actual = normalize(userValue);
  const target = normalize(expected);
  return Boolean(actual) && (actual === target || (target.length > 12 && target.includes(actual)));
}

export default function StudyPanel({ article, mode, onClose }: { article: MathArticle; mode: StudyMode; onClose: () => void }) {
  const questions = useMemo(() => buildQuestions(article), [article]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [printMode, setPrintMode] = useState<'questions' | 'answers'>('questions');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const score = questions.reduce((total, question) => total + (isCorrect(answers[question.id] || '', question.answer) ? 1 : 0), 0);

  const printSheet = (sheet: 'questions' | 'answers') => {
    setPrintMode(sheet);
    if (sheet === 'answers') setShowAnswerKey(true);
    window.setTimeout(() => window.print(), 90);
  };
  const reset = () => { setAnswers({}); setSubmitted(false); };

  return <section className={`study-panel study-${mode}`} data-print-mode={printMode}>
    <div className="study-panel-head">
      <div className="study-panel-title"><span className="study-panel-icon">{mode === 'quiz' ? <FileQuestion size={17}/> : <ClipboardList size={17}/>}</span><div><div className="eyebrow">{mode === 'quiz' ? 'KNOWLEDGE CHECK' : 'PRACTICE SHEET'}</div><h2>{mode === 'quiz' ? `${article.title} quiz` : `${article.title} worksheet`}</h2><p>{questions.length} questions · Answers are kept separately</p></div></div>
      <button className="icon-button" onClick={onClose} aria-label="Close study panel"><X size={17}/></button>
    </div>

    {mode === 'quiz' ? <>
      <div className="study-quiz-questions">
        {questions.map((question, index) => <div className="study-question-card" key={question.id}>
          <div className="study-question-meta"><span>QUESTION {String(index + 1).padStart(2, '0')}</span><span>{question.source}</span></div>
          <h3>{question.question}</h3>
          {question.hint && <details className="study-hint"><summary>Show hint</summary><p>{question.hint}</p></details>}
          <label className="study-answer-input"><span>Your answer</span><textarea rows={2} value={answers[question.id] || ''} disabled={submitted} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Write your answer..." /></label>
          {submitted && <div className={`study-feedback ${isCorrect(answers[question.id] || '', question.answer) ? 'correct' : 'incorrect'}`}><strong>{isCorrect(answers[question.id] || '', question.answer) ? 'Correct' : 'Review this answer'}</strong><span>{question.answer}</span></div>}
        </div>)}
      </div>
      {submitted && <div className="study-score"><span>Your result</span><strong>{score} / {questions.length}</strong><span>{Math.round((score / questions.length) * 100)}%</span></div>}
      <div className="study-actions">
        {submitted ? <button className="button button-secondary" onClick={reset}><RotateCcw size={14}/> Try again</button> : <button className="button button-primary" onClick={() => setSubmitted(true)} disabled={questions.some((question) => !(answers[question.id] || '').trim())}>Check answers <CheckCircle2 size={14}/></button>}
        <span>Questions are generated from the article's examples, definitions and exercises.</span>
      </div>
    </> : <>
      <div className="study-sheet-intro"><span>Name: _________________________________</span><span>Date: ______________</span></div>
      <div className="study-question-sheet">
        {questions.map((question, index) => <div className="worksheet-question" key={question.id}><div className="worksheet-number">{index + 1}.</div><div><h3>{question.question}</h3><div className="worksheet-workspace" /></div></div>)}
      </div>
      <section className={`study-answer-key ${showAnswerKey ? 'is-open' : ''}`}><div className="study-answer-key-head"><div><div className="eyebrow">SEPARATE ANSWER KEY</div><h3>Solutions</h3></div><button className="button button-secondary study-answer-key-toggle" onClick={() => setShowAnswerKey((value) => !value)}>{showAnswerKey ? 'Hide answers' : 'Show answer key'}</button></div>
        {showAnswerKey && <div className="study-answer-key-content">{questions.map((question, index) => <div className="study-solution" key={question.id}><strong>{index + 1}. {question.source}</strong><p>{question.answer}</p>{question.hint && <small>Hint: {question.hint}</small>}</div>)}</div>}
      </section>
      <div className="study-actions"><button className="button button-primary" onClick={() => printSheet('questions')}><Printer size={14}/> Print worksheet / Save PDF</button><button className="button button-secondary" onClick={() => printSheet('answers')}><Printer size={14}/> Print answer key separately</button><span>The worksheet and answer key can be exported independently.</span></div>
    </>}
  </section>;
}
