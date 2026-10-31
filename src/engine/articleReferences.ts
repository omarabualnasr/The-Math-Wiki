import type { ArticleBlock, StatementBlockType } from '../types/article';

export interface ArticleReferenceTarget {
  id: string;
  display: string;
  kind: 'equation' | StatementBlockType;
}

export interface ArticleReferenceIndex {
  byLabel: Record<string, ArticleReferenceTarget>;
  byBlockId: Record<string, ArticleReferenceTarget>;
}

function isStatementBlock(block: ArticleBlock): block is Extract<ArticleBlock, { type: StatementBlockType }> {
  return block.type === 'theorem' || block.type === 'lemma' || block.type === 'corollary' || block.type === 'proposition' || block.type === 'axiom';
}

const STATEMENT_LABELS: Record<StatementBlockType, string> = {
  theorem: 'Theorem',
  lemma: 'Lemma',
  corollary: 'Corollary',
  proposition: 'Proposition',
  axiom: 'Axiom',
};

/** Creates deterministic article-local numbers and a lookup table for cross references. */
export function buildArticleReferenceIndex(blocks: ArticleBlock[]): ArticleReferenceIndex {
  const byLabel = Object.create(null) as Record<string, ArticleReferenceTarget>;
  const byBlockId = Object.create(null) as Record<string, ArticleReferenceTarget>;
  const statementCounts: Record<StatementBlockType, number> = {
    theorem: 0, lemma: 0, corollary: 0, proposition: 0, axiom: 0,
  };
  let equationCount = 0;

  for (const block of blocks) {
    if (block.type === 'latex') {
      const isNumbered = block.display && block.numbered;
      if (isNumbered) equationCount += 1;
      const target: ArticleReferenceTarget = {
        id: block.id,
        display: isNumbered ? `Equation ${equationCount}` : 'Equation',
        kind: 'equation',
      };
      if (isNumbered) byBlockId[block.id] = target;
      if (block.label?.trim()) byLabel[block.label.trim()] = target;
      continue;
    }
    if (isStatementBlock(block)) {
      const type = block.type;
      statementCounts[type] += 1;
      const target: ArticleReferenceTarget = {
        id: block.id,
        display: `${STATEMENT_LABELS[type]} ${statementCounts[type]}`,
        kind: type,
      };
      byBlockId[block.id] = target;
      if (block.label?.trim()) byLabel[block.label.trim()] = target;
    }
  }

  return { byLabel, byBlockId };
}

export function getArticleReferenceIssues(blocks: ArticleBlock[]): string[] {
  const labels = new Set<string>();
  const issues: string[] = [];
  for (const block of blocks) {
    const label = block.type === 'latex' || block.type === 'theorem' || block.type === 'lemma' || block.type === 'corollary' || block.type === 'proposition' || block.type === 'axiom' ? block.label : undefined;
    if (label?.trim()) {
      if (labels.has(label.trim())) issues.push(`Reference label “${label.trim()}” is used more than once.`);
      labels.add(label.trim());
    }
  }
  for (const block of blocks) {
    if ((block.type === 'reference' || block.type === 'proof') && block.targetLabel?.trim() && !labels.has(block.targetLabel.trim())) {
      issues.push(`${block.type === 'proof' ? 'Proof' : 'Cross-reference'} points to missing label “${block.targetLabel}”.`);
    }
  }
  return issues;
}
