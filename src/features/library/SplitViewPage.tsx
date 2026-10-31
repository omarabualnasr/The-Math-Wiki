import { useMemo, useState } from 'react';
import { ArrowUpRight, Columns2, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAllArticles, getArticleBySlug } from '../../engine/articleStorage';
import type { MathArticle } from '../../types/article';
import BlockRenderer from '../articles/BlockRenderer';

function ArticlePane({ article, side }: { article: MathArticle; side: 'left' | 'right' }) {
  return <section className={`split-pane split-pane-${side}`} aria-label={`${side} article`}>
    <header className="split-pane-header">
      <div><span className="eyebrow">{side === 'left' ? 'FIRST ARTICLE' : 'SECOND ARTICLE'}</span><h2>{article.title}</h2><p>{article.level} · {article.difficulty}</p></div>
      <Link to={`/articles/${article.slug}`} title="Open full article" aria-label={`Open ${article.title} as a full article`}><ExternalLink size={15} /></Link>
    </header>
    <div className="split-pane-scroll">
      {article.summary && <p className="split-summary">{article.summary}</p>}
      {article.blocks.map((block) => <BlockRenderer key={block.id} block={block} />)}
    </div>
  </section>;
}

export default function SplitViewPage() {
  const { leftSlug = '' } = useParams();
  const navigate = useNavigate();
  const articles = useMemo(() => getAllArticles(), []);
  const leftArticle = getArticleBySlug(leftSlug) || articles[0];
  const availableRight = articles.filter((article) => article.id !== leftArticle?.id);
  const [rightId, setRightId] = useState(availableRight[0]?.id || '');
  const rightArticle = availableRight.find((article) => article.id === rightId) || availableRight[0];

  if (!leftArticle) return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">READING WORKSPACE</div><h1>Split View</h1><p>Open two mathematics articles side by side.</p></div></div><div className="library-empty"><Columns2 size={27}/><strong>No articles available yet</strong><span>Create or publish another article to compare two pages in this workspace.</span><Link className="button button-secondary" to="/editor/new">Create an article</Link></div></div>;

  return <div className="split-view-page">
    <div className="page-heading split-heading"><div><div className="eyebrow">READING WORKSPACE</div><h1>Split View</h1><p>Read two articles side by side. Each panel scrolls independently.</p></div><span className="split-heading-icon"><Columns2 size={20}/></span></div>
    <div className="split-controls">
      <label><span>First article</span><select value={leftArticle.id} onChange={(event) => navigate(`/split/${getAllArticles().find((item) => item.id === event.target.value)?.slug || leftSlug}`)}>
        {getAllArticles().map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
      </select></label>
      <label><span>Second article</span><select value={rightArticle?.id || ''} onChange={(event) => setRightId(event.target.value)}>
        <option value="">Choose an article</option>
        {availableRight.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
      </select></label>
    </div>
    <div className="split-panes">
      <ArticlePane article={leftArticle} side="left"/>
      {rightArticle ? <ArticlePane article={rightArticle} side="right"/> : <div className="split-empty"><Columns2 size={24}/><strong>Choose a second article</strong><span>Use the selector above to open another article.</span></div>}
    </div>
    <div className="split-footnote"><ArrowUpRight size={13}/> Open either article in its full reading view for the complete page navigation and article actions.</div>
  </div>;
}
