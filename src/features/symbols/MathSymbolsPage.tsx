import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, FileArchive, Search, Sigma } from 'lucide-react';
import { mathSymbols, symbolCategories } from '../../data/symbols';
import type { MathSymbol } from '../../data/symbols';
import { useSearchParams } from 'react-router-dom';
import { createZipArchive } from '../../engine/zipArchive';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value: string): Promise<void> {
  try { await navigator.clipboard.writeText(value); }
  catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('Clipboard access is not available in this browser.');
  }
}

async function symbolPng(symbol: MathSymbol): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 600;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG export is not available in this browser.');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111111';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let fontSize = 270;
  context.font = `${fontSize}px "Cambria Math", "STIX Two Math", "Times New Roman", serif`;
  while (context.measureText(symbol.symbol).width > 790 && fontSize > 70) {
    fontSize -= 10;
    context.font = `${fontSize}px "Cambria Math", "STIX Two Math", "Times New Roman", serif`;
  }
  context.fillText(symbol.symbol, canvas.width / 2, canvas.height / 2 - 20, 790);
  context.font = '25px Arial, sans-serif';
  context.fillStyle = '#555555';
  context.fillText(symbol.name, canvas.width / 2, canvas.height - 54, 820);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not export this symbol as PNG.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}


export default function MathSymbolsPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [category, setCategory] = useState('All symbols');
  const [selected, setSelected] = useState<MathSymbol>(mathSymbols[0]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return mathSymbols.filter((symbol) => (category === 'All symbols' || symbol.category === category)
      && (!term || [symbol.symbol, symbol.name, symbol.category, symbol.latex, symbol.description, symbol.unicode, ...(symbol.aliases || [])].join(' ').toLowerCase().includes(term)));
  }, [query, category]);
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);
  useEffect(() => {
    if (filtered.length && !filtered.some((symbol) => symbol.id === selected.id)) setSelected(filtered[0]);
  }, [filtered, selected.id]);

  const copy = async (value: string, what: string) => {
    try { await copyText(value); setNotice(`${what} copied.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to copy.'); }
  };
  const exportOne = async (symbol: MathSymbol) => {
    try { setBusy(true); setNotice(`Preparing ${symbol.name} PNG…`); const png = await symbolPng(symbol); downloadBlob(new Blob([png.buffer as ArrayBuffer], { type: 'image/png' }), `${symbol.id}.png`); setNotice(`${symbol.name} PNG exported.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'PNG export failed.'); }
    finally { setBusy(false); }
  };
  const exportAll = async () => {
    try {
      setBusy(true);
      setNotice(`Preparing ${mathSymbols.length} symbol PNG files…`);
      const files: { name: string; data: Uint8Array }[] = [];
      for (const [index, symbol] of mathSymbols.entries()) {
        files.push({ name: `symbols/${symbol.id}.png`, data: await symbolPng(symbol) });
        if ((index + 1) % 20 === 0) setNotice(`Preparing symbols: ${index + 1} of ${mathSymbols.length}…`);
      }
      const metadata = mathSymbols.map(({ id, symbol, name, category, latex, unicode, description, aliases }) => ({ id, symbol, name, category, latex, unicode, description, aliases: aliases || [] }));
      files.push({ name: 'symbols.json', data: new TextEncoder().encode(JSON.stringify(metadata, null, 2)) });
      downloadBlob(createZipArchive(files), 'mathematical-symbols.zip');
      setNotice(`Downloaded ${mathSymbols.length} symbol PNG files and their metadata.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The symbol collection could not be exported.'); }
    finally { setBusy(false); }
  };

  return <div className="page-stack symbols-page">
    <div className="page-heading"><div><div className="eyebrow">MATHEMATICAL REFERENCE</div><h1>Math Symbols Library</h1><p>Search mathematical notation, copy symbols or LaTeX, and export PNG files.</p></div><button className="button button-primary symbols-download-all" onClick={() => void exportAll()} disabled={busy}><FileArchive size={15}/>{busy ? 'Preparing collection…' : 'Download complete set'}</button></div>
    <div className="symbols-summary-row"><div className="symbols-summary"><strong>{mathSymbols.length}</strong><span>catalogued symbols</span></div><div className="symbols-summary"><strong>{symbolCategories.length}</strong><span>categories</span></div><div className="symbols-summary"><strong>PNG + LaTeX</strong><span>export formats</span></div></div>
    <div className="symbols-browser">
      <section className="symbols-list-panel">
        <div className="symbols-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbols, names, meanings or LaTeX…"/><span>{filtered.length}</span></div>
        <div className="symbols-category-row"><button className={category === 'All symbols' ? 'selected' : ''} onClick={() => setCategory('All symbols')}>All symbols</button>{symbolCategories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        {filtered.length ? <div className="symbols-grid">{filtered.map((symbol) => <button className={`symbol-card ${selected.id === symbol.id ? 'selected' : ''}`} key={symbol.id} onClick={() => setSelected(symbol)}><span className="symbol-glyph">{symbol.symbol}</span><span className="symbol-card-name">{symbol.name}</span><span className="symbol-card-category">{symbol.category}</span></button>)}</div> : <div className="tool-empty"><Search size={20}/><strong>No matching symbols</strong><span>Try another name, notation or category.</span></div>}
      </section>
      <aside className="symbols-detail-panel">
        <div className="eyebrow">SYMBOL DETAILS</div>
        <div className="symbol-preview" aria-label={`Symbol ${selected.symbol}`}>{selected.symbol}</div>
        <h2>{selected.name}</h2>
        <p>{selected.description}</p>
        <div className="symbol-detail-field"><span>Category</span><strong>{selected.category}</strong></div>
        <div className="symbol-detail-field"><span>LaTeX</span><code>{selected.latex}</code><button onClick={() => void copy(selected.latex, 'LaTeX')} aria-label="Copy LaTeX"><Copy size={13}/></button></div>
        <div className="symbol-detail-field"><span>Unicode</span><code>{selected.unicode}</code><button onClick={() => void copy(selected.unicode, 'Unicode value')} aria-label="Copy Unicode"><Copy size={13}/></button></div>
        <div className="symbol-detail-actions"><button className="button button-secondary" onClick={() => void copy(selected.symbol, 'Symbol')}><Copy size={14}/> Copy symbol</button><button className="button button-secondary" onClick={() => void exportOne(selected)} disabled={busy}><Download size={14}/> PNG</button></div>
        {notice && <div className="symbol-notice" role="status"><Check size={13}/>{notice}</div>}
        <div className="symbols-info"><Sigma size={16}/><span>PNG files use a transparent background and monochrome symbol artwork. Some glyph appearance can vary by the fonts installed on the device.</span></div>
      </aside>
    </div>
  </div>;
}
