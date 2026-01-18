import { Card } from '../types';

// Using require for JSON to ensure it works with Metro bundler
const cardsData = require('./cards.json');
const ideasData = require('./ideas.json');
const caseStudiesData = require('./case_studies.json');

export const bundledCards: Card[] = cardsData.cards || [];
export const bundledIdeas: Card[] = ideasData.ideas || [];
export const bundledCaseStudies: Card[] = caseStudiesData.case_studies || [];
export const bundledCardsGeneratedAt: string | null = cardsData.generated_at || null;

console.log(`Loaded ${bundledCards.length} bundled cards`);
console.log(`Loaded ${bundledIdeas.length} bundled ideas`);
console.log(`Loaded ${bundledCaseStudies.length} bundled case studies`);
