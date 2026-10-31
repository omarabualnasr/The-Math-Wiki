import { useRef, useState, type ReactNode } from 'react';
import { Activity, Check, Copy, Table, Keyboard, Sigma, TrendingUp } from 'lucide-react';
import MathKeyboard from './MathKeyboard';
import { definiteIntegral, differentiateExpression, estimateLimit, expandPolynomialExpression, factorPolynomialExpression, integratePolynomialExpression, simplifyExpression, solveEquation } from '../../engine/advancedMathEngine';
import { determinant, formatMatrix, inverseMatrix, matrixRank, multiplyMatrices, addMatrices, parseMatrix, reducedRowEchelon, solveLinearSystem, transposeMatrix } from '../../engine/matrixEngine';
import { binomialProbability, combinations, linearRegression, parseNumberList, permutations, summarizeStatistics } from '../../engine/statisticsEngine';
import { formatNumber } from '../../engine/mathEngine';

type Workspace = 'algebra' | 'calculus' | 'matrices' | 'statistics';
const workspaceTabs: { id: Workspace; label: string; icon: typeof Sigma; description: string }[] = [
  { id: 'algebra', label: 'Algebra', icon: Sigma, description: 'Simplify, expand and solve supported polynomial equations.' },
  { id: 'calculus', label: 'Calculus', icon: Activity, description: 'Differentiate functions, integrate polynomials and estimate limits.' },
  { id: 'matrices', label: 'Matrices', icon: Table, description: 'Calculate determinants, inverses, products and linear systems.' },
  { id: 'statistics', label: 'Statistics', icon: TrendingUp, description: 'Summarize datasets, analyze regression and calculate probabilities.' },
];

function ResultPanel({ title, children, onCopy }: { title: string; children: ReactNode; onCopy?: () => void }) {
  return <section className="math-engine-result"><div className="math-engine-result-heading"><strong>{title}</strong>{onCopy && <button className="tool-icon-button" type="button" onClick={onCopy} aria-label={`Copy ${title}`}><Copy size={14}/></button>}</div><div className="math-engine-result-body">{children}</div></section>;
}

function FormulaValue({ children }: { children: ReactNode }) {
  return <code className="math-engine-formula">{children}</code>;
}

function readVector(source: string): number[] {
  const values = source.trim().split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new Error('Enter a vector of finite numbers separated by commas.');
  return values;
}

export default function MathEngineTool() {
  const [workspace, setWorkspace] = useState<Workspace>('algebra');
  const [expression, setExpression] = useState('2*x + 3*x + 4');
  const [equation, setEquation] = useState('x^2 - 5*x + 6 = 0');
  const [variable, setVariable] = useState('x');
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('2');
  const [limitPoint, setLimitPoint] = useState('0');
  const [limitSide, setLimitSide] = useState<'both' | 'left' | 'right'>('both');
  const [matrixA, setMatrixA] = useState('1, 2; 3, 4');
  const [matrixB, setMatrixB] = useState('5, 6; 7, 8');
  const [vectorB, setVectorB] = useState('5, 11');
  const [matrixOperation, setMatrixOperation] = useState('determinant');
  const [data, setData] = useState('2, 4, 4, 4, 5, 5, 7, 9');
  const [xData, setXData] = useState('1, 2, 3, 4, 5');
  const [yData, setYData] = useState('2, 4, 5, 4, 6');
  const [nValue, setNValue] = useState('10');
  const [rValue, setRValue] = useState('3');
  const [probability, setProbability] = useState('0.5');
  const [resultTitle, setResultTitle] = useState('Result');
  const [result, setResult] = useState<ReactNode>(null);
  const [copyText, setCopyText] = useState('');
  const [error, setError] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [calculusMode, setCalculusMode] = useState<'derivative' | 'integral' | 'definite' | 'limit'>('derivative');
  const inputRef = useRef<HTMLInputElement>(null);

  const run = (title: string, action: () => { content: ReactNode; copy: string }) => {
    try {
      const output = action();
      setResultTitle(title);
      setResult(output.content);
      setCopyText(output.copy);
      setError('');
    } catch (reason) {
      setResult(null);
      setCopyText('');
      setError(reason instanceof Error ? reason.message : 'The operation could not be completed.');
    }
  };

  const insert = (token: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? expression.length;
    const next = `${expression.slice(0, start)}${token}${expression.slice(end)}`;
    setExpression(next);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + token.length, start + token.length); });
  };

  const calculateAlgebra = (operation: 'simplify' | 'expand' | 'factor' | 'differentiate' | 'integrate') => run(operation === 'simplify' ? 'Simplified expression' : operation === 'expand' ? 'Expanded polynomial' : operation === 'factor' ? 'Polynomial factorization' : operation === 'differentiate' ? 'Derivative' : 'Indefinite integral', () => {
    if (operation === 'factor') {
      const factorization = factorPolynomialExpression(expression, variable);
      return { content: <><FormulaValue>{factorization.expression}</FormulaValue><p className="math-engine-note">{factorization.message}</p></>, copy: factorization.expression };
    }
    const value = operation === 'simplify' ? simplifyExpression(expression) : operation === 'expand' ? expandPolynomialExpression(expression, variable) : operation === 'differentiate' ? differentiateExpression(expression, variable) : integratePolynomialExpression(expression, variable);
    return { content: <FormulaValue>{value}</FormulaValue>, copy: value };
  });

  const calculateEquation = () => run('Equation solution', () => {
    const solved = solveEquation(equation, variable);
    const answer = solved.exactMethod === 'identity' ? 'All real values' : solved.exactMethod === 'contradiction' ? 'No solution' : solved.roots.length ? solved.roots.map((value) => `${variable} ≈ ${formatNumber(value, 12)}`).join(', ') : 'No real roots';
    const content = <div className="math-engine-steps"><div><span>Normalized equation</span><FormulaValue>{solved.normalized}</FormulaValue></div><div><span>Degree</span><strong>{solved.degree}</strong></div><div><span>Solution</span><strong>{answer}</strong></div><ol>{solved.steps.map((step) => <li key={step}>{step}</li>)}</ol><small>{solved.exactMethod === 'numerical' ? 'Numerical real-root approximation; not an exact symbolic solution.' : solved.exactMethod === 'quadratic' ? 'Roots are calculated using the quadratic formula.' : 'Algebraic polynomial solution.'}</small></div>;
    return { content, copy: `${solved.normalized}\n${answer}\n\n${solved.steps.join('\n')}` };
  });

  const calculateCalculus = () => run('Calculus result', () => {
    if (calculusMode === 'derivative') {
      const value = differentiateExpression(expression, variable);
      return { content: <><span className="math-engine-result-label">Symbolic derivative</span><FormulaValue>{`d/d${variable} (${expression}) = ${value}`}</FormulaValue></>, copy: value };
    }
    if (calculusMode === 'integral') {
      const value = integratePolynomialExpression(expression, variable);
      return { content: <><span className="math-engine-result-label">Polynomial antiderivative</span><FormulaValue>{value}</FormulaValue><p className="math-engine-note">Symbolic integration currently supports polynomial expressions with explicit multiplication and non-negative integer powers.</p></>, copy: value };
    }
    if (calculusMode === 'definite') {
      const a = Number(lower); const b = Number(upper);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Enter finite lower and upper bounds.');
      const value = definiteIntegral(expression, variable, a, b);
      const formatted = formatNumber(value, 12);
      return { content: <><span className="math-engine-result-label">Numerical Simpson estimate</span><FormulaValue>{`∫[${a}, ${b}] ${expression} d${variable} ≈ ${formatted}`}</FormulaValue><p className="math-engine-note">Composite Simpson’s rule with 1,200 subintervals. This is a numerical approximation.</p></>, copy: formatted };
    }
    const point = Number(limitPoint);
    if (!Number.isFinite(point)) throw new Error('Enter a finite limit point.');
    const estimate = estimateLimit(expression, variable, point, limitSide);
    const value = estimate.status === 'finite' ? formatNumber(estimate.value, 10) : estimate.status === 'infinite' ? estimate.sign > 0 ? '+∞' : '−∞' : 'Does not exist / could not be determined';
    return { content: <><span className="math-engine-result-label">Numerical limit estimate</span><FormulaValue>{`lim ${variable}→${point} ${expression} = ${value}`}</FormulaValue><p className="math-engine-note">Estimated from successively smaller one-sided offsets. Numerical sampling can miss some oscillatory or highly singular behavior.</p></>, copy: value };
  });

  const calculateMatrix = () => run('Matrix result', () => {
    const a = parseMatrix(matrixA);
    if (matrixOperation === 'determinant') {
      const value = formatNumber(determinant(a), 12);
      return { content: <><span className="math-engine-result-label">Determinant of A</span><FormulaValue>{`det(A) = ${value}`}</FormulaValue></>, copy: value };
    }
    if (matrixOperation === 'inverse') { const value = formatMatrix(inverseMatrix(a)); return { content: <><span className="math-engine-result-label">A⁻¹</span><pre>{value}</pre></>, copy: value }; }
    if (matrixOperation === 'transpose') { const value = formatMatrix(transposeMatrix(a)); return { content: <><span className="math-engine-result-label">Aᵀ</span><pre>{value}</pre></>, copy: value }; }
    if (matrixOperation === 'rref') { const value = formatMatrix(reducedRowEchelon(a)); return { content: <><span className="math-engine-result-label">Reduced row-echelon form</span><pre>{value}</pre><p className="math-engine-note">Rank: {matrixRank(a)}</p></>, copy: value };
    }
    if (matrixOperation === 'rank') { const value = String(matrixRank(a)); return { content: <FormulaValue>rank(A) = {value}</FormulaValue>, copy: value };
    }
    if (matrixOperation === 'multiply' || matrixOperation === 'add') {
      const b = parseMatrix(matrixB);
      const value = formatMatrix(matrixOperation === 'multiply' ? multiplyMatrices(a, b) : addMatrices(a, b));
      return { content: <><span className="math-engine-result-label">{matrixOperation === 'multiply' ? 'A × B' : 'A + B'}</span><pre>{value}</pre></>, copy: value };
    }
    const constants = readVector(vectorB);
    const solved = solveLinearSystem(a, constants);
    const value = solved.solution.map((entry, index) => `x${index + 1} = ${formatNumber(entry, 10)}`).join('\n');
    return { content: <><span className="math-engine-result-label">Unique solution of Ax = b</span><pre>{value}</pre></>, copy: value };
  });

  const calculateStatistics = () => run('Statistics result', () => {
    const values = parseNumberList(data);
    const summary = summarizeStatistics(values);
    const modes = summary.modes.length ? summary.modes.map((value) => formatNumber(value)).join(', ') : 'No repeated mode';
    const summaryText = [
      `Count: ${summary.count}`, `Sum: ${formatNumber(summary.sum)}`, `Mean: ${formatNumber(summary.mean)}`, `Median: ${formatNumber(summary.median)}`,
      `Mode: ${modes}`, `Minimum: ${formatNumber(summary.minimum)}`, `Maximum: ${formatNumber(summary.maximum)}`, `Range: ${formatNumber(summary.range)}`,
      `Population variance: ${formatNumber(summary.populationVariance)}`, `Population standard deviation: ${formatNumber(summary.populationStandardDeviation)}`,
      `Sample variance: ${summary.sampleVariance === null ? 'Not defined for n = 1' : formatNumber(summary.sampleVariance)}`,
      `Sample standard deviation: ${summary.sampleStandardDeviation === null ? 'Not defined for n = 1' : formatNumber(summary.sampleStandardDeviation)}`,
    ];
    const n = Number(nValue); const r = Number(rValue); const p = Number(probability);
    let probabilityText = '';
    try { probabilityText = `\nCombinations C(${n}, ${r}) = ${formatNumber(combinations(n, r))}\nPermutations P(${n}, ${r}) = ${formatNumber(permutations(n, r))}\nBinomial P(X = ${r}) = ${formatNumber(binomialProbability(n, r, p), 12)}`; } catch { /* Probability controls can be filled independently. */ }
    let regressionText = '';
    try {
      const regression = linearRegression(parseNumberList(xData), parseNumberList(yData));
      regressionText = `\nLinear regression: y = ${formatNumber(regression.slope)}x + ${formatNumber(regression.intercept)}\nr = ${formatNumber(regression.correlation)}\nR² = ${formatNumber(regression.rSquared)}`;
    } catch { /* Summary statistics remain useful if optional paired data is incomplete. */ }
    const copy = `${summaryText.join('\n')}${probabilityText}${regressionText}`;
    return { content: <div className="math-engine-stat-grid">{summaryText.map((line) => { const [label, value] = line.split(': '); return <div key={label}><span>{label}</span><strong>{value}</strong></div>; })}<div className="math-engine-stat-extra"><span>Combinatorics & probability</span><strong>{probabilityText.trim() || 'Check n, r and p values.'}</strong></div><div className="math-engine-stat-extra"><span>Linear regression</span><strong>{regressionText.trim() || 'Enter paired x and y values.'}</strong></div></div>, copy };
  });

  return <div className="math-engine-workspace">
    <div className="math-engine-tabs" role="tablist" aria-label="Mathematics engine workspaces">
      {workspaceTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={workspace === id} className={workspace === id ? 'selected' : ''} onClick={() => { setWorkspace(id); setResult(null); setError(''); }}><Icon size={15}/><span>{label}</span></button>)}
    </div>

    {workspace === 'algebra' && <div className="math-engine-layout">
      <section className="play-panel math-engine-input-panel">
        <div className="play-panel-heading"><div className="play-panel-icon"><Sigma size={17}/></div><div><h2>Algebra workspace</h2><p>Symbolic simplification, expansion, factorization and equation solving.</p></div></div>
        <label className="math-engine-field"><span>Expression</span><input ref={inputRef} value={expression} onChange={(event) => setExpression(event.target.value)} onFocus={() => setKeyboardOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter') calculateAlgebra('simplify'); }} spellCheck={false}/></label>
        <label className="math-engine-field math-engine-variable"><span>Variable</span><input value={variable} onChange={(event) => setVariable(event.target.value)} maxLength={12}/></label>
        <div className="math-engine-action-grid"><button className="button button-secondary" onClick={() => calculateAlgebra('simplify')}>Simplify</button><button className="button button-secondary" onClick={() => calculateAlgebra('expand')}>Expand polynomial</button><button className="button button-secondary" onClick={() => calculateAlgebra('factor')}>Factor polynomial</button><button className="button button-secondary" onClick={() => calculateAlgebra('differentiate')}>Differentiate</button><button className="button button-secondary" onClick={() => calculateAlgebra('integrate')}>Integrate polynomial</button></div>
        <button className="math-engine-keyboard-toggle" onClick={() => setKeyboardOpen((value) => !value)}><Keyboard size={14}/>{keyboardOpen ? 'Hide scientific keyboard' : 'Open scientific keyboard'}</button>
        {keyboardOpen && <MathKeyboard compact onInsert={insert} onClose={() => setKeyboardOpen(false)}/>} 
        <div className="math-engine-equation-card"><div><strong>Polynomial equation solver</strong><span>Supports single-variable polynomial equations up to degree 12 for parsing; real roots are isolated numerically for higher degrees.</span></div><input value={equation} onChange={(event) => setEquation(event.target.value)} placeholder="x^2 - 5*x + 6 = 0" spellCheck={false}/><button className="button button-primary" onClick={calculateEquation}>Solve equation</button></div>
      </section>
      <aside className="play-panel math-engine-info-panel"><div className="eyebrow">SUPPORTED ALGEBRA</div><h3>Expression operations</h3><ul><li>Numeric and symbolic simplification through the math expression library.</li><li>Symbolic differentiation for supported functions.</li><li>Exact polynomial expansion with explicit multiplication.</li><li>Polynomial antiderivatives with the constant of integration.</li><li>Linear and quadratic equations with formula-based solutions.</li><li>Higher-degree real roots via numerical bisection and derivative partitions.</li></ul><div className="math-engine-example"><span>Example</span><FormulaValue>(x + 2)*(x + 3)</FormulaValue><small>Expands to x^2 + 5*x + 6</small></div></aside>
    </div>}

    {workspace === 'calculus' && <div className="math-engine-layout">
      <section className="play-panel math-engine-input-panel"><div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>Calculus workspace</h2><p>Symbolic differentiation and numerical analysis.</p></div></div>
        <label className="math-engine-field"><span>Function f({variable})</span><input value={expression} onChange={(event) => setExpression(event.target.value)} spellCheck={false}/></label>
        <label className="math-engine-field math-engine-variable"><span>Variable</span><input value={variable} onChange={(event) => setVariable(event.target.value)} maxLength={12}/></label>
        <div className="math-engine-segmented" role="group" aria-label="Calculus operation">{([{ id: 'derivative', label: 'Derivative' }, { id: 'integral', label: 'Integral' }, { id: 'definite', label: 'Definite' }, { id: 'limit', label: 'Limit' }] as const).map((item) => <button key={item.id} className={calculusMode === item.id ? 'selected' : ''} onClick={() => setCalculusMode(item.id)}>{item.label}</button>)}</div>
        {calculusMode === 'definite' && <div className="math-engine-inline-fields"><label className="math-engine-field"><span>Lower bound</span><input type="number" value={lower} onChange={(event) => setLower(event.target.value)}/></label><label className="math-engine-field"><span>Upper bound</span><input type="number" value={upper} onChange={(event) => setUpper(event.target.value)}/></label></div>}
        {calculusMode === 'limit' && <div className="math-engine-inline-fields"><label className="math-engine-field"><span>Approach point</span><input type="number" value={limitPoint} onChange={(event) => setLimitPoint(event.target.value)}/></label><label className="math-engine-field"><span>Direction</span><select value={limitSide} onChange={(event) => setLimitSide(event.target.value as 'both' | 'left' | 'right')}><option value="both">Two-sided</option><option value="left">From left</option><option value="right">From right</option></select></label></div>}
        <button className="button button-primary math-engine-run-button" onClick={calculateCalculus}>Calculate {calculusMode}</button>
        <p className="math-engine-note">Symbolic results are distinguished from numerical estimates. Integration is currently exact for polynomial expressions; definite integration uses composite Simpson’s rule.</p>
      </section>
      <aside className="play-panel math-engine-info-panel"><div className="eyebrow">CALCULUS REFERENCE</div><h3>Available operations</h3><div className="math-engine-reference-row"><span>Derivative</span><FormulaValue>d/dx [f(x)]</FormulaValue></div><div className="math-engine-reference-row"><span>Antiderivative</span><FormulaValue>∫ f(x) dx</FormulaValue></div><div className="math-engine-reference-row"><span>Definite integral</span><FormulaValue>∫ₐᵇ f(x) dx</FormulaValue></div><div className="math-engine-reference-row"><span>Limit</span><FormulaValue>lim x→a f(x)</FormulaValue></div><p className="math-engine-note">Limit estimation samples points approaching the target. It is an exploratory numerical estimate, not a formal proof of a limit.</p></aside>
    </div>}

    {workspace === 'matrices' && <div className="math-engine-layout">
      <section className="play-panel math-engine-input-panel"><div className="play-panel-heading"><div className="play-panel-icon"><Table size={17}/></div><div><h2>Matrix workspace</h2><p>Perform matrix operations and solve linear systems.</p></div></div>
        <div className="math-engine-matrix-inputs"><label className="math-engine-field"><span>Matrix A · rows separated by semicolons</span><textarea value={matrixA} onChange={(event) => setMatrixA(event.target.value)} rows={3} spellCheck={false}/></label>{['multiply', 'add'].includes(matrixOperation) && <label className="math-engine-field"><span>Matrix B</span><textarea value={matrixB} onChange={(event) => setMatrixB(event.target.value)} rows={3} spellCheck={false}/></label>}{matrixOperation === 'solve' && <label className="math-engine-field"><span>Vector b · comma-separated</span><input value={vectorB} onChange={(event) => setVectorB(event.target.value)}/></label>}</div>
        <label className="math-engine-field"><span>Operation</span><select value={matrixOperation} onChange={(event) => setMatrixOperation(event.target.value)}><option value="determinant">Determinant</option><option value="inverse">Inverse</option><option value="transpose">Transpose</option><option value="rank">Rank</option><option value="rref">Reduced row-echelon form</option><option value="multiply">Multiply A × B</option><option value="add">Add A + B</option><option value="solve">Solve Ax = b</option></select></label>
        <button className="button button-primary math-engine-run-button" onClick={calculateMatrix}>Run matrix operation</button>
      </section>
      <aside className="play-panel math-engine-info-panel"><div className="eyebrow">MATRIX INPUT FORMAT</div><h3>Enter a matrix</h3><p>Use commas or spaces between values and semicolons or new lines between rows.</p><pre className="math-engine-code-example">1, 2, 3; 4, 5, 6</pre><div className="math-engine-reference-row"><span>Square matrices</span><strong>Determinant · Inverse</strong></div><div className="math-engine-reference-row"><span>Rectangular matrices</span><strong>Rank · RREF · Product</strong></div><div className="math-engine-reference-row"><span>Linear systems</span><strong>Unique solution Ax = b</strong></div></aside>
    </div>}

    {workspace === 'statistics' && <div className="math-engine-layout">
      <section className="play-panel math-engine-input-panel"><div className="play-panel-heading"><div className="play-panel-icon"><TrendingUp size={17}/></div><div><h2>Statistics workspace</h2><p>Descriptive statistics, combinatorics and probability.</p></div></div>
        <label className="math-engine-field"><span>Dataset</span><textarea value={data} onChange={(event) => setData(event.target.value)} rows={3} placeholder="2, 4, 4, 4, 5, 5, 7, 9"/></label>
        <div className="math-engine-subheading">Combinatorics & binomial probability</div><div className="math-engine-inline-fields math-engine-inline-fields-3"><label className="math-engine-field"><span>n</span><input type="number" min="0" max="170" value={nValue} onChange={(event) => setNValue(event.target.value)}/></label><label className="math-engine-field"><span>r / successes</span><input type="number" min="0" value={rValue} onChange={(event) => setRValue(event.target.value)}/></label><label className="math-engine-field"><span>Probability p</span><input type="number" min="0" max="1" step="0.01" value={probability} onChange={(event) => setProbability(event.target.value)}/></label></div>
        <div className="math-engine-subheading">Optional linear regression data</div><div className="math-engine-inline-fields"><label className="math-engine-field"><span>x values</span><input value={xData} onChange={(event) => setXData(event.target.value)}/></label><label className="math-engine-field"><span>y values</span><input value={yData} onChange={(event) => setYData(event.target.value)}/></label></div>
        <button className="button button-primary math-engine-run-button" onClick={calculateStatistics}>Analyze dataset</button>
      </section>
      <aside className="play-panel math-engine-info-panel"><div className="eyebrow">STATISTICS REFERENCE</div><h3>Included calculations</h3><ul><li>Mean, median and mode.</li><li>Range, minimum and maximum.</li><li>Population and sample variance.</li><li>Population and sample standard deviation.</li><li>Permutations and combinations.</li><li>Binomial probability P(X = k).</li><li>Least-squares linear regression, correlation and R².</li></ul><p className="math-engine-note">The mode can be multi-valued. If all values occur once, the dataset has no repeated mode.</p></aside>
    </div>}

    {error && <div className="math-engine-error" role="alert">{error}</div>}
    {result !== null && <ResultPanel title={resultTitle} onCopy={() => { if (copyText) void navigator.clipboard?.writeText(copyText).catch(() => undefined); }}>{result}</ResultPanel>}
    <div className="math-engine-disclaimer"><Check size={13}/> Results are calculated locally. Numerical approximations are labeled; unsupported symbolic cases return an error instead of an invented result.</div>
  </div>;
}
