import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Braces, Calculator, Code2, ExternalLink, Layers, Shapes, Sigma, Table } from 'lucide-react';
import CalculatorTool from './CalculatorTool';
import GeometryTool from './GeometryTool';
import TablesTool from './TablesTool';
import GraphTool from './GraphTool';
import MathEngineTool from './MathEngineTool';
import { loadPersonalWorkspace, type WorkspaceSessionKind } from '../../engine/personalWorkspaceStorage';

type ToolTab = 'calculator' | 'geometry' | 'tables' | 'graphs' | 'engine';
const tabs: { id: ToolTab; label: string; icon: typeof Calculator; description: string }[] = [
  { id: 'calculator', label: 'Scientific calculator', icon: Calculator, description: 'Evaluate expressions and work with scientific functions.' },
  { id: 'geometry', label: 'Geometry & shapes', icon: Shapes, description: 'Construct points, lines, circles and polygons.' },
  { id: 'tables', label: 'Math tables', icon: Table, description: 'Generate arithmetic and multiplication tables.' },
  { id: 'graphs', label: 'Math graphs', icon: Activity, description: 'Plot and compare mathematical functions.' },
  { id: 'engine', label: 'Math engine', icon: Sigma, description: 'Work with algebra, calculus, matrices and statistics.' },
];

const sessionTab: Record<WorkspaceSessionKind, ToolTab> = { graph: 'graphs', geometry: 'geometry', calculator: 'calculator' };

export default function MathPlaygroundPage() {
  const [searchParams] = useSearchParams();
  const restoreSessionId = searchParams.get('restore') || undefined;
  const [active, setActive] = useState<ToolTab>('calculator');
  const [restoreNotice, setRestoreNotice] = useState('');
  const [restoreSessionKind, setRestoreSessionKind] = useState<WorkspaceSessionKind | undefined>();
  useEffect(() => {
    if (!restoreSessionId) return;
    let activeRequest = true;
    void loadPersonalWorkspace().then((workspace) => {
      if (!activeRequest) return;
      const session = workspace.sessions.find((item) => item.id === restoreSessionId);
      if (!session) { setRestoreNotice('The saved workspace session could not be found.'); return; }
      setRestoreSessionKind(session.kind);
      setActive(sessionTab[session.kind]);
      setRestoreNotice(`Opening saved ${session.kind} session: ${session.name}`);
    });
    return () => { activeRequest = false; };
  }, [restoreSessionId]);
  const current = tabs.find((tab) => tab.id === active)!;
  return <div className="page-stack playground-page">
    <div className="page-heading"><div><div className="eyebrow">INTERACTIVE WORKSPACE</div><h1>Math Playground</h1><p>Explore scientific calculations, symbolic mathematics, dynamic geometry, advanced graphing and mathematical tables.</p></div><div className="playground-heading-mark"><Activity size={20}/><span>Five workspaces</span></div></div>
    {restoreNotice && <div className="workspace-inline-notice" role="status">{restoreNotice}</div>}
    <div className="playground-tool-tabs" role="tablist" aria-label="Math Playground tools">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={active === id} className={active === id ? 'selected' : ''} onClick={() => setActive(id)}><Icon size={16}/><span>{label}</span></button>)}
    </div>
    <div className="playground-active-heading"><div><div className="eyebrow">CURRENT TOOL</div><h2>{current.label}</h2><p>{current.description}</p></div></div>
    <div role="tabpanel" aria-label={current.label}>
      {active === 'calculator' && <CalculatorTool restoreSessionId={restoreSessionKind === 'calculator' ? restoreSessionId : undefined}/>}
      {active === 'geometry' && <GeometryTool restoreSessionId={restoreSessionKind === 'geometry' ? restoreSessionId : undefined}/>}
      {active === 'tables' && <TablesTool/>}
      {active === 'graphs' && <GraphTool restoreSessionId={restoreSessionKind === 'graph' ? restoreSessionId : undefined}/>}
      {active === 'engine' && <MathEngineTool/>}
    </div>
    <section className="playground-future-section" aria-labelledby="future-math-tools-title">
      <div className="section-heading compact-heading"><div><div className="eyebrow">PLANNED EXTENSIONS</div><h2 id="future-math-tools-title">More mathematical tools</h2><p>These tools are listed for visibility and are not enabled yet.</p></div></div>
      <div className="playground-future-tools">
        <div className="playground-future-card"><Code2 size={17}/><strong>Math Toolkit for Programming</strong><span className="soon-pill">Soon</span></div>
        <div className="playground-future-card"><Braces size={17}/><strong>Math to Code</strong><span className="soon-pill">Soon</span></div>
        <div className="playground-future-card"><Layers size={17}/><strong>Math Design on Figma</strong><span className="soon-pill">Soon</span></div>
        <div className="playground-future-card"><ExternalLink size={17}/><strong>Graphs and Equations to Embed Outside</strong><span className="soon-pill">Soon</span></div>
      </div>
    </section>
    <div className="playground-footnote"><span>Calculations and constructions run in your browser.</span><span>Personal history and geometry are stored on this device.</span></div>
  </div>;
}
