const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { supabase } = require('../src/services/supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not set. Check SUPABASE_URL and SUPABASE_KEY.');
  process.exit(1);
}

const cardsPath = path.resolve(__dirname, '..', '..', 'mobile', 'src', 'data', 'cards.json');
const cardsData = require(cardsPath);
const cards = Array.isArray(cardsData.cards) ? cardsData.cards : [];

if (cards.length === 0) {
  console.error('No cards found in bundle');
  process.exit(1);
}

const now = new Date().toISOString();
const normalizeCards = cards
  .filter((card) => card && card.content)
  .map((card) => ({
    id: card.id,
    type: card.type || 'lesson',
    content: card.content,
    expanded: card.expanded || null,
    tickers: Array.isArray(card.tickers) ? card.tickers : [],
    categories: Array.isArray(card.categories) ? card.categories : [],
    source: card.source || 'bundle',
    source_title: card.source_title || null,
    is_active: true,
    created_at: card.created_at || now,
    updated_at: now,
  }));

const chunkSize = 100;

async function run() {
  let imported = 0;
  for (let i = 0; i < normalizeCards.length; i += chunkSize) {
    const chunk = normalizeCards.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('cards')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error('Failed to import cards:', error);
      process.exit(1);
    }

    imported += chunk.length;
    console.log(`Imported ${imported}/${normalizeCards.length}`);
  }

  console.log('Done.');
}

run().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
