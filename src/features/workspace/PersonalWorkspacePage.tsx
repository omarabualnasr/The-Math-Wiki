import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, ArrowDownToLine, ArrowUpFromLine, BookOpen, Check, CloudDownload, FolderPlus,
  ListPlus, MonitorDown, RefreshCw, Smartphone, Trash2, Wifi, WifiOff,
} from 'lucide-react';
import { getAllArticles } from '../../engine/articleStorage';
import {
  createWorkspaceList, setArticleOffline, deleteWorkspaceList, deleteWorkspaceSession, loadPersonalWorkspace,
  updateWorkspaceList, type PersonalWorkspaceState, type WorkspaceListKind, type WorkspaceSession,
} from '../../engine/personalWorkspaceStorage';
import {
  BACKUP_CATEGORIES, createWorkspaceBackupBlob, downloadBackupBlob, inspectWorkspaceBackup,
  restoreWorkspaceBackup, type BackupCategory, type WorkspaceBackupPreview,
} from '../../engine/workspaceBackup';
import { canPromptInstall, isStandaloneApp, promptAppInstall, subscribeInstallAvailability, cacheApplicationForOffline } from '../../engine/pwa';

const categoryLabels: Record<BackupCategory, string> = {
  articles: 'Article drafts', bookmarks: 'Bookmarks', annotations: 'Highlights and notes', drawings: 'Article drawings',
  learning: 'Learning progress and flashcards', calculator: 'Calculator history and preferences', geometry: 'Geometry constructions',
  workspace: 'Collections, reading lists and saved sessions', settings: 'Reading and appearance settings', search: 'Recent searches',
  'article-history': 'Article revision history', other: 'Other application data',
};

function formatDate(value: string): string {
  try { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return value; }
}

function sessionSummary(session: WorkspaceSession): string {
  if (session.kind === 'graph') return `Graph · ${String(session.payload.mode || 'Cartesian')} · ${String(session.payload.expression || 'Saved configuration')}`;
  if (session.kind === 'geometry') {
    const objects = Array.isArray(session.payload.objects) ? session.payload.objects.length : 0;
    return `Geometry · ${objects} construction object${objects === 1 ? '' : 's'}`;
  }
  const expression = typeof session.payload.expression === 'string' ? session.payload.expression : 'Calculator session';
  const answer = typeof session.payload.answer === 'string' ? ` = ${session.payload.answer}` : '';
  return `Calculator · ${expression}${answer}`;
}

export default function PersonalWorkspacePage() {
  const navigate = useNavigate();
  const articles = useMemo(() => getAllArticles(), []);
  const [workspace, setWorkspace] = useState<PersonalWorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [kind, setKind] = useState<WorkspaceListKind>('collection');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedList, setSelectedList] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(articles[0]?.id || '');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [standalone, setStandalone] = useState(isStandaloneApp());
  const [installAvailable, setInstallAvailable] = useState(canPromptInstall());
  const [offlineStatus, setOfflineStatus] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupPreview, setBackupPreview] = useState<WorkspaceBackupPreview | null>(null);
  const [restoreCategories, setRestoreCategories] = useState<BackupCategory[]>([...BACKUP_CATEGORIES]);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    try { setWorkspace(await loadPersonalWorkspace()); setWorkspaceError(''); }
    catch (error) {
      setWorkspace(null);
      setWorkspaceError(error instanceof Error ? error.message : 'Saved workspace data could not be validated. Existing data has been left untouched.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const unsubscribe = subscribeInstallAvailability(() => { setInstallAvailable(canPromptInstall()); setStandalone(isStandaloneApp()); });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const onInstalled = () => setStandalone(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => { unsubscribe(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const createList = async () => {
    try {
      const created = await createWorkspaceList(kind, newName, newDescription);
      setNewName(''); setNewDescription(''); setSelectedList(created.id); setNotice(`${kind === 'collection' ? 'Collection' : 'Reading list'} created.`); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create this list.'); }
  };

  const addArticle = async () => {
    if (!selectedList || !selectedArticle || !workspace) return;
    const list = workspace.lists.find((item) => item.id === selectedList);
    if (!list) return;
    if (list.articleIds.includes(selectedArticle)) { setNotice('This article is already in the selected list.'); return; }
    try { await updateWorkspaceList(list.id, { articleIds: [...list.articleIds, selectedArticle] }); setNotice('Article added to your workspace.'); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not add this article.'); }
  };

  const removeArticle = async (listId: string, articleId: string) => {
    const list = workspace?.lists.find((item) => item.id === listId);
    if (!list) return;
    try { await updateWorkspaceList(listId, { articleIds: list.articleIds.filter((id) => id !== articleId) }); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not remove this article.'); }
  };

  const removeOfflinePin = async (articleId: string) => {
    try { await setArticleOffline(articleId, false); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The offline article reference could not be removed.'); }
  };

  const prepareOffline = async () => {
    setOfflineStatus('Preparing the application shell and current assets for offline use…');
    const result = await cacheApplicationForOffline(window.location.href);
    setOfflineStatus(result.ok ? 'Offline app shell and current build assets have been cached.' : result.error || 'Offline preparation failed.');
  };

  const installApp = async () => {
    const result = await promptAppInstall();
    setInstallAvailable(canPromptInstall());
    if (result.outcome === 'accepted') setNotice('Installation accepted. Check your device for the installed app.');
    else if (result.outcome === 'dismissed') setNotice('Installation was dismissed. You can install later from your browser menu.');
    else setNotice('Use your browser menu and choose Install app or Add to Home Screen when available.');
  };

  const createBackup = async () => {
    setBackupBusy(true); setBackupError('');
    try { downloadBackupBlob(await createWorkspaceBackupBlob()); setNotice('Personal workspace backup created.'); }
    catch (error) { setBackupError(error instanceof Error ? error.message : 'Backup creation failed.'); }
    finally { setBackupBusy(false); }
  };

  const inspectBackup = async (file?: File) => {
    setBackupError(''); setBackupPreview(null);
    if (!file) return;
    try {
      const preview = await inspectWorkspaceBackup(file);
      setBackupPreview(preview);
      setRestoreCategories([...BACKUP_CATEGORIES]);
    } catch (error) { setBackupError(error instanceof Error ? error.message : 'This backup could not be read.'); }
  };

  const restoreBackup = async () => {
    if (!backupPreview) return;
    if (!window.confirm('Restore the selected categories? Existing data in those categories will be replaced. Create a backup first if you may need the current data.')) return;
    setRestoreBusy(true); setBackupError('');
    try {
      await restoreWorkspaceBackup(backupPreview, restoreCategories);
      setBackupPreview(null);
      setNotice('Selected backup categories restored. Reload the page to refresh all open views.');
      await refresh();
    } catch (error) { setBackupError(error instanceof Error ? error.message : 'Backup restoration failed.'); }
    finally { setRestoreBusy(false); }
  };

  const toggleRestoreCategory = (category: BackupCategory) => setRestoreCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  const titleForArticle = (id: string) => articles.find((article) => article.id === id)?.title || `Unavailable article (${id})`;

  return <div className="page-stack personal-workspace-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h1>Personal Workspace</h1><p>Organize mathematics articles, keep useful tool sessions, and protect your work with portable backups.</p></div><div className="workspace-heading-status"><span className={online ? 'workspace-status-dot online' : 'workspace-status-dot'} />{online ? 'Online' : 'Offline'}</div></div>

    {workspaceError ? <section className="workspace-load-error" role="alert"><strong>Your saved workspace needs attention</strong><p>{workspaceError}</p><p>The application has not replaced the saved record with an empty workspace.</p><button className="button button-secondary" onClick={() => void refresh()}>Try again</button></section> : <>
    <section className="workspace-section">
      <div className="section-heading compact-heading"><div><div className="eyebrow">ORGANIZE KNOWLEDGE</div><h2>Collections & reading lists</h2><p>Group article references into your own study collections. Articles remain published or drafted in their original locations.</p></div></div>
      <div className="workspace-create-row">
        <label>List type<select value={kind} onChange={(event) => setKind(event.target.value as WorkspaceListKind)}><option value="collection">Collection</option><option value="reading-list">Reading list</option></select></label>
        <label className="workspace-name-field">Name<input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={100} placeholder={kind === 'collection' ? 'e.g. Algebra references' : 'e.g. Weekend reading'}/></label>
        <label className="workspace-description-field">Description<input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} maxLength={1000} placeholder="Optional description"/></label>
        <button className="button button-primary" onClick={() => void createList()} disabled={!newName.trim()}><FolderPlus size={14}/> Create</button>
      </div>
      <div className="workspace-add-row">
        <label>Choose a list<select value={selectedList} onChange={(event) => setSelectedList(event.target.value)}><option value="">Select a collection or reading list</option>{workspace?.lists.map((list) => <option key={list.id} value={list.id}>{list.kind === 'collection' ? 'Collection' : 'Reading list'} · {list.name}</option>)}</select></label>
        <label className="workspace-name-field">Choose an article<select value={selectedArticle} onChange={(event) => setSelectedArticle(event.target.value)}><option value="">Select an article</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}</select></label>
        <button className="button button-secondary" onClick={() => void addArticle()} disabled={!selectedList || !selectedArticle}><ListPlus size={14}/> Add article</button>
      </div>
      {loading ? <div className="workspace-empty">Loading your local workspace…</div> : workspace?.lists.length ? <div className="workspace-list-grid">{workspace.lists.map((list) => <section className="workspace-list-card" key={list.id}>
        <div className="workspace-list-card-top"><div><span className="workspace-kind-label">{list.kind === 'collection' ? 'COLLECTION' : 'READING LIST'}</span><h3>{list.name}</h3>{list.description && <p>{list.description}</p>}</div><button className="tool-icon-button" onClick={() => { if (window.confirm(`Delete “${list.name}”? Articles themselves will not be deleted.`)) void deleteWorkspaceList(list.id).then(refresh); }} aria-label={`Delete ${list.name}`}><Trash2 size={14}/></button></div>
        {list.articleIds.length ? <div className="workspace-list-articles">{list.articleIds.map((id) => { const article = articles.find((item) => item.id === id); return <div className="workspace-list-article" key={id}><BookOpen size={13}/>{article ? <button onClick={() => navigate(`/articles/${article.slug}`)}>{article.title}</button> : <span>{titleForArticle(id)}</span>}<button className="workspace-remove-article" onClick={() => void removeArticle(list.id, id)} aria-label="Remove article"><Trash2 size={12}/></button></div>; })}</div> : <div className="workspace-empty compact">No articles in this list yet.</div>}
        <div className="workspace-list-footer"><span>{list.articleIds.length} article{list.articleIds.length === 1 ? '' : 's'}</span><span>Updated {formatDate(list.updatedAt)}</span></div>
      </section>)}</div> : <div className="workspace-empty"><FolderPlus size={22}/><strong>No collections or reading lists yet</strong><span>Create one above, then add articles to organize your study.</span></div>}
    </section>

    <section className="workspace-section">
      <div className="section-heading compact-heading"><div><div className="eyebrow">SAVED TOOL SESSIONS</div><h2>Calculator, graph & geometry</h2><p>Save a reusable snapshot from a playground tool and reopen it later.</p></div></div>
      {workspace?.sessions.length ? <div className="workspace-session-list">{workspace.sessions.map((session) => <div className="workspace-session-row" key={session.id}><div className="workspace-session-icon">{session.kind === 'graph' ? 'ƒ' : session.kind === 'geometry' ? '△' : '∑'}</div><div className="workspace-session-main"><strong>{session.name}</strong><span>{sessionSummary(session)}</span><small>Saved {formatDate(session.createdAt)}</small></div><button className="button button-secondary" onClick={() => navigate(`/playground?restore=${encodeURIComponent(session.id)}`)}>Open</button><button className="tool-icon-button" onClick={() => { if (window.confirm(`Delete saved session “${session.name}”?`)) void deleteWorkspaceSession(session.id).then(refresh); }} aria-label={`Delete ${session.name}`}><Trash2 size={14}/></button></div>)}</div> : <div className="workspace-empty compact">No saved tool sessions. Use Save session inside the calculator, graphing or geometry tool.</div>}
    </section>

    <section className="workspace-section">
      <div className="section-heading compact-heading"><div><div className="eyebrow">OFFLINE LIBRARY</div><h2>Available without a connection</h2><p>Prepare the application shell and keep article references in your offline list.</p></div></div>
      <div className="offline-card"><div className="offline-card-icon">{online ? <Wifi size={19}/> : <WifiOff size={19}/>}</div><div className="offline-card-copy"><strong>{online ? 'Connection available' : 'You are currently offline'}</strong><span>{standalone ? 'Installed application' : 'Web application'} · {workspace?.offlineArticleIds.length || 0} pinned article references</span>{offlineStatus && <small role="status">{offlineStatus}</small>}</div><div className="offline-card-actions">{installAvailable && !standalone && <button className="button button-secondary" onClick={() => void installApp()}><MonitorDown size={14}/> Install app</button>}<button className="button button-primary" onClick={() => void prepareOffline()} disabled={!online}><CloudDownload size={14}/> Prepare offline</button></div></div>
      {workspace?.offlineArticleIds.length ? <div className="workspace-offline-list">{workspace.offlineArticleIds.map((id) => { const article = articles.find((item) => item.id === id); return <div key={id}><BookOpen size={13}/>{article ? <button onClick={() => navigate(`/articles/${article.slug}`)}>{article.title}</button> : <span>{id}</span>}<span className="offline-pin-label">Pinned</span><button className="tool-icon-button" onClick={() => void removeOfflinePin(id)} aria-label="Remove offline pin"><Trash2 size={12}/></button></div>; })}</div> : null}
      {!standalone && <p className="workspace-help-note"><Smartphone size={13}/> On iPhone/iPad, use Safari’s Share menu and choose Add to Home Screen. On desktop or Android, use the browser’s Install option when available.</p>}
    </section>

    <section className="workspace-section">
      <div className="section-heading compact-heading"><div><div className="eyebrow">DATA PORTABILITY</div><h2>Backup & restore</h2><p>Export your local work into one validated ZIP archive, or restore selected parts of a previous backup.</p></div></div>
      <div className="backup-actions-card"><div><Archive size={19}/><strong>Create a complete backup</strong><span>Includes article drafts, annotations, bookmarks, learning records, settings, tool history, collections and saved sessions.</span></div><button className="button button-primary" onClick={() => void createBackup()} disabled={backupBusy}><ArrowDownToLine size={14}/>{backupBusy ? 'Preparing…' : 'Download backup ZIP'}</button></div>
      <div className="backup-restore-card"><div className="backup-restore-heading"><div><strong>Restore from backup</strong><span>Choose a Mathematics Wiki ZIP backup. You can preview and select the categories to restore.</span></div><label className="button button-secondary backup-file-button"><ArrowUpFromLine size={14}/> Choose backup<input type="file" accept=".zip,application/zip" onChange={(event) => { void inspectBackup(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label></div>
        {backupPreview && <div className="backup-preview"><div className="backup-preview-summary"><Check size={15}/><span><strong>{backupPreview.fileName}</strong><small>Created {formatDate(backupPreview.createdAt)} · {backupPreview.totalEntries} browser data records</small></span></div><div className="backup-category-grid">{BACKUP_CATEGORIES.map((category) => <label key={category} className="backup-category-option"><input type="checkbox" checked={restoreCategories.includes(category)} onChange={() => toggleRestoreCategory(category)}/><span>{categoryLabels[category]}</span><strong>{backupPreview.counts[category]}</strong></label>)}</div><div className="backup-preview-actions"><button className="button button-secondary" onClick={() => setRestoreCategories([...BACKUP_CATEGORIES])}>Select all</button><button className="button button-secondary" onClick={() => setRestoreCategories([])}>Clear selection</button><button className="button button-primary" onClick={() => void restoreBackup()} disabled={restoreBusy || !restoreCategories.length}><RefreshCw size={14}/>{restoreBusy ? 'Restoring…' : `Restore ${restoreCategories.length} categories`}</button></div></div>}
      </div>
      {backupError && <p className="workspace-error" role="alert">{backupError}</p>}
      {notice && <p className="workspace-notice" role="status">{notice}</p>}
      <p className="workspace-help-note">Backups may contain personal notes, highlights, drafts and learning history. Keep downloaded backup files private. Restoring selected categories replaces current data in those categories; it does not merge conflicting records.</p>
    </section>
    </>}
  </div>;
}
