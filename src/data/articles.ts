import type { MathArticle } from '../types/article';

// Add exported article JSON files to src/data/pages/ to publish them with the site.
const pageModules = import.meta.glob<MathArticle>('./pages/*.json', { eager: true, import: 'default' });

export const sampleArticles: MathArticle[] = Object.values(pageModules);
