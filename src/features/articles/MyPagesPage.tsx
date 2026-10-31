import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, FilePlus2, FileText, Search, Trash2 } from 'lucide-react';
import { deleteLocalArticle, exportArticleJson, getLocalArticles } from '../../engine/articleStorage';
import type { MathArticle } from '../../types/article';

export default function MyPagesPage() {
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('');
  const articles = useMemo(() => getLocalArticles(), [refresh]);
  const filtered = articles.filter((article) => `${article.title} ${article.aliases.join(' ')} ${article.summary}`.toLowerCase().includes(filter.toLowerCase()));

  const remove = (article: MathArticle) => {
    const accepted = window.confirm(`Delete the local draft “${article.title}”? This cannot be undone.`);
    if (!accepted) return;
    deleteLocalArticle(article.id);
    setRefresh((value) => value + 1);
  };

  return <div className="page-stack my-pages-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>My Pages</h1><p>Create and manage article drafts saved in this browser.</p></div><Link to="/editor/new" className="button button-primary"><FilePlus2 size={15} /> Create page</Link></div>
    <div className="my-pages-note"><FileText size={16} /><p>Drafts are stored on this device. Export an article as JSON, then place it in <code>src/data/pages/</code> in your repository to publish it with GitHub Pages.</p></div>
    <div className="catalogue-toolbar"><label className="catalogue-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find one of your pages..." /></label><span className="catalogue-count">{filtered.length} {filtered.length === 1 ? 'page' : 'pages'}</span></div>
    {filtered.length ? <div className="my-pages-list">{filtered.map((article) => <article className="my-page-row" key={article.id}><div className="my-page-icon"><FileText size={17} /></div><div className="my-page-copy"><strong>{article.title || 'Untitled article'}</strong><span>{article.level} · {article.difficulty} · {article.blocks.length} blocks</span><small>Edited {new Date(article.updatedAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</small></div><div className="my-page-actions"><Link to={`/articles/${article.slug}`} title="Preview article" aria-label={`Preview ${article.title}`}><ArrowRight size={15} /></Link><Link to={`/editor/${article.id}`} title="Edit article" aria-label={`Edit ${article.title}`}><FileText size={15} /></Link><button title="Export JSON" aria-label={`Export ${article.title}`} onClick={() => exportArticleJson(article)}><Download size={15} /></button><button title="Delete draft" aria-label={`Delete ${article.title}`} onClick={() => remove(article)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="my-pages-empty"><FileText size={27} /><strong>{articles.length ? 'No pages match this search' : 'No drafts yet'}</strong><span>{articles.length ? 'Try another title or search term.' : 'Create your first article. It will be saved automatically as you work.'}</span>{!articles.length && <Link to="/editor/new" className="button button-secondary">Create your first page <ArrowRight size={14} /></Link>}</div>}
  </div>;
}
