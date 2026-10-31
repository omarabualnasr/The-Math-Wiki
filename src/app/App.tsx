import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Activity, ArrowDownRight, ArrowRight, BookOpen, Bookmark, ChevronDown,
  Compass, FilePlus2, FileText, Files, FlaskConical, GraduationCap, Home, Menu, Moon,
  Network, Search, Settings, Sigma, Sun, X, HardDrive,
} from 'lucide-react';
import { findTopic, mathBranches } from '../data/branches';
import type { MathBranch, MathSubtopic } from '../data/branches';
import { getAllArticles } from '../engine/articleStorage';
import ArticlePage from '../features/articles/ArticlePage';
import type { MathArticle } from '../types/article';
import ArticleEditor from '../features/articles/ArticleEditor';
import BookmarksPage from '../features/library/BookmarksPage';
import LearningCenterPage from '../features/learning/LearningCenterPage';
import SplitViewPage from '../features/library/SplitViewPage';
import MathPlaygroundPage from '../features/playground/MathPlaygroundPage';
import MathSymbolsPage from '../features/symbols/MathSymbolsPage';
import PersonalWorkspacePage from '../features/workspace/PersonalWorkspacePage';
import { mathSymbols } from '../data/symbols';
import ReadingFocusGuide from '../features/reader/ReadingFocusGuide';
import { safeStorageGet, safeStorageGetJson, safeStorageSet, safeStorageSetJson } from '../engine/safeStorage';
import { buildSearchIndex, isRecentSearchList, parseSearchQuery, saveRecentSearch, searchDocuments } from '../engine/searchEngine';
import type { SearchResult } from '../engine/searchEngine';

type Theme = 'light' | 'dark';
type FontFamily = 'DM Sans' | 'Arial' | 'Georgia' | 'Verdana';

const navPrimary = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/branches', label: 'Branches of Mathematics', icon: Network },
  { to: '/playground', label: 'Math Playground', icon: Activity },
  { to: '/symbols', label: 'Math Symbols Library', icon: Sigma },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
];

const soonNavigation = [
  { label: 'Personal Workspace', icon: HardDrive },
  { label: 'Learning Center', icon: GraduationCap },
  { label: 'Account', icon: FlaskConical },
  { label: 'Math Wiki Mission', icon: Compass },
];

const searchActions = [
  { id: 'action-create-page', title: 'Create a page', detail: 'Open the article editor', to: '/editor/new' },
  { id: 'action-branches', title: 'Browse all branches', detail: 'Explore the mathematics catalogue', to: '/branches' },
  { id: 'action-playground', title: 'Math Playground', detail: 'Open mathematical tools and graphing', to: '/playground' },
  { id: 'action-symbols', title: 'Math Symbols Library', detail: 'Browse mathematical notation', to: '/symbols' },
  { id: 'action-bookmarks', title: 'Bookmarks', detail: 'Open saved articles', to: '/bookmarks' },
  { id: 'action-settings', title: 'Settings', detail: 'Change appearance and reading preferences', to: '/settings' },
  { id: 'action-split', title: 'Split View', detail: 'Read two articles side by side', to: '/split/sum' },
];

function App() {
  const [theme, setTheme] = useState<Theme>(() => safeStorageGet('math-wiki:settings:theme:v1') === 'dark' ? 'dark' : 'light');
  const [fontFamily, setFontFamily] = useState<FontFamily>(() => { const value = safeStorageGet('math-wiki:settings:font-family:v1'); return value === 'Arial' || value === 'Georgia' || value === 'Verdana' ? value : 'DM Sans'; });
  const [fontSize, setFontSize] = useState(() => { const value = Number(safeStorageGet('math-wiki:settings:font-size:v1', '14')); return Number.isFinite(value) ? Math.min(22, Math.max(12, value)) : 14; });
  const [highContrast, setHighContrast] = useState(() => safeStorageGet('math-wiki:settings:high-contrast:v1') === 'true');
  const [focusGuideEnabled, setFocusGuideEnabled] = useState(() => safeStorageGet('math-wiki:settings:focus-guide:v1') === 'true');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => safeStorageGetJson('math-wiki:search:recent:v1', [] as string[], isRecentSearchList));
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const sidebarSearchRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    safeStorageSet('math-wiki:settings:theme:v1', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--article-font-family', fontFamily === 'DM Sans' ? '"DM Sans", sans-serif' : fontFamily);
    document.documentElement.style.setProperty('--article-font-size', `${fontSize}px`);
    document.documentElement.dataset.highContrast = String(highContrast);
    safeStorageSet('math-wiki:settings:font-family:v1', fontFamily);
    safeStorageSet('math-wiki:settings:font-size:v1', String(fontSize));
    safeStorageSet('math-wiki:settings:high-contrast:v1', String(highContrast));
    safeStorageSet('math-wiki:settings:focus-guide:v1', String(focusGuideEnabled));
  }, [fontFamily, fontSize, highContrast, focusGuideEnabled]);

  useEffect(() => {
    setMobileNavOpen(false);
    setCommandOpen(false);
    setSidebarSearchOpen(false);
    setQuery('');
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (commandOpen) window.setTimeout(() => searchRef.current?.focus(), 20);
  }, [commandOpen]);

  const searchIndex = useMemo(
    () => buildSearchIndex(getAllArticles(), mathBranches, mathSymbols, searchActions),
    // Rebuild when the command palette opens or navigation returns from an editor.
    [commandOpen, location.pathname],
  );
  const searchResponse = useMemo(() => searchDocuments(searchIndex, query, 24), [searchIndex, query]);
  const searchResults = searchResponse.results;
  const parsedSearch = searchResponse.parsed;

  useEffect(() => setActiveResultIndex(0), [query]);

  useEffect(() => {
    if (!commandOpen || !query.trim()) return;
    searchResultsRef.current?.querySelector<HTMLElement>('.search-result-item.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [activeResultIndex, commandOpen, query, searchResults.length]);

  const rememberSearch = (value: string) => {
    const next = saveRecentSearch(recentSearches, value);
    setRecentSearches(next);
    safeStorageSetJson('math-wiki:search:recent:v1', next);
  };


  const goToResult = (to: string, searchedFor = query) => {
    if (searchedFor.trim()) rememberSearch(searchedFor);
    navigate(to);
    setQuery('');
    setActiveResultIndex(0);
    setCommandOpen(false);
    setSidebarSearchOpen(false);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    safeStorageSetJson('math-wiki:search:recent:v1', []);
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button className="icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
        <span className="mobile-current-title">{location.pathname === '/' ? 'Home' : getCurrentSection(location.pathname)}</span>
        
      </header>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <button className="icon-button close-mobile" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-search-wrap" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) window.setTimeout(() => setSidebarSearchOpen(false), 120); }}>
            <div className="sidebar-search">
              <Search size={16} />
              <input
                ref={sidebarSearchRef}
                value={query}
                placeholder="Search mathematics..."
                aria-label="Search mathematics"
                aria-controls="sidebar-search-results"
                onFocus={() => setSidebarSearchOpen(true)}
                onChange={(event) => { setQuery(event.target.value); setSidebarSearchOpen(true); }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && searchResults.length) { event.preventDefault(); setActiveResultIndex((current) => (current + 1) % searchResults.length); }
                  if (event.key === 'ArrowUp' && searchResults.length) { event.preventDefault(); setActiveResultIndex((current) => (current - 1 + searchResults.length) % searchResults.length); }
                  if (event.key === 'Enter' && searchResults[activeResultIndex]) { event.preventDefault(); goToResult(searchResults[activeResultIndex].to); setSidebarSearchOpen(false); }
                  if (event.key === 'Escape') { setSidebarSearchOpen(false); setQuery(''); }
                }}
              />
              {query && <button type="button" className="sidebar-search-clear" aria-label="Clear search" onClick={() => { setQuery(''); setSidebarSearchOpen(true); }}><X size={13}/></button>}
            </div>
            {sidebarSearchOpen && <div className="sidebar-search-results" id="sidebar-search-results">
              {query.trim() ? searchResults.length ? searchResults.slice(0, 8).map((result, index) => <button key={result.id} className={`sidebar-search-result ${index === activeResultIndex ? 'active' : ''}`} onClick={() => { goToResult(result.to); setSidebarSearchOpen(false); }}><span>{result.title}</span><small>{result.detail}</small></button>) : <div className="sidebar-search-empty">No matching results</div> : recentSearches.length ? <>{recentSearches.slice(0, 5).map((recent) => <button key={recent} className="sidebar-search-result" onClick={() => setQuery(recent)}><span>{recent}</span><small>Recent search</small></button>)}</> : <div className="sidebar-search-empty">Search articles, formulas and symbols</div>}
            </div>}
          </div>

          <Link to="/editor/new" className="sidebar-create-button"><FilePlus2 size={16}/><span>Create Page</span></Link>
          <nav className="nav-group sidebar-primary-nav" aria-label="Main navigation">
            {navPrimary.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
          </nav>
          <div className="sidebar-section-rule" />
          <nav className="nav-group sidebar-soon-nav" aria-label="Upcoming sections">
            {soonNavigation.map(({ label, icon: Icon }) => <div key={label} className="nav-link nav-disabled" aria-disabled="true" tabIndex={-1}><Icon size={17} strokeWidth={1.8}/><span>{label}</span><span className="soon-pill">Soon</span></div>)}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <NavLink to="/settings" className={({ isActive }) => `nav-link sidebar-settings-link ${isActive ? 'active' : ''}`}><Settings size={17} strokeWidth={1.8}/><span>Settings</span></NavLink>
          <button className="theme-switch" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><span className="theme-switch-left">{theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'light' ? 'Light appearance' : 'Dark appearance'}</span></span><span className={`switch-track ${theme === 'dark' ? 'on' : ''}`}><span /></span></button>
        </div>
      </aside>

      <div className="main-shell">
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage onSearch={() => { if (window.matchMedia('(max-width: 760px)').matches) setMobileNavOpen(true); window.setTimeout(() => sidebarSearchRef.current?.focus(), 30); }} />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/branches/:branchId" element={<BranchPage />} />
            <Route path="/branches/:branchId/:topicId" element={<TopicPage />} />
            <Route path="/articles/:slug" element={<ArticlePage />} />
            <Route path="/split/:leftSlug" element={<SplitViewPage />} />
            <Route path="/editor/new" element={<ArticleEditor isNew />} />
            <Route path="/editor/:articleId" element={<ArticleEditor />} />
            <Route path="/playground" element={<MathPlaygroundPage />} />
            <Route path="/symbols" element={<MathSymbolsPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/workspace" element={<PersonalWorkspacePage />} />
            <Route path="/learning" element={<LearningCenterPage />} />
            <Route path="/settings" element={<SettingsPage fontFamily={fontFamily} setFontFamily={setFontFamily} fontSize={fontSize} setFontSize={setFontSize} highContrast={highContrast} setHighContrast={setHighContrast} focusGuideEnabled={focusGuideEnabled} setFocusGuideEnabled={setFocusGuideEnabled} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>

      {commandOpen && (
        <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
          <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search and commands">
            <div className="command-input-wrap">
              <Search size={19} />
              <input
                ref={searchRef}
                value={query}
                aria-label="Search mathematics, formulas and commands"
                aria-controls="command-search-results"
                aria-activedescendant={searchResults[activeResultIndex] ? `search-option-${searchResults[activeResultIndex].id}` : undefined}
                placeholder="Search articles, blocks, formulas, symbols…"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && searchResults.length) { event.preventDefault(); setActiveResultIndex((current) => (current + 1) % searchResults.length); }
                  if (event.key === 'ArrowUp' && searchResults.length) { event.preventDefault(); setActiveResultIndex((current) => (current - 1 + searchResults.length) % searchResults.length); }
                  if (event.key === 'Enter' && searchResults[activeResultIndex]) { event.preventDefault(); goToResult(searchResults[activeResultIndex].to); }
                }}
              />
              <kbd>ESC</kbd>
              <button className="icon-button command-close" onClick={() => setCommandOpen(false)} aria-label="Close search"><X size={17} /></button>
            </div>
            <div className="search-operator-row">
              <span>FILTER</span>
              {['branch:algebra', 'level:university', 'difficulty:easy', 'type:formula'].map((operator) => (
                <button key={operator} onClick={() => setQuery((current) => `${current.trim()}${current.trim() ? ' ' : ''}${operator}`)}>{operator}</button>
              ))}
            </div>
            <div className="search-active-filters">
              {Object.entries(parsedSearch.filters).filter(([, value]) => Boolean(value)).map(([key, value]) => <span key={key}>{key}: {value}</span>)}
            </div>
            <div ref={searchResultsRef} className="command-results" id="command-search-results" role={query.trim() ? 'listbox' : undefined} aria-label={query.trim() ? 'Search results' : undefined} aria-live="polite">
              {!query.trim() ? (
                <>
                  <div className="result-heading">Quick navigation</div>
                  {searchActions.slice(0, 8).map((action) => <button className="command-result" key={action.id} onClick={() => goToResult(action.to)}><ActionIcon id={action.id} /><span><strong>{action.title}</strong><small>{action.detail}</small></span><ArrowRight size={15} /></button>)}
                  {recentSearches.length > 0 && <div className="recent-search-section"><div className="result-heading"><span>Recent searches</span><button onClick={clearRecentSearches}>Clear</button></div>{recentSearches.map((recent) => <button className="recent-search-item" key={recent} onClick={() => setQuery(recent)}><span className="recent-search-icon">↺</span><span>{recent}</span><ArrowRight size={13} /></button>)}</div>}
                </>
              ) : searchResults.length ? (
                <>
                  <div className="result-heading"><span>Search results</span><span>{searchResponse.total > searchResults.length ? `${searchResults.length} of ${searchResponse.total}` : searchResponse.total}</span></div>
                  {searchResults.map((result, index) => <SearchResultButton key={result.id} result={result} query={query} active={index === activeResultIndex} onMouseEnter={() => setActiveResultIndex(index)} onClick={() => goToResult(result.to)} />)}
                </>
              ) : (
                <div className="search-empty">
                  <Search size={22} />
                  <strong>No matching results</strong>
                  <span>Try another term or adjust the filters.</span>
                  {searchResponse.suggestions.length > 0 && <div className="search-suggestions"><span>Suggestions</span>{searchResponse.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setQuery(suggestion)}>{suggestion}</button>)}</div>}
                </div>
              )}
            </div>
            <div className="search-syntax-help"><span>Operators:</span><code>branch:</code><code>level:</code><code>difficulty:</code><code>type:</code><span>Use quotes for exact phrases.</span></div>
            <div className="command-hint"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open result</span><span><kbd>ESC</kbd> Close</span><span>Articles · Blocks · Formulas · Symbols · Branches</span></div>
          </section>
        </div>
      )}
      <ReadingFocusGuide enabled={focusGuideEnabled} />
    </div>
  );
}

function ActionIcon({ id }: { id: string }) {
  if (id.includes('workspace')) return <HardDrive size={17} />;
  if (id.includes('branch')) return <Network size={17} />;
  if (id.includes('symbol')) return <Sigma size={17} />;
  if (id.includes('learning')) return <GraduationCap size={17} />;
  if (id.includes('bookmark')) return <Bookmark size={17} />;
  if (id.includes('playground')) return <Activity size={17} />;
  if (id.includes('create')) return <FilePlus2 size={17} />;
  if (id.includes('split')) return <Files size={17} />;
  if (id.includes('settings')) return <Settings size={17} />;
  return <FileText size={17} />;
}

function SearchResultButton({ result, query, active, onMouseEnter, onClick }: {
  result: SearchResult;
  query: string;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const Icon = result.kind === 'symbol' ? Sigma : result.kind === 'branch' || result.kind === 'topic' ? Network : result.kind === 'action' ? Settings : BookOpen;
  return (
    <button id={`search-option-${result.id}`} className={`command-result search-result-item ${active ? 'is-active' : ''}`} role="option" aria-selected={active} onMouseEnter={onMouseEnter} onClick={onClick}>
      <Icon size={17} />
      <span>
        <strong><HighlightedSearchText value={result.title} query={query} /></strong>
        <small>{result.detail}</small>
        {result.snippet && <em className="search-result-snippet"><HighlightedSearchText value={result.snippet} query={query} /></em>}
      </span>
      <ArrowRight size={15} />
    </button>
  );
}

function HighlightedSearchText({ value, query }: { value: string; query: string }) {
  const terms = [...new Set([...parseSearchQuery(query).terms, ...parseSearchQuery(query).phrases])]
    .filter((term) => term.length > 0)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return <>{value}</>;
  const escapeRegExp = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  const parts = value.split(matcher);
  return <>{parts.map((part, index) => terms.some((term) => part.toLocaleLowerCase() === term.toLocaleLowerCase()) ? <mark key={`${index}-${part}`}>{part}</mark> : <span key={`${index}-${part}`}>{part}</span>)}</>;
}

function getCurrentSection(path: string) {
  if (path.startsWith('/editor')) return 'Article Editor';
  if (path.startsWith('/articles')) return 'Mathematics Article';
  if (path.startsWith('/split')) return 'Split View';
  if (path.startsWith('/branches')) return 'Branches of Mathematics';
  if (path.startsWith('/playground')) return 'Math Playground';
  if (path.startsWith('/symbols')) return 'Math Symbols Library';
  if (path.startsWith('/workspace')) return 'Personal Workspace';
  if (path.startsWith('/bookmarks')) return 'Bookmarks';
  if (path.startsWith('/learning')) return 'Learning Center';
  if (path.startsWith('/settings')) return 'Settings';
  return 'Workspace';
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function HomePage({ onSearch }: { onSearch: () => void }) {
  return <div className="page-stack home-page">
    <section className="welcome-panel">
      <div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line" /> MATHEMATICS, CLEARLY ORGANIZED</div><h1>Understand the<br /><span>language of mathematics.</span></h1><p>Explore mathematical ideas, follow connections between topics, and build your understanding one concept at a time.</p><button className="button button-primary" onClick={onSearch}><Search size={16} /> Search the library <span className="button-shortcut">Ctrl K</span></button></div>
      <div className="welcome-graphic" aria-hidden="true"><div className="graphic-circle circle-one" /><div className="graphic-circle circle-two" /><div className="formula formula-one">∑ xᵢ</div><div className="formula formula-two">f(x)</div><div className="formula formula-three">π</div><div className="formula formula-four">∫</div><div className="graphic-cross cross-one">+</div><div className="graphic-cross cross-two">×</div></div>
    </section>

    <section className="section-block"><div className="section-heading"><div><div className="eyebrow">START EXPLORING</div><h2>Explore the library</h2><p>Choose a place to begin.</p></div><Link to="/branches" className="text-link">All branches <ArrowRight size={15} /></Link></div>
      <div className="feature-grid">
        <Link to="/branches" className="feature-card feature-card-large"><div className="feature-icon"><Network size={19} /></div><div className="feature-card-content"><div className="card-overline">KNOWLEDGE LIBRARY</div><h3>Branches of Mathematics</h3><p>Navigate the major fields of mathematics and their specialist topics.</p></div><ArrowDownRight size={18} className="card-arrow" /></Link>
        <Link to="/playground" className="feature-card"><div className="feature-icon"><Activity size={19} /></div><div className="card-overline">INTERACTIVE WORKSPACE</div><h3>Math Playground</h3><p>Explore calculations, shapes, tables and graphs.</p><span className="card-status">Open workspace <span>↗</span></span></Link>
        <Link to="/symbols" className="feature-card"><div className="feature-icon"><Sigma size={19} /></div><div className="card-overline">REFERENCE</div><h3>Math Symbols Library</h3><p>Find mathematical symbols, names and notation.</p><span className="card-status">Browse symbols <span>↗</span></span></Link>
      </div>
    </section>

    <section className="section-block branch-preview-section"><div className="section-heading"><div><div className="eyebrow">THE KNOWLEDGE MAP</div><h2>Mathematics, by discipline</h2><p>A broad map of the subject, ready to grow.</p></div><Link to="/branches" className="text-link">View catalogue <ArrowRight size={15} /></Link></div>
      <div className="branch-preview-grid">{mathBranches.slice(0, 8).map((branch, index) => <Link className="branch-preview-card" key={branch.id} to={`/branches/${branch.id}`}><span className="branch-index">{String(index + 1).padStart(2, '0')}</span><span className="branch-preview-title">{branch.title}</span><span className="branch-preview-count">{branch.topics.length + 1} topics</span><ArrowRight size={14} className="branch-preview-arrow" /></Link>)}</div>
    </section>

    <section className="sample-article-card"><div><div className="eyebrow">FIRST ARTICLE</div><h2>Explore SUM</h2></div><div className="sample-article-actions"><Link to="/articles/sum" className="button button-primary">Read the Article <ArrowRight size={14} /></Link></div></section>
  </div>;
}

function BranchesPage() {
  const [filter, setFilter] = useState('');
  const filtered = mathBranches.filter((branch) => `${branch.title} ${branch.description} ${branch.topics.map((item) => item.title).join(' ')}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="page-stack">
    <PageHeading eyebrow="KNOWLEDGE LIBRARY" title="Branches of Mathematics" description="A structured map of mathematical disciplines, from foundational ideas to specialized fields." />
    <div className="catalogue-toolbar"><div className="catalogue-search"><Search size={16} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter branches and topics..." /><kbd>/</kbd></div></div>
    <div className="branch-catalogue">{filtered.map((branch, index) => <BranchCard branch={branch} index={index} key={branch.id} />)}</div>
    {filtered.length === 0 && <div className="empty-state"><Search size={24} /><strong>No branches found</strong><span>Try a broader search term.</span></div>}
  </div>;
}

function BranchCard({ branch, index }: { branch: MathBranch; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return <section className={`branch-card ${expanded ? 'expanded' : ''}`}>
    <div className="branch-card-main"><Link to={`/branches/${branch.id}`} className="branch-card-index">{String(index + 1).padStart(2, '0')}</Link><div className="branch-card-text"><Link to={`/branches/${branch.id}`} className="branch-card-title">{branch.title}</Link><p>{branch.description}</p><div className="branch-card-meta"><span>{branch.topics.length + 1} topics</span><span className="meta-separator">·</span><span>Under development</span></div></div><div className="branch-card-actions"><Link to={`/branches/${branch.id}`} className="small-arrow-link" aria-label={`Open ${branch.title}`}><ArrowRight size={16} /></Link><button className="expand-button" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Collapse topics' : 'Expand topics'} aria-expanded={expanded}><ChevronDown size={16} /></button></div></div>
    {expanded && <div className="branch-topics-preview">{branch.topics.map((item) => <Link key={item.id} to={`/branches/${branch.id}/${item.id}`} className="topic-chip">{item.title}<ArrowRight size={12} /></Link>)}</div>}
  </section>;
}

function BranchPage() {
  const { branchId } = useParams();
  const branch = mathBranches.find((item) => item.id === branchId);
  if (!branch) return <NotFound />;
  const articles = getAllArticles().filter((article) => article.branch === branch.id && article.status === 'published');
  return <UnderDevelopmentPage title={branch.title} description={branch.description} breadcrumb="Branches of Mathematics" parentTo="/branches" topics={branch.topics} branchId={branch.id} articles={articles} />;
}

function TopicPage() {
  const { branchId, topicId } = useParams();
  const result = findTopic(branchId || '', topicId || '');
  if (!result) return <NotFound />;
  return <UnderDevelopmentPage title={result.topic.title} description={`This topic belongs to ${result.branch.title}. Its learning content will be added here.`} breadcrumb={result.branch.title} parentTo={`/branches/${result.branch.id}`} />;
}

function UnderDevelopmentPage({ title, description, breadcrumb, parentTo, topics, branchId, articles }: { title: string; description: string; breadcrumb: string; parentTo: string; topics?: MathSubtopic[]; branchId?: string; articles?: MathArticle[] }) {
  return <div className="page-stack">
    <div className="breadcrumbs-inline"><Link to="/branches">Branches</Link><span>/</span><Link to={parentTo}>{breadcrumb}</Link></div>
    <div className="topic-hero"><div className="topic-hero-top"><span className="eyebrow">MATHEMATICS REFERENCE</span><span className="status-label"><span /> Under development</span></div><h1>{title}</h1><p>{description}</p><div className="topic-meta"><span><BookOpen size={14} /> Article</span></div></div>
    <div className="development-panel"><div className="development-symbol"><BookOpen size={22} /></div><div className="development-copy"><div className="eyebrow">CONTENT IN PREPARATION</div><h2>Under Development</h2><p>{articles && articles.length > 0 ? 'This branch is still being populated. Available articles appear below; explanations and resources for the remaining topics will be added progressively.' : 'This section has been added to the knowledge structure. Its explanations, examples and learning resources will be introduced in a future update.'}</p></div></div>
    {articles && articles.length > 0 && <section className="related-topics"><div className="section-heading compact-heading"><div><div className="eyebrow">AVAILABLE ARTICLES</div><h2>Published in this branch</h2></div><span className="count-chip">{articles.length} articles</span></div><div className="topic-list">{articles.map((article, index) => <Link key={article.id} to={`/articles/${article.slug}`} className="topic-list-row"><span className="topic-list-number">{String(index + 1).padStart(2, '0')}</span><span>{article.title}</span><span className="article-row-meta">{article.difficulty}</span><ArrowRight size={15} /></Link>)}</div></section>}
    {topics && topics.length > 0 && <section className="related-topics"><div className="section-heading compact-heading"><div><div className="eyebrow">EXPLORE THIS DISCIPLINE</div><h2>Topics in this branch</h2></div><span className="count-chip">{topics.length} topics</span></div><div className="topic-list">{topics.map((item, index) => <Link key={item.id} to={`/branches/${branchId}/${item.id}`} className="topic-list-row"><span className="topic-list-number">{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span><ArrowRight size={15} /></Link>)}</div></section>}
    <Link to={parentTo} className="back-link"><ArrowRight size={14} className="back-arrow" /> Back to {breadcrumb}</Link>
  </div>;
}

function SettingsPage({ fontFamily, setFontFamily, fontSize, setFontSize, highContrast, setHighContrast, focusGuideEnabled, setFocusGuideEnabled }: {
  fontFamily: FontFamily; setFontFamily: (font: FontFamily) => void;
  fontSize: number; setFontSize: (size: number) => void;
  highContrast: boolean; setHighContrast: (enabled: boolean) => void;
  focusGuideEnabled: boolean; setFocusGuideEnabled: (enabled: boolean) => void;
}) {
  return <div className="page-stack">
    <PageHeading eyebrow="PREFERENCES" title="Settings" description="Adjust the appearance and reading environment." />
    <section className="settings-section">
      <div className="settings-section-title"><h2>Reading and accessibility</h2><p>Personalize how mathematical content is displayed and followed.</p></div>
      <div className="setting-row"><div><strong>Font family</strong><span>Choose the reading typeface for article content.</span></div><select className="setting-select" value={fontFamily} onChange={(event) => setFontFamily(event.target.value as FontFamily)}><option value="DM Sans">DM Sans</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option></select></div>
      <div className="setting-row"><div><strong>Font size</strong><span>Current article size: {fontSize}px.</span></div><div className="setting-range"><input type="range" min="12" max="22" step="1" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} aria-label="Article font size"/><output>{fontSize}px</output></div></div>
      <div className="setting-row"><div><strong>High contrast mode</strong><span>Strengthen text, borders and keyboard focus visibility.</span></div><button className={`setting-toggle ${highContrast ? 'on' : ''}`} role="switch" aria-checked={highContrast} onClick={() => setHighContrast(!highContrast)}><span/></button></div>
      <div className="setting-row"><div><strong>Reading Focus Guide</strong><span>Show a horizontal guide following the pointer in reading areas.</span></div><button className={`setting-toggle ${focusGuideEnabled ? 'on' : ''}`} role="switch" aria-checked={focusGuideEnabled} onClick={() => setFocusGuideEnabled(!focusGuideEnabled)}><span/></button></div>
      <div className="setting-row setting-row-disabled" aria-disabled="true"><div><strong>Enable Sound Effects</strong></div><span className="soon-pill">Soon</span></div>
    </section>
    <section className="settings-section">
      <div className="settings-section-title"><h2>Workspace layout</h2></div>
      <div className="setting-row setting-row-disabled" aria-disabled="true"><div><strong>Content width</strong></div><span className="soon-pill">Soon</span></div>
    </section>
  </div>;
}

function NotFound() {
  return <div className="not-found"><div className="eyebrow">404 · NOT FOUND</div><h1>This page does not exist.</h1><p>The address may be incorrect or the page may have moved.</p><Link className="button button-primary" to="/">Return home <ArrowRight size={15} /></Link></div>;
}

export default App;
