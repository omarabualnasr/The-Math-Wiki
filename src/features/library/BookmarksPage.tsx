import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookOpen, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAllArticles } from '../../engine/articleStorage';
import { getBookmarks, toggleBookmark } from '../../engine/readerTools';
import type { MathArticle } from '../../types/article';

export default function BookmarksPage() {
  const [ids, setIds] = useState<string[]>(getBookmarks);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const refresh = () => setIds(getBookmarks());
    window.addEventListener('math-wiki:bookmarks-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('math-wiki:bookmarks-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const articles = useMemo(() => {
    const all = getAllArticles();
    return ids.map((id) => all.find((article) => article.id === id)).filter((article): article is MathArticle => Boolean(article));
  }, [ids]);
  const filtered = articles.filter((article) => `${article.title} ${article.aliases.join(' ')} ${article.summary}`.toLowerCase().includes(query.trim().toLowerCase()));

  const remove = (id: string) => {
    try {
      toggleBookmark(id);
      setIds(getBookmarks());
    } catch {
      window.alert('This bookmark could not be removed because browser storage is unavailable.');
    }
  };

  return <div className="page-stack bookmarks-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h1>Bookmarks</h1><p>Articles you have saved for quick access on this device.</p></div><span className="count-chip">{articles.length} saved</span></div>
    <div className="catalogue-toolbar"><label className="catalogue-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your bookmarks..." /></label><span className="catalogue-count">{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}</span></div>
    {filtered.length ? <div className="library-list">{filtered.map((article) => <article className="library-row" key={article.id}>
      <div className="library-item-icon"><BookOpen size={17} /></div>
      <div className="library-item-copy"><strong>{article.title}</strong><span>{article.level} · {article.difficulty}</span><small>{article.summary || 'Mathematics article'}</small></div>
      <div className="library-item-actions"><Link to={`/articles/${article.slug}`} title={`Read ${article.title}`} aria-label={`Read ${article.title}`}><BookOpen size={15} /></Link><button onClick={() => remove(article.id)} title="Remove bookmark" aria-label={`Remove ${article.title} from bookmarks`}><Trash2 size={15} /></button></div>
    </article>)}</div> : <div className="library-empty"><Bookmark size={27} /><strong>{articles.length ? 'No bookmarks match this search' : 'No bookmarks yet'}</strong><span>{articles.length ? 'Try another search term.' : 'Open any article and use Bookmark to save it here.'}</span></div>}
  </div>;
}
