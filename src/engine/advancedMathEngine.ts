import { derivative, simplify } from 'mathjs';
import {
  factorPolynomialOverRationals,
  formatPolynomial,
  integratePolynomial,
  parsePolynomial,
  solvePolynomialEquation,
} from './polynomialEngine';
import { evaluateMathExpression } from './mathEngine';

export type EquationSolution = {
  equation: string;
  normalized: string;
  degree: number;
  roots: number[];
  exactMethod: 'identity' | 'contradiction' | 'linear' | 'quadratic' | 'numerical';
  steps: string[];
};

const symbolicNames = new Set(['x', 'y', 'z', 't', 'a', 'b', 'c', 'n', 'pi', 'e', 'tau', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'ln', 'pow', 'mod', 'sign', 'hypot', 'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'abs', 'exp', 'log', 'log10', 'log2', 'floor', 'ceil', 'round', 'min', 'max', 'factorial']);

function validateSymbolicSource(source: string): void {
  if (!source) throw new Error('Enter an expression.');
  if (source.length > 500) throw new Error('Expressions are limited to 500 characters.');
  if (!/^[0-9a-zA-Z_+\-*/^().,!%\s]+$/.test(source)) throw new Error('This expression contains unsupported characters.');
  const identifiers = source.replace(/(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+/g, '0').match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const unknown = identifiers.find((name) => !symbolicNames.has(name) && name.length !== 1);
  if (unknown) throw new Error(`Unsupported symbolic name: ${unknown}`);
}

export function simplifyExpression(expression: string): string {
  const source = expression.trim();
  validateSymbolicSource(source);
  try { return simplify(source).toString(); }
  catch (error) { throw new Error(error instanceof Error ? `Cannot simplify this expression: ${error.message}` : 'Cannot simplify this expression.'); }
}

export function differentiateExpression(expression: string, variable = 'x'): string {
  const source = expression.trim();
  validateSymbolicSource(source);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(variable) || (!symbolicNames.has(variable) && variable.length !== 1)) throw new Error('Enter a valid single-letter or supported differentiation variable.');
  try { return simplify(derivative(source, variable)).toString(); }
  catch (error) { throw new Error(error instanceof Error ? `Cannot differentiate this expression: ${error.message}` : 'Cannot differentiate this expression.'); }
}

export function expandPolynomialExpression(expression: string, variable = 'x'): string {
  return formatPolynomial(parsePolynomial(expression, variable), variable);
}

export function factorPolynomialExpression(expression: string, variable = 'x'): { expression: string; complete: boolean; message: string } {
  const factorization = factorPolynomialOverRationals(parsePolynomial(expression, variable), variable);
  return { expression: factorization.factors.join(' * '), complete: factorization.complete, message: factorization.message };
}

export function integratePolynomialExpression(expression: string, variable = 'x'): string {
  return `${formatPolynomial(integratePolynomial(parsePolynomial(expression, variable)), variable)} + C`;
}

export function solveEquation(equation: string, variable = 'x'): EquationSolution {
  const normalizedEquation = equation.trim();
  const parts = normalizedEquation.split('=');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new Error('Enter one equation with exactly one equals sign, for example x^2 - 5*x + 6 = 0.');
  const result = solvePolynomialEquation(parts[0], parts[1], variable);
  const normalized = `${formatPolynomial(result.polynomial, variable)} = 0`;
  if (result.classification === 'identity') return { equation: normalizedEquation, normalized, degree: 0, roots: [], exactMethod: 'identity', steps: ['Move all terms to one side.', 'The resulting expression is 0 = 0.', 'Every real value of the variable satisfies this identity.'] };
  if (result.classification === 'contradiction') return { equation: normalizedEquation, normalized, degree: 0, roots: [], exactMethod: 'contradiction', steps: ['Move all terms to one side.', `The resulting equation is ${normalized}.`, 'The result is a non-zero constant equal to zero, so there is no solution.'] };

  const steps = [`Move all terms to one side: ${normalized}.`, `The equation is a polynomial of degree ${result.degree}.`];
  let exactMethod: EquationSolution['exactMethod'] = 'numerical';
  if (result.degree === 1) {
    exactMethod = 'linear';
    const [constant, coefficient] = result.polynomial;
    steps.push(`Move the constant term: ${Number(coefficient.toPrecision(10))}*${variable} = ${Number((-constant).toPrecision(10))}.`);
    steps.push(`Divide by ${Number(coefficient.toPrecision(10))}: ${variable} = ${Number(result.roots[0].toPrecision(12))}.`);
  } else if (result.degree === 2) {
    exactMethod = 'quadratic';
    const [c, b, a] = result.polynomial;
    const discriminant = b * b - 4 * a * c;
    steps.push(`For a*x^2 + b*x + c = 0, the discriminant is Δ = b^2 − 4ac = ${Number(discriminant.toPrecision(10))}.`);
    steps.push(`Apply the quadratic formula: ${variable} = (−b ± √Δ) / (2a).`);
    if (result.roots.length) steps.push(`Substitution gives ${result.roots.map((root) => `${variable} ≈ ${Number(root.toPrecision(12))}`).join(' and ')}.`);
  } else {
    steps.push('Real roots are approximated numerically by partitioning the real line at derivative critical points and refining sign changes with bisection.');
  }
  if (!result.roots.length) steps.push('No real roots were found. The equation may have complex solutions.');
  else steps.push(`Real solution${result.roots.length === 1 ? '' : 's'}: ${result.roots.map((root) => `${variable} ≈ ${Number(root.toPrecision(12))}`).join('; ')}.`);
  return { equation: normalizedEquation, normalized, degree: result.degree, roots: result.roots, exactMethod, steps };
}

export function definiteIntegral(expression: string, variable: string, lower: number, upper: number, intervals = 1200): number {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) throw new Error('Integration bounds must be finite numbers.');
  if (lower === upper) return 0;
  if (!Number.isInteger(intervals) || intervals < 10 || intervals > 10000) throw new Error('Use between 10 and 10,000 integration intervals.');
  const sign = upper >= lower ? 1 : -1;
  const a = Math.min(lower, upper);
  const b = Math.max(lower, upper);
  const count = intervals % 2 === 0 ? intervals : intervals + 1;
  const width = (b - a) / count;
  let total = 0;
  for (let index = 0; index <= count; index += 1) {
    const x = a + index * width;
    let value: number;
    try { value = evaluateMathExpression(expression, { [variable]: x }); }
    catch { throw new Error(`The function could not be evaluated near ${variable} = ${x.toPrecision(6)}. Check for discontinuities or undefined values.`); }
    total += (index === 0 || index === count ? 1 : index % 2 === 0 ? 2 : 4) * value;
  }
  return sign * total * width / 3;
}

export type LimitEstimate = { status: 'finite'; value: number; samples: number[] } | { status: 'infinite'; sign: 1 | -1; samples: number[] } | { status: 'does-not-exist'; samples: number[] };

function oneSidedLimit(expression: string, variable: string, point: number, direction: 1 | -1): LimitEstimate {
  const samples: number[] = [];
  for (let exponent = 1; exponent <= 9; exponent += 1) {
    const offset = direction * Math.pow(10, -exponent) * Math.max(1, Math.abs(point));
    try {
      const value = evaluateMathExpression(expression, { [variable]: point + offset });
      samples.push(value);
    } catch { samples.push(Number.NaN); }
  }
  const finite = samples.filter(Number.isFinite);
  if (finite.length < 5) return { status: 'does-not-exist', samples };
  const tail = finite.slice(-4);
  const last = tail[tail.length - 1];
  const scale = Math.max(1, ...tail.map(Math.abs));
  const converged = tail.every((value) => Math.abs(value - last) <= 2e-4 * scale);
  if (converged && Math.abs(last) < 1e12) return { status: 'finite', value: last, samples };
  const magnitudes = finite.slice(-4).map(Math.abs);
  const growing = magnitudes.slice(1).every((value, index) => value > magnitudes[index] * 1.4) && magnitudes[3] > 1e5;
  if (growing) {
    const sign = tail[tail.length - 1] >= 0 ? 1 : -1;
    if (tail.every((value) => Math.sign(value) === sign)) return { status: 'infinite', sign, samples };
  }
  return { status: 'does-not-exist', samples };
}

export function estimateLimit(expression: string, variable: string, point: number, side: 'both' | 'left' | 'right' = 'both'): LimitEstimate {
  if (!Number.isFinite(point)) throw new Error('The limit point must be finite.');
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(variable)) throw new Error('Enter a valid variable name.');
  const right = side === 'left' ? null : oneSidedLimit(expression, variable, point, 1);
  const left = side === 'right' ? null : oneSidedLimit(expression, variable, point, -1);
  if (!right) return left!;
  if (!left) return right;
  if (right.status === 'finite' && left.status === 'finite' && Math.abs(right.value - left.value) <= 5e-4 * Math.max(1, Math.abs(right.value), Math.abs(left.value))) {
    return { status: 'finite', value: (right.value + left.value) / 2, samples: [...left.samples, ...right.samples] };
  }
  if (right.status === 'infinite' && left.status === 'infinite' && right.sign === left.sign) return { status: 'infinite', sign: right.sign, samples: [...left.samples, ...right.samples] };
  return { status: 'does-not-exist', samples: [...left.samples, ...right.samples] };
}
