export type ArticleLevel =
  | 'Foundations'
  | 'Elementary'
  | 'Secondary'
  | 'University'
  | 'Advanced'
  | 'Research';

export type ArticleDifficulty = 'Very Easy' | 'Easy' | 'Beginner' | 'Medium' | 'Hard' | 'Very Hard';
export type ArticleStatus = 'draft' | 'ready' | 'published';

export interface BlockBase {
  id: string;
  heading?: string;
}

export interface TextBlock extends BlockBase {
  type: 'text';
  content: string;
}

export interface LatexBlock extends BlockBase {
  type: 'latex';
  latex: string;
  display: boolean;
  explanation?: string;
  /** Optional stable label used by references elsewhere in the article. */
  label?: string;
  /** Numbered display equations receive an automatic article-local number. */
  numbered?: boolean;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  assetName?: string;
}

export interface VideoBlock extends BlockBase {
  type: 'video';
  url: string;
  caption?: string;
}

export interface GraphBlock extends BlockBase {
  type: 'graph';
  expression: string;
  xMin: number;
  xMax: number;
  xLabel?: string;
  yLabel?: string;
  caption?: string;
  inspectValue?: number;
}

export interface ExampleBlock extends BlockBase {
  type: 'example';
  question: string;
  steps: string[];
  answer: string;
}

export interface DefinitionBlock extends BlockBase {
  type: 'definition';
  content: string;
}

export interface TableBlock extends BlockBase {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface ExerciseBlock extends BlockBase {
  type: 'exercise';
  question: string;
  hint?: string;
  answer?: string;
}

export type StatementBlockType = 'theorem' | 'lemma' | 'corollary' | 'proposition' | 'axiom';
export interface StatementBlock extends BlockBase {
  type: StatementBlockType;
  statement: string;
  label?: string;
  attribution?: string;
}

export interface ProofBlock extends BlockBase {
  type: 'proof';
  content: string;
  targetLabel?: string;
  conclusion?: string;
}

export interface CalloutBlock extends BlockBase {
  type: 'callout';
  variant: 'note' | 'important' | 'warning' | 'tip';
  content: string;
}

export interface ComparisonBlock extends BlockBase {
  type: 'comparison';
  leftTitle: string;
  leftContent: string;
  rightTitle: string;
  rightContent: string;
}

export interface StepsBlock extends BlockBase {
  type: 'steps';
  steps: string[];
}

export interface DisclosureBlock extends BlockBase {
  type: 'disclosure';
  summary: string;
  content: string;
  initiallyOpen?: boolean;
}

export interface CitationBlock extends BlockBase {
  type: 'citation';
  citation: string;
  url?: string;
  author?: string;
  year?: string;
}

export interface ResourceBlock extends BlockBase {
  type: 'resource';
  label: string;
  url: string;
  description?: string;
  resourceType: 'web' | 'pdf' | 'download';
}

export interface ReferenceBlock extends BlockBase {
  type: 'reference';
  targetLabel: string;
  prefix?: string;
  suffix?: string;
}

export interface ParameterBlock extends BlockBase {
  type: 'parameter';
  expression: string;
  parameter: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  caption?: string;
}

export type ArticleBlock =
  | TextBlock
  | LatexBlock
  | ImageBlock
  | VideoBlock
  | GraphBlock
  | ExampleBlock
  | DefinitionBlock
  | TableBlock
  | ExerciseBlock
  | StatementBlock
  | ProofBlock
  | CalloutBlock
  | ComparisonBlock
  | StepsBlock
  | DisclosureBlock
  | CitationBlock
  | ResourceBlock
  | ReferenceBlock
  | ParameterBlock;

export interface MathArticle {
  schemaVersion: 1;
  id: string;
  slug: string;
  title: string;
  level: ArticleLevel;
  difficulty: ArticleDifficulty;
  aliases: string[];
  summary: string;
  branch: string;
  status: ArticleStatus;
  blocks: ArticleBlock[];
  relatedTopics: string[];
  createdAt: string;
  updatedAt: string;
}

export const ARTICLE_LEVELS: ArticleLevel[] = [
  'Foundations', 'Elementary', 'Secondary', 'University', 'Advanced', 'Research',
];

export const ARTICLE_DIFFICULTIES: ArticleDifficulty[] = [
  'Very Easy', 'Easy', 'Beginner', 'Medium', 'Hard', 'Very Hard',
];

export const BLOCK_LABELS: Record<ArticleBlock['type'], string> = {
  text: 'Text',
  video: 'Video',
  image: 'Image',
  latex: 'LaTeX equation',
  graph: 'Interactive graph',
  example: 'Worked example',
  definition: 'Definition',
  table: 'Table',
  exercise: 'Exercise',
  theorem: 'Theorem',
  lemma: 'Lemma',
  corollary: 'Corollary',
  proposition: 'Proposition',
  axiom: 'Axiom',
  proof: 'Proof',
  callout: 'Note / callout',
  comparison: 'Comparison',
  steps: 'Step-by-step method',
  disclosure: 'Expandable explanation',
  citation: 'Citation',
  resource: 'Resource link',
  reference: 'Cross-reference',
  parameter: 'Interactive parameter',
};

export const STATEMENT_BLOCK_TYPES: StatementBlockType[] = [
  'theorem', 'lemma', 'corollary', 'proposition', 'axiom',
];
