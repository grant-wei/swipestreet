import { Card } from '../types';

// Using require for JSON to ensure it works with Metro bundler
const cardsData = require('./cards.json');

export const bundledCards: Card[] = cardsData.cards || [];

console.log(`Loaded ${bundledCards.length} bundled cards`);
