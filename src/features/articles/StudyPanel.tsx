import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, ClipboardList, Clock3, FileQuestion, Lightbulb, Printer, RotateCcw, X } from 'lucide-react';
import type { MathArticle } from '../../types/article';
import { createLearningAttempt, generateQuestionSet, scoreQuestionSet, type LearningQuestion, type PracticeDifficulty } from '../../engine/learningEngine';
import { recordLearningAttempt } from '../../engine/learningStorage';

type StudyMode = 'quiz' | 'worksheet' | 'exam';

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export default function StudyPanel({ article, mode, onClose }: { article: MathArticle; mode: StudyMode; onClose: () => void }) {
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('Easy');
  const [questionCount, setQuestionCount] = useState(mode === 'worksheet' ? 10 : 5);
  const [timeLimit, setTimeLimit] = useState(10);
  const [questions, setQuestions] = useState<LearningQuestion[]>(() => mode === 'worksheet' ? generateQuestionSet(article, 10, 'Easy') : []);
  const [started, setStarted] = useState(mode === 'worksheet');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [printMode, setPrintMode] = useState<'questions' | 'answers'>('questions');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const startedAtRef = useRef<number>(0);
  const recordedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);

  const scoring = useMemo(() => scoreQuestionSet(questions, answers), [questions, answers]);

  const finishAttempt = useCallback(() => {
    if (submitted || mode === 'worksheet') return;
    setSubmitted(true);
    if (recordedRef.current) return;
    recordedRef.current = true;
    const completed = scoreQuestionSet(questions, answers);
    const durationSeconds = startedAtRef.current ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)) : 0;
    const attempt = createLearningAttempt({
      articleId: article.id,
      articleTitle: article.title,
      mode,
      score: completed.score,
      total: questions.length,
      percent: completed.percent,
      durationSeconds,
      difficulty,
      results: completed.results,
    });
    void recordLearningAttempt(attempt).then(() => setSaveNotice('Your result was saved to Learning Center.')).catch(() => setSaveNotice('Your result could not be saved. Check browser storage.'));
  }, [answers, article.id, article.title, difficulty, mode, questions, submitted]);

  useEffect(() => {
    if (!started || submitted || mode !== 'exam' || remainingSeconds === null) return;
    const timer = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(timer);
  }, [mode, started, submitted, remainingSeconds === null]);

  useEffect(() => {
    if (mode === 'exam' && started && remainingSeconds === 0 && !submitted) finishAttempt();
  }, [finishAttempt, mode, remainingSeconds, started, submitted]);

  const start = () => {
    const generated = generateQuestionSet(article, questionCount, difficulty);
    setQuestions(generated);
    setAnswers({});
    setRevealedHints({});
    setSubmitted(false);
    setSaveNotice('');
    const deadline = mode === 'exam' ? Date.now() + timeLimit * 60 * 1000 : null;
    deadlineRef.current = deadline;
    setRemainingSeconds(deadline === null ? null : Math.ceil((deadline - Date.now()) / 1000));
    recordedRef.current = false;
    startedAtRef.current = Date.now();
    setStarted(true);
  };

  const reset = () => {
    setStarted(false);
    setSubmitted(false);
    setAnswers({});
    setQuestions([]);
    setRemainingSeconds(null);
    deadlineRef.current = null;
    setSaveNotice('');
    recordedRef.current = false;
  };

  const printSheet = (sheet: 'questions' | 'answers') => {
    setPrintMode(sheet);
    if (sheet === 'answers') setShowAnswerKey(true);
    window.setTimeout(() => window.print(), 90);
  };

  const title = mode === 'exam' ? `${article.title} exam` : mode === 'quiz' ? `${article.title} quiz` : `${article.title} worksheet`;

  return <section className={`study-panel study-${mode}`} data-print-mode={printMode}>
    <div className="study-panel-head">
      <div className="study-panel-title"><span className="study-panel-icon">{mode === 'worksheet' ? <ClipboardList size={17}/> : mode === 'exam' ? <Clock3 size={17}/> : <FileQuestion size={17}/>}</span><div><div className="eyebrow">{mode === 'worksheet' ? 'PRACTICE SHEET' : mode === 'exam' ? 'TIMED ASSESSMENT' : 'KNOWLEDGE CHECK'}</div><h2>{title}</h2><p>{questions.length ? `${questions.length} questions · ${difficulty} · Answers are stored separately` : 'Build a practice set from this article and generated variants.'}</p></div></div>
      <button className="icon-button" onClick={onClose} aria-label="Close study panel"><X size={17}/></button>
    </div>

    {mode !== 'worksheet' && !started && <div className="learning-setup">
      <div className="learning-setup-copy"><strong>Configure your session</strong><span>Questions combine article content with generated practice variants where the topic supports them.</span></div>
      <div className="learning-setup-fields">
        <label><span>Questions</span><select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}><option value={5}>5 questions</option><option value={10}>10 questions</option><option value={15}>15 questions</option><option value={20}>20 questions</option></select></label>
        <label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as PracticeDifficulty)}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
        {mode === 'exam' && <label><span>Time limit</span><select value={timeLimit} onChange={(event) => setTimeLimit(Number(event.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={20}>20 minutes</option><option value={30}>30 minutes</option></select></label>}
      </div>
      <button className="button button-primary" onClick={start}>{mode === 'exam' ? 'Start exam' : 'Generate quiz'} <ChevronRight size={14}/></button>
    </div>}

    {mode !== 'worksheet' && started && <>
      <div className="learning-session-bar"><div className="learning-progress-track"><span style={{ width: `${questions.length ? (Object.keys(answers).filter((id) => (answers[id] || '').trim()).length / questions.length) * 100 : 0}%` }}/></div><span>{Object.keys(answers).filter((id) => (answers[id] || '').trim()).length} / {questions.length} answered</span>{mode === 'exam' && <strong className={remainingSeconds !== null && remainingSeconds < 60 ? 'is-urgent' : ''}><Clock3 size={13}/>{formatTime(remainingSeconds || 0)}</strong>}</div>
      <div className="study-quiz-questions">
        {questions.map((question, index) => {
          const answer = answers[question.id] || '';
          const correct = submitted ? scoring.results[index]?.correct : false;
          const hintIndex = revealedHints[question.id] || 0;
          return <div className="study-question-card" key={question.id}>
            <div className="study-question-meta"><span>QUESTION {String(index + 1).padStart(2, '0')}</span><span>{question.source} · {question.difficulty}{question.generated ? ' · Generated' : ''}</span></div>
            <h3>{question.prompt}</h3>
            {!submitted && question.hintLevels.length > 0 && mode !== 'exam' && <div className="learning-hint-controls"><button type="button" className="study-hint-button" onClick={() => setRevealedHints((current) => ({ ...current, [question.id]: Math.min((current[question.id] || 0) + 1, question.hintLevels.length) }))} disabled={hintIndex >= Math.min(3, question.hintLevels.length)}><Lightbulb size={13}/> Hint {Math.min(hintIndex + 1, 3)} of 3</button>{hintIndex > 0 && <span>{question.hintLevels.slice(0, hintIndex).join(' ')}</span>}</div>}
            {question.choices?.length ? <div className="learning-choice-list" role="group" aria-label={`Answers for question ${index + 1}`}>{question.choices.map((choice) => <button key={choice} type="button" className={`learning-choice ${answer === choice ? 'selected' : ''} ${submitted && choice === question.expectedAnswer ? 'is-answer' : ''}`} disabled={submitted} onClick={() => setAnswers((current) => ({ ...current, [question.id]: choice }))}><span>{choice}</span>{submitted && choice === question.expectedAnswer && <CheckCircle2 size={14}/>}</button>)}</div> : <label className="study-answer-input"><span>Your answer</span>{question.type === 'text' ? <textarea rows={3} value={answer} disabled={submitted} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Write your explanation..."/> : <input value={answer} disabled={submitted} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Enter your answer..."/>}</label>}
            {submitted && <div className={`study-feedback ${correct ? 'correct' : 'incorrect'}`}><strong>{correct ? 'Correct' : 'Review this answer'}</strong><span>Expected answer: {question.expectedAnswer}</span>{question.solutionSteps.length > 0 && <ol>{question.solutionSteps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>}</div>}
          </div>;
        })}
      </div>
      {submitted && <div className="study-score"><span>Your result</span><strong>{scoring.score} / {questions.length}</strong><span>{scoring.percent}%</span></div>}
      <div className="study-actions">
        {!submitted ? <><button className="button button-primary" onClick={finishAttempt}><CheckCircle2 size={14}/> Submit {mode === 'exam' ? 'exam' : 'answers'}</button><button className="button button-secondary" onClick={reset}>End session</button></> : <button className="button button-secondary" onClick={reset}><RotateCcw size={14}/> New session</button>}
        <span>{saveNotice || (mode === 'exam' ? 'Hints are disabled during a timed assessment. Unanswered questions are marked incorrect.' : 'You can reveal up to three progressive hints before submitting.')}</span>
      </div>
    </>}

    {mode === 'worksheet' && <>
      <div className="learning-setup learning-worksheet-settings"><div className="learning-setup-fields"><label><span>Questions</span><select value={questionCount} onChange={(event) => { const count = Number(event.target.value); setQuestionCount(count); setQuestions(generateQuestionSet(article, count, difficulty)); }}><option value={5}>5 questions</option><option value={10}>10 questions</option><option value={15}>15 questions</option><option value={20}>20 questions</option></select></label><label><span>Difficulty</span><select value={difficulty} onChange={(event) => { const next = event.target.value as PracticeDifficulty; setDifficulty(next); setQuestions(generateQuestionSet(article, questionCount, next)); }}><option>Easy</option><option>Medium</option><option>Hard</option></select></label></div><span>Generated questions use validated templates and keep solutions separate.</span></div>
      <div className="study-sheet-intro"><span>Name: _________________________________</span><span>Date: ______________</span></div>
      <div className="study-question-sheet">{questions.map((question, index) => <div className="worksheet-question" key={question.id}><div className="worksheet-number">{index + 1}.</div><div><h3>{question.prompt}</h3><div className="worksheet-workspace" /></div></div>)}</div>
      <section className={`study-answer-key ${showAnswerKey ? 'is-open' : ''}`}><div className="study-answer-key-head"><div><div className="eyebrow">SEPARATE ANSWER KEY</div><h3>Solutions</h3></div><button className="button button-secondary study-answer-key-toggle" onClick={() => setShowAnswerKey((value) => !value)}>{showAnswerKey ? 'Hide answers' : 'Show answer key'}</button></div>{showAnswerKey && <div className="study-answer-key-content">{questions.map((question, index) => <div className="study-solution" key={question.id}><strong>{index + 1}. {question.source}</strong><p>{question.expectedAnswer}</p>{question.solutionSteps.map((step, stepIndex) => <small key={stepIndex}>{stepIndex + 1}. {step}<br/></small>)}{question.hintLevels[0] && <small>Hint: {question.hintLevels[0]}</small>}</div>)}</div>}</section>
      <div className="study-actions"><button className="button button-primary" onClick={() => printSheet('questions')}><Printer size={14}/> Print worksheet / Save PDF</button><button className="button button-secondary" onClick={() => printSheet('answers')}><Printer size={14}/> Print answer key separately</button><span>The worksheet and answer key can be exported independently.</span></div>
    </>}
  </section>;
}
