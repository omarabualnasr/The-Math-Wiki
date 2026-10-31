/**
 * Dependency-free polynomial utilities for the Mathematics Wiki CAS.
 * Coefficients are stored in ascending order: [c0, c1, c2, ...].
 * The parser intentionally supports only explicit polynomial arithmetic so
 * unsupported functions are never presented as symbolic results.
 */

export type Polynomial = number[];

type Token = { kind: 'number' | 'identifier' | 'operator'; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([()+\-*/^]))/gy;
  let cursor = 0;
  while (cursor < source.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) {
      if (/^\s*$/.test(source.slice(cursor))) break;
      throw new Error(`Unsupported polynomial syntax near “${source.slice(cursor, cursor + 12)}”. Use explicit multiplication, such as 3*x.`);
    }
    const value = match[1] ?? match[2] ?? match[3];
    tokens.push({ kind: match[1] ? 'number' : match[2] ? 'identifier' : 'operator', value });
    cursor = pattern.lastIndex;
  }
  return tokens;
}

function trim(poly: Polynomial): Polynomial {
  const result = poly.slice();
  const scale = Math.max(1, ...result.map((value) => Math.abs(value)));
  while (result.length > 1 && Math.abs(result[result.length - 1]) <= 1e-13 * scale) result.pop();
  return result.length ? result : [0];
}

export function addPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  const result = Array.from({ length: Math.max(left.length, right.length) }, (_, index) => (left[index] || 0) + (right[index] || 0));
  return trim(result);
}

export function subtractPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  const result = Array.from({ length: Math.max(left.length, right.length) }, (_, index) => (left[index] || 0) - (right[index] || 0));
  return trim(result);
}

export function multiplyPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  const result = Array.from({ length: left.length + right.length - 1 }, () => 0);
  left.forEach((a, i) => right.forEach((b, j) => { result[i + j] += a * b; }));
  return trim(result);
}

function scalePolynomial(poly: Polynomial, factor: number): Polynomial {
  return trim(poly.map((coefficient) => coefficient * factor));
}

class PolynomialParser {
  private index = 0;
  constructor(private readonly tokens: Token[], private readonly variable: string) {}

  parse(): Polynomial {
    if (!this.tokens.length) throw new Error('Enter a polynomial expression.');
    const result = this.expression();
    if (this.index !== this.tokens.length) throw new Error(`Unexpected token “${this.tokens[this.index].value}”.`);
    return trim(result);
  }

  private peek(value?: string): Token | undefined {
    const token = this.tokens[this.index];
    return value === undefined || token?.value === value ? token : undefined;
  }

  private consume(): Token {
    const token = this.tokens[this.index];
    if (!token) throw new Error('The polynomial expression ended unexpectedly.');
    this.index += 1;
    return token;
  }

  private expression(): Polynomial {
    let result = this.term();
    while (this.peek('+') || this.peek('-')) {
      const operator = this.consume().value;
      const right = this.term();
      result = operator === '+' ? addPolynomials(result, right) : subtractPolynomials(result, right);
    }
    return result;
  }

  private term(): Polynomial {
    let result = this.unary();
    while (this.peek('*') || this.peek('/')) {
      const operator = this.consume().value;
      const right = this.unary();
      if (operator === '*') result = multiplyPolynomials(result, right);
      else {
        if (right.length !== 1 || Math.abs(right[0]) < 1e-14) throw new Error('Polynomial division is supported only by a non-zero constant.');
        result = scalePolynomial(result, 1 / right[0]);
      }
    }
    return result;
  }

  private power(): Polynomial {
    let base = this.primary();
    if (this.peek('^')) {
      this.consume();
      const exponent = this.unary();
      if (exponent.length !== 1 || !Number.isInteger(exponent[0]) || exponent[0] < 0 || exponent[0] > 12) {
        throw new Error('Polynomial powers must be whole numbers from 0 to 12.');
      }
      let result: Polynomial = [1];
      for (let count = 0; count < exponent[0]; count += 1) result = multiplyPolynomials(result, base);
      base = result;
    }
    return base;
  }

  private unary(): Polynomial {
    if (this.peek('+')) { this.consume(); return this.unary(); }
    if (this.peek('-')) { this.consume(); return scalePolynomial(this.unary(), -1); }
    return this.power();
  }

  private primary(): Polynomial {
    const token = this.consume();
    if (token.kind === 'number') return [Number(token.value)];
    if (token.kind === 'identifier') {
      if (token.value !== this.variable) throw new Error(`Only the variable “${this.variable}” is supported in polynomial mode.`);
      return [0, 1];
    }
    if (token.value === '(') {
      const result = this.expression();
      if (!this.peek(')')) throw new Error('Missing closing parenthesis.');
      this.consume();
      return result;
    }
    throw new Error(`Unexpected token “${token.value}”.`);
  }
}

export function parsePolynomial(source: string, variable = 'x'): Polynomial {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(variable)) throw new Error('Use a valid variable name.');
  return new PolynomialParser(tokenize(source.replace(/π/g, 'pi')), variable).parse();
}

export function differentiatePolynomial(poly: Polynomial): Polynomial {
  if (poly.length <= 1) return [0];
  return trim(poly.slice(1).map((coefficient, index) => coefficient * (index + 1)));
}

export function integratePolynomial(poly: Polynomial): Polynomial {
  return trim([0, ...poly.map((coefficient, index) => coefficient / (index + 1))]);
}

export function evaluatePolynomial(poly: Polynomial, x: number): number {
  let result = 0;
  for (let index = poly.length - 1; index >= 0; index -= 1) result = result * x + poly[index];
  return result;
}

export function formatPolynomial(poly: Polynomial, variable = 'x', precision = 12): string {
  const terms: string[] = [];
  const numberText = (value: number) => Number(value.toPrecision(precision)).toString();
  for (let power = poly.length - 1; power >= 0; power -= 1) {
    const coefficient = poly[power];
    if (Math.abs(coefficient) < 1e-13) continue;
    const magnitude = Math.abs(coefficient);
    const coefficientText = power === 0 || Math.abs(magnitude - 1) > 1e-13 ? numberText(magnitude) : '';
    const variableText = power === 0 ? '' : power === 1 ? variable : `${variable}^${power}`;
    const body = `${coefficientText}${coefficientText && variableText ? '*' : ''}${variableText}` || '0';
    if (!terms.length) terms.push(coefficient < 0 ? `-${body}` : body);
    else terms.push(coefficient < 0 ? `- ${body}` : `+ ${body}`);
  }
  return terms.length ? terms.join(' ') : '0';
}

function polynomialScaleAt(poly: Polynomial, x: number): number {
  return Math.max(1, poly.reduce((sum, coefficient, power) => sum + Math.abs(coefficient) * Math.pow(Math.abs(x), power), 0));
}

function uniqueSorted(values: number[]): number[] {
  return values.sort((a, b) => a - b).filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]) > 1e-7 * Math.max(1, Math.abs(value)));
}

/** Finds real roots using a recursive derivative partition and bisection. */
export function solvePolynomialRealRoots(input: Polynomial): number[] {
  const poly = trim(input);
  const degree = poly.length - 1;
  if (degree <= 0) return [];
  if (degree === 1) return [-poly[0] / poly[1]];
  if (degree === 2) {
    const [c, b, a] = poly;
    const discriminant = b * b - 4 * a * c;
    const tolerance = 1e-12 * Math.max(1, b * b, Math.abs(4 * a * c));
    if (discriminant < -tolerance) return [];
    if (Math.abs(discriminant) <= tolerance) return [-b / (2 * a)];
    const root = Math.sqrt(discriminant);
    const q = -0.5 * (b + Math.sign(b || 1) * root);
    return uniqueSorted([q / a, c / q]);
  }

  const leading = poly[degree];
  const bound = 1 + Math.max(...poly.slice(0, degree).map((coefficient) => Math.abs(coefficient / leading)));
  const critical = solvePolynomialRealRoots(differentiatePolynomial(poly)).filter((root) => root > -bound && root < bound);
  const points = [-bound, ...critical, bound];
  const roots: number[] = [];
  for (const point of points) {
    const value = evaluatePolynomial(poly, point);
    if (Math.abs(value) <= 1e-9 * polynomialScaleAt(poly, point)) roots.push(point);
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    let low = points[index];
    let high = points[index + 1];
    let fLow = evaluatePolynomial(poly, low);
    const fHigh = evaluatePolynomial(poly, high);
    if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow === 0 || fHigh === 0 || Math.sign(fLow) === Math.sign(fHigh)) continue;
    for (let iteration = 0; iteration < 120; iteration += 1) {
      const mid = (low + high) / 2;
      const fMid = evaluatePolynomial(poly, mid);
      if (Math.abs(fMid) <= 1e-13 * polynomialScaleAt(poly, mid) || Math.abs(high - low) < 1e-12 * Math.max(1, Math.abs(mid))) {
        low = mid;
        high = mid;
        break;
      }
      if (Math.sign(fMid) === Math.sign(fLow)) { low = mid; fLow = fMid; }
      else high = mid;
    }
    roots.push((low + high) / 2);
  }
  return uniqueSorted(roots);
}

export function solvePolynomialEquation(left: string, right: string, variable = 'x'): { polynomial: Polynomial; degree: number; roots: number[]; classification: 'identity' | 'contradiction' | 'polynomial' } {
  const leftPoly = parsePolynomial(left, variable);
  const rightPoly = parsePolynomial(right, variable);
  const polynomial = subtractPolynomials(leftPoly, rightPoly);
  if (polynomial.length === 1 && Math.abs(polynomial[0]) < 1e-12) return { polynomial, degree: 0, roots: [], classification: 'identity' };
  if (polynomial.length === 1) return { polynomial, degree: 0, roots: [], classification: 'contradiction' };
  return { polynomial, degree: polynomial.length - 1, roots: solvePolynomialRealRoots(polynomial), classification: 'polynomial' };
}

export type PolynomialFactorization = {
  factors: string[];
  remainingPolynomial: Polynomial;
  complete: boolean;
  message: string;
};

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function leastCommonMultiple(a: number, b: number): number {
  return Math.abs(a / greatestCommonDivisor(a, b) * b);
}

function rationalApproximation(value: number): { numerator: number; denominator: number } | null {
  if (Math.abs(value) < 1e-12) return { numerator: 0, denominator: 1 };
  for (let denominator = 1; denominator <= 1000; denominator += 1) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(value - numerator / denominator) <= 1e-9 * Math.max(1e-12, Math.abs(value))) {
      const divisor = greatestCommonDivisor(numerator, denominator);
      return { numerator: numerator / divisor, denominator: denominator / divisor };
    }
  }
  return null;
}

function positiveDivisors(value: number): number[] | null {
  const absolute = Math.abs(Math.round(value));
  if (!Number.isSafeInteger(absolute) || absolute > 10_000_000) return null;
  if (absolute === 0) return [0];
  const result = new Set<number>();
  for (let divisor = 1; divisor * divisor <= absolute; divisor += 1) {
    if (absolute % divisor === 0) { result.add(divisor); result.add(absolute / divisor); }
  }
  return [...result].sort((a, b) => a - b);
}

function toIntegerPolynomial(poly: Polynomial): number[] | null {
  const fractions = poly.map(rationalApproximation);
  if (fractions.some((fraction) => fraction === null)) return null;
  const rational = fractions as Array<{ numerator: number; denominator: number }>;
  const commonDenominator = rational.reduce((result, fraction) => leastCommonMultiple(result, fraction.denominator), 1);
  if (!Number.isSafeInteger(commonDenominator) || commonDenominator > 1_000_000_000) return null;
  const integers = rational.map((fraction) => fraction.numerator * (commonDenominator / fraction.denominator));
  const divisor = integers.reduce((result, value) => greatestCommonDivisor(result, value), 0) || 1;
  const normalized = integers.map((value) => value / divisor);
  return normalized.every(Number.isSafeInteger) ? normalized : null;
}

function findRationalRoot(poly: Polynomial): { value: number; text: string } | null {
  const integerPoly = toIntegerPolynomial(poly);
  if (!integerPoly || integerPoly.length < 2) return null;
  const constantDivisors = positiveDivisors(integerPoly[0]);
  const leadingDivisors = positiveDivisors(integerPoly[integerPoly.length - 1]);
  if (!constantDivisors || !leadingDivisors) return null;
  if (integerPoly[0] === 0) return { value: 0, text: '0' };
  const candidates = new Map<string, { value: number; numerator: number; denominator: number }>();
  for (const numeratorBase of constantDivisors) {
    for (const denominatorBase of leadingDivisors) {
      if (!denominatorBase) continue;
      for (const sign of [-1, 1]) {
        const numerator = sign * numeratorBase;
        const divisor = greatestCommonDivisor(numerator, denominatorBase);
        const reducedNumerator = numerator / divisor;
        const reducedDenominator = denominatorBase / divisor;
        const key = `${reducedNumerator}/${reducedDenominator}`;
        candidates.set(key, { value: reducedNumerator / reducedDenominator, numerator: reducedNumerator, denominator: reducedDenominator });
      }
    }
  }
  const ordered = [...candidates.values()].sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
  for (const candidate of ordered) {
    const remainder = evaluatePolynomial(poly, candidate.value);
    if (Math.abs(remainder) <= 1e-9 * polynomialScaleAt(poly, candidate.value)) {
      const text = candidate.denominator === 1 ? String(candidate.numerator) : `${candidate.numerator}/${candidate.denominator}`;
      return { value: candidate.value, text };
    }
  }
  return null;
}

function divideByLinearFactor(poly: Polynomial, root: number): Polynomial {
  const degree = poly.length - 1;
  if (degree < 1) return poly;
  const quotient = Array.from({ length: degree }, () => 0);
  quotient[degree - 1] = poly[degree];
  for (let index = degree - 2; index >= 0; index -= 1) quotient[index] = poly[index + 1] + root * quotient[index + 1];
  return trim(quotient);
}

/** Extracts provable rational linear factors; any unfactored remainder is returned explicitly. */
export function factorPolynomialOverRationals(input: Polynomial, variable = 'x'): PolynomialFactorization {
  let remaining = trim(input);
  if (remaining.length <= 1) return { factors: [formatPolynomial(remaining, variable)], remainingPolynomial: remaining, complete: true, message: 'The expression is constant.' };
  const factors: string[] = [];
  let guard = 0;
  let extractedCount = 0;
  while (remaining.length > 1 && guard < 12) {
    const root = findRationalRoot(remaining);
    if (!root) break;
    const factor = root.value === 0 ? variable : root.value < 0 ? `(${variable} + ${root.text.replace('-', '')})` : `(${variable} - ${root.text})`;
    factors.push(factor);
    remaining = divideByLinearFactor(remaining, root.value);
    guard += 1;
    extractedCount += 1;
  }
  const complete = remaining.length === 1;
  if (complete) {
    if (!factors.length || Math.abs(remaining[0] - 1) > 1e-12) factors.unshift(String(Number(remaining[0].toPrecision(12))));
  } else {
    factors.push(`(${formatPolynomial(remaining, variable)})`);
  }
  return {
    factors,
    remainingPolynomial: remaining,
    complete,
    message: complete ? 'All non-constant factors were extracted as exact rational linear factors.' : extractedCount > 0 ? 'The rational linear factors shown are exact; the remaining polynomial was not factored further.' : 'No rational linear factor was identified. The polynomial is shown unchanged.',
  };
}
