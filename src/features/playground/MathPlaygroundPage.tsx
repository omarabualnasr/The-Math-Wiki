import { useState } from 'react';
import { Activity, Braces, Calculator, Code2, ExternalLink, Layers, Shapes, Table } from 'lucide-react';
import CalculatorTool from './CalculatorTool';
import GeometryTool from './GeometryTool';
import TablesTool from './TablesTool';
import GraphTool from './GraphTool';

type ToolTab = 'calculator' | 'geometry' | 'tables' | 'graphs';
const tabs: { id: ToolTab; label: string; icon: typeof Calculator; description: string }[] = [
  { id: 'calculator', label: 'Scientific calculator', icon: Calculator, description: 'Evaluate expressions and work with scientific functions.' },
  { id: 'geometry', label: 'Geometry & shapes', icon: Shapes, description: 'Construct points, lines, circles and polygons.' },
  { id: 'tables', label: 'Math tables', icon: Table, description: 'Generate arithmetic and multiplication tables.' },
  { id: 'graphs', label: 'Math graphs', icon: Activity, description: 'Plot and compare mathematical functions.' },
];

export default function MathPlaygroundPage() {
  const [active, setActive] = useState<ToolTab>('calculator');
  const current = tabs.find((tab) => tab.id === active)!;
  return <div className="page-stack playground-page">
    <div className="page-heading"><div><div className="eyebrow">INTERACTIVE WORKSPACE</div><h1>Math Playground</h1><p>Explore calculations, geometric constructions, number tables and interactive graphs.</p></div><div className="playground-heading-mark"><Activity size={20}/><span>Four tools</span></div></div>
    <div className="playground-tool-tabs" role="tablist" aria-label="Math Playground tools">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={active === id} className={active === id ? 'selected' : ''} onClick={() => setActive(id)}><Icon size={16}/><span>{label}</span></button>)}
    </div>
    <div className="playground-active-heading"><div><div className="eyebrow">CURRENT TOOL</div><h2>{current.label}</h2><p>{current.description}</p></div></div>
    <div role="tabpanel" aria-label={current.label}>
      {active === 'calculator' && <CalculatorTool/>}
      {active === 'geometry' && <GeometryTool/>}
      {active === 'tables' && <TablesTool/>}
      {active === 'graphs' && <GraphTool/>}
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
