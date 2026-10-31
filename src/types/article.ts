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
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
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

export type ArticleBlock =
  | TextBlock
  | LatexBlock
  | ImageBlock
  | VideoBlock
  | GraphBlock
  | ExampleBlock
  | DefinitionBlock
  | TableBlock
  | ExerciseBlock;

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
  latex: 'LaTeX',
  graph: 'Interactive graph',
  example: 'Worked example',
  definition: 'Definition',
  table: 'Table',
  exercise: 'Exercise',
};
