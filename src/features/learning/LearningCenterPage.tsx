import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Flame, Layers3, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAllArticles } from '../../engine/articleStorage';
import { buildArticleFlashcards, scheduleFlashcardReview, type Flashcard, type FlashcardRating, type LearningAttempt } from '../../engine/learningEngine';
import { loadLearningState, removeFlashcard, saveReviewedFlashcard, upsertFlashcards } from '../../engine/learningStorage';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function dueAtOrBeforeNow(card: Flashcard): boolean { return new Date(card.dueAt).getTime() <= Date.now(); }

export default function LearningCenterPage() {
  const [attempts, setAttempts] = useState<LearningAttempt[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedArticle, setSelectedArticle] = useState('');
  const [activeCard, setActiveCard] = useState<Flashcard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const articles = useMemo(() => getAllArticles().filter((article) => article.status === 'published' || article.status === 'draft'), []);
  const dueCards = useMemo(() => flashcards.filter(dueAtOrBeforeNow).sort((a, b) => a.dueAt.localeCompare(b.dueAt)), [flashcards]);
  const averageAccuracy = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / attempts.length) : 0;
  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const wrongTopics = useMemo(() => {
    const counts = new Map<string, number>();
    attempts.flatMap((attempt) => attempt.results).filter((result) => !result.correct).forEach((result) => counts.set(result.topic, (counts.get(result.topic) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [attempts]);

  const refresh = async () => {
    setLoading(true);
    try {
      const state = await loadLearningState();
      setAttempts(state.attempts);
      setFlashcards(state.flashcards);
      setLoadError('');
      setActiveCard((current) => current ? state.flashcards.find((card) => card.id === current.id) || null : null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Saved learning data could not be validated. Existing data has been left untouched.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const createCards = async () => {
    const article = articles.find((item) => item.id === selectedArticle);
    if (!article) return;
    const generated = buildArticleFlashcards(article);
    if (!generated.length) { setNotice('This article does not contain supported flashcard content yet.'); return; }
    try {
      const before = flashcards.length;
      const total = await upsertFlashcards(generated);
      const added = Math.max(0, total - before);
      await refresh();
      setNotice(added ? `${added} flashcards added from ${article.title}.` : 'These flashcards are already in your collection.');
    } catch { setNotice('Flashcards could not be saved. Check browser storage.'); }
  };

  const startReview = () => {
    const next = dueCards[0];
    setActiveCard(next || null);
    setRevealed(false);
    if (!next) setNotice('You are up to date. No flashcards are due for review.');
  };

  const rateCard = async (rating: FlashcardRating) => {
    if (!activeCard) return;
    const updated = scheduleFlashcardReview(activeCard, rating);
    try {
      await saveReviewedFlashcard(updated);
      setActiveCard(null);
      setRevealed(false);
      await refresh();
      setNotice('Review saved. Your next review has been scheduled.');
    } catch { setNotice('Your review could not be saved.'); }
  };

  const deleteCard = async (card: Flashcard) => {
    try { await removeFlashcard(card.id); await refresh(); setNotice('Flashcard removed.'); }
    catch { setNotice('Flashcard could not be removed.'); }
  };

  return <div className="page-stack learning-center-page">
    <div className="page-heading"><div><div className="eyebrow">PERSONAL LEARNING</div><h1>Learning Center</h1><p>Review what you have studied, practise concepts, and build durable recall with scheduled flashcards.</p></div><div className="learning-heading-action"><Link to="/branches" className="button button-secondary"><BookOpen size={14}/> Explore topics</Link></div></div>

    {loadError ? <div className="learning-load-error" role="alert"><strong>Your saved learning data needs attention</strong><p>{loadError}</p><p>The application has not replaced the saved records with an empty learning history.</p><button className="button button-secondary" onClick={() => void refresh()}>Try again</button></div> : <>
    <section className="learning-stats-grid">
      <div className="learning-stat-card"><span><Layers3 size={15}/> Practice sessions</span><strong>{attempts.length}</strong><small>Quizzes and exams completed</small></div>
      <div className="learning-stat-card"><span><CheckCircle2 size={15}/> Average accuracy</span><strong>{averageAccuracy}%</strong><small>{totalCorrect} correct of {totalQuestions} questions</small></div>
      <div className="learning-stat-card"><span><Clock3 size={15}/> Due flashcards</span><strong>{dueCards.length}</strong><small>{flashcards.length} cards in your collection</small></div>
      <div className="learning-stat-card"><span><Flame size={15}/> Review coverage</span><strong>{flashcards.filter((card) => card.reviewCount > 0).length}</strong><small>Cards reviewed at least once</small></div>
    </section>

    {notice && <div className="learning-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}

    {activeCard ? <section className="learning-review-panel">
      <div className="learning-section-heading"><div><div className="eyebrow">SPACED REPETITION</div><h2>Flashcard review</h2><p>{activeCard.articleTitle} · {dueCards.length} due remaining including this card</p></div><button className="button button-secondary" onClick={() => { setActiveCard(null); setRevealed(false); }}>Close review</button></div>
      <div className="learning-flashcard" aria-live="polite"><div className="learning-flashcard-label">{revealed ? 'ANSWER' : 'QUESTION'}</div><div className="learning-flashcard-content">{revealed ? activeCard.back : activeCard.front}</div>{!revealed && <button className="button button-primary" onClick={() => setRevealed(true)}>Reveal answer <ArrowRight size={14}/></button>}{revealed && <div className="learning-rating-row"><span>How well did you recall it?</span><button onClick={() => void rateCard('again')}>Again</button><button onClick={() => void rateCard('hard')}>Hard</button><button onClick={() => void rateCard('good')}>Good</button><button onClick={() => void rateCard('easy')}>Easy</button></div>}</div>
    </section> : <section className="learning-card-generator">
      <div><div className="eyebrow">BUILD YOUR REVIEW DECK</div><h2>Create flashcards from an article</h2><p>Definitions, theorems, formulas with explanations, worked examples, exercises and table properties can become review cards.</p></div>
      <div className="learning-generator-controls"><select value={selectedArticle} onChange={(event) => setSelectedArticle(event.target.value)} aria-label="Choose article"><option value="">Choose an article...</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.title}{article.status === 'draft' ? ' · Draft' : ''}</option>)}</select><button className="button button-primary" onClick={() => void createCards()} disabled={!selectedArticle}><Sparkles size={14}/> Generate flashcards</button><button className="button button-secondary" onClick={startReview} disabled={!dueCards.length}><RotateCcw size={14}/> Review due ({dueCards.length})</button></div>
    </section>}

    <div className="learning-content-grid">
      <section className="learning-content-card"><div className="learning-section-heading"><div><div className="eyebrow">YOUR HISTORY</div><h2>Recent practice</h2></div><span className="learning-count">{attempts.length}</span></div>
        {loading ? <div className="learning-empty">Loading learning data…</div> : attempts.length ? <div className="learning-attempt-list">{attempts.slice(0, 8).map((attempt) => <div className="learning-attempt-row" key={attempt.id}><div className="learning-attempt-main"><strong>{attempt.articleTitle}</strong><span>{attempt.mode === 'exam' ? 'Timed exam' : 'Quiz'} · {attempt.difficulty} · {formatDate(attempt.completedAt)}</span></div><div className="learning-attempt-score"><strong>{attempt.percent}%</strong><span>{attempt.score}/{attempt.total}</span></div></div>)}</div> : <div className="learning-empty"><BookOpen size={22}/><strong>No practice sessions yet</strong><span>Open a mathematics article and create a quiz or timed exam to begin tracking your progress.</span></div>}
      </section>
      <section className="learning-content-card"><div className="learning-section-heading"><div><div className="eyebrow">AREAS TO REVISIT</div><h2>Common mistakes</h2></div><span className="learning-count">{wrongTopics.length}</span></div>
        {wrongTopics.length ? <div className="learning-mistake-list">{wrongTopics.map(([topic, count]) => <div key={topic}><span>{topic}</span><strong>{count} {count === 1 ? 'miss' : 'misses'}</strong></div>)}</div> : <div className="learning-empty"><CheckCircle2 size={22}/><strong>No mistakes recorded</strong><span>Completed quizzes and exams will show the topics that need more practice.</span></div>}
      </section>
    </div>

    <section className="learning-content-card"><div className="learning-section-heading"><div><div className="eyebrow">MEMORY PRACTICE</div><h2>Your flashcards</h2><p>Review intervals adapt to your recall rating. Again schedules a short retry; Easy schedules a longer interval.</p></div><span className="learning-count">{flashcards.length}</span></div>
      {flashcards.length ? <div className="learning-flashcard-list">{flashcards.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 30).map((card) => <div className="learning-flashcard-row" key={card.id}><div><strong>{card.front}</strong><span>{card.articleTitle} · Due {formatDate(card.dueAt)}</span></div><button className="icon-button" onClick={() => void deleteCard(card)} aria-label={`Delete flashcard ${card.front}`}><Trash2 size={15}/></button></div>)}</div> : <div className="learning-empty compact"><Layers3 size={22}/><strong>Your deck is empty</strong><span>Generate cards from an article to start a spaced-repetition collection.</span></div>}
    </section>

    <div className="learning-disclaimer">Learning data is saved locally in this browser. It is not synchronized between devices and is not connected to an account.</div>
    </>}
  </div>;
}
