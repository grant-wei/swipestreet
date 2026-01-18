const express = require('express');
const { supabase, proxeraSupabase } = require('../services/supabase');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get feed with personalization
router.get('/feed', optionalAuth, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, category } = req.query;
    const userId = req.user?.userId;

    let query = supabase
      .from('cards')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.contains('categories', [category]);
    }

    const { data: cards, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch cards' });
    }

    // If user is logged in, get their preferences for scoring
    let scoredCards = cards;
    if (userId) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      const { data: user } = await supabase
        .from('users')
        .select('analyst_profile')
        .eq('id', userId)
        .single();

      if (prefs || user?.analyst_profile) {
        scoredCards = scoreAndRankCards(cards, prefs, user?.analyst_profile);
      }
    }

    res.json({
      cards: scoredCards,
      total: count || cards.length,
      offset: parseInt(offset),
      has_more: cards.length === parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
});

// Get categories
router.get('/meta/categories', async (req, res, next) => {
  try {
    const { data: cards } = await supabase
      .from('cards')
      .select('categories')
      .eq('is_active', true);

    const categoryMap = {};
    cards?.forEach(card => {
      card.categories?.forEach(cat => {
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      });
    });

    const categories = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// Record user action (seen, saved, liked, disliked)
router.post('/action', authenticateToken, async (req, res, next) => {
  try {
    const { card_id, action } = req.body;
    const userId = req.user.userId;

    if (!card_id || !action) {
      return res.status(400).json({ error: 'card_id and action required' });
    }

    const validActions = ['seen', 'saved', 'unsaved', 'liked', 'disliked'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (action === 'unsaved') {
      await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', card_id)
        .eq('action', 'saved');

      return res.json({ success: true });
    }

    if (action === 'liked') {
      await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', card_id)
        .eq('action', 'disliked');
    }

    if (action === 'disliked') {
      await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', card_id)
        .eq('action', 'liked');
    }

    // Record in progress table
    const { error } = await supabase.from('user_progress').upsert({
      user_id: userId,
      card_id,
      action,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,card_id,action',
    });

    if (error) {
      console.error('Error recording action:', error);
    }

    // Update preferences based on action
    if (['liked', 'disliked', 'saved'].includes(action)) {
      await updatePreferences(userId, card_id, action);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get comments for a card (all users)
router.get('/comments', authenticateToken, async (req, res, next) => {
  try {
    const { card_id } = req.query;
    if (!card_id || typeof card_id !== 'string') {
      return res.status(400).json({ error: 'card_id required' });
    }

    const { data: comments, error } = await supabase
      .from('card_comments')
      .select('id, card_id, text, created_at')
      .eq('card_id', card_id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }

    res.json({ comments: comments || [] });
  } catch (error) {
    next(error);
  }
});

// Add a comment to a card
router.post('/comments', authenticateToken, async (req, res, next) => {
  try {
    const { card_id, text } = req.body;
    const userId = req.user.userId;

    if (!card_id || typeof card_id !== 'string') {
      return res.status(400).json({ error: 'card_id required' });
    }

    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) {
      return res.status(400).json({ error: 'text required' });
    }

    if (normalized.length > 500) {
      return res.status(400).json({ error: 'text too long (max 500)' });
    }

    const { data: comment, error } = await supabase
      .from('card_comments')
      .insert({
        user_id: userId,
        card_id,
        text: normalized,
        created_at: new Date().toISOString(),
      })
      .select('id, card_id, text, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to add comment' });
    }

    res.json({ comment });
  } catch (error) {
    next(error);
  }
});

// Get saved cards
router.get('/user/saved', authenticateToken, async (req, res, next) => {
  try {
    const { data: progress } = await supabase
      .from('user_progress')
      .select('card_id')
      .eq('user_id', req.user.userId)
      .eq('action', 'saved');

    if (!progress?.length) {
      return res.json({ cards: [], total: 0 });
    }

    const cardIds = progress.map(p => p.card_id);
    const { data: cards } = await supabase
      .from('cards')
      .select('*')
      .in('id', cardIds);

    res.json({ cards: cards || [], total: cards?.length || 0 });
  } catch (error) {
    next(error);
  }
});

// Sync all cards for offline use
router.get('/sync/all', authenticateToken, async (req, res, next) => {
  try {
    const { data: cards } = await supabase
      .from('cards')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500);

    res.json({
      cards: cards || [],
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get company fundamentals as cards (thesis, moat, relevancy, management)
router.get('/company/:ticker', async (req, res, next) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // Check if Proxera Supabase is configured
    if (!proxeraSupabase) {
      return res.status(503).json({ error: 'Proxera database not configured' });
    }

    // Fetch from company_fundamentals table (Proxera's database)
    const { data: fundamentals, error } = await proxeraSupabase
      .from('company_fundamentals')
      .select('ticker, data, generated_at')
      .eq('ticker', ticker)
      .single();

    if (error || !fundamentals) {
      return res.status(404).json({ error: `No fundamentals found for ${ticker}` });
    }

    const data = fundamentals.data || {};
    const cards = convertFundamentalsToCards(ticker, data);

    res.json({
      ticker,
      cards,
      generated_at: fundamentals.generated_at,
    });
  } catch (error) {
    next(error);
  }
});

// Get single card
router.get('/:id', async (req, res, next) => {
  try {
    const { data: card, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ card });
  } catch (error) {
    next(error);
  }
});

// Helper: Convert Proxera company fundamentals to SwipeStreet cards
function convertFundamentalsToCards(ticker, data) {
  const cards = [];

  // 1. THESIS CARD
  if (data.thesis) {
    cards.push({
      id: `${ticker}-thesis`,
      type: 'thesis',
      content: data.thesis,
      expanded: buildThesisExpanded(ticker, data),
      tickers: [ticker],
      categories: ['Investment Thesis', data.sector, data.industry].filter(Boolean),
      source: 'proxera',
      source_title: `${ticker} Investment Thesis`,
      card_subtype: 'thesis',
      meta: {
        sector: data.sector,
        industry: data.industry,
        marketCap: data.marketCap,
        price: data.price,
        irrDecomposition: data.irrDecomposition,
        growthDrivers: data.growthDrivers,
      },
    });
  }

  // 2. MOAT CARD
  if (data.moat) {
    cards.push({
      id: `${ticker}-moat`,
      type: 'insight',
      content: data.moat,
      expanded: buildMoatExpanded(ticker, data),
      tickers: [ticker],
      categories: ['Competitive Moat', data.sector].filter(Boolean),
      source: 'proxera',
      source_title: `${ticker} Moat Analysis`,
      card_subtype: 'moat',
      meta: {
        rating: data.moatRating,
        trend: data.moatTrend,
        sources: data.moatSources,
      },
    });
  }

  // 3. RELEVANCY CARD
  if (data.relevancy) {
    cards.push({
      id: `${ticker}-relevancy`,
      type: 'insight',
      content: data.relevancy,
      expanded: buildRelevancyExpanded(ticker, data),
      tickers: [ticker],
      categories: ['Market Position', data.sector].filter(Boolean),
      source: 'proxera',
      source_title: `${ticker} Relevancy Analysis`,
      card_subtype: 'relevancy',
      meta: {
        rating: data.relevancyRating,
        trend: data.relevancyTrend,
        drivers: data.relevancyDrivers,
        tsr1y: data.tsr1y,
        tsr3y: data.tsr3y,
      },
    });
  }

  // 4. MANAGEMENT CARD
  if (data.management || data.managementRating) {
    // Handle case where management is a stringified dict
    let managementContent = data.management;
    if (typeof managementContent === 'string' && managementContent.startsWith('{')) {
      // Parse and format the management info
      try {
        const mgmt = JSON.parse(managementContent.replace(/'/g, '"'));
        managementContent = `Led by CEO ${mgmt.ceo || 'N/A'} with ${mgmt.board_independence_pct || 'N/A'}% board independence.`;
      } catch (e) {
        managementContent = `Management rated as ${data.managementRating || 'Adequate'}.`;
      }
    }

    cards.push({
      id: `${ticker}-management`,
      type: 'insight',
      content: managementContent || `Management rated as ${data.managementRating || 'Adequate'}.`,
      expanded: buildManagementExpanded(ticker, data),
      tickers: [ticker],
      categories: ['Management Quality', data.sector].filter(Boolean),
      source: 'proxera',
      source_title: `${ticker} Management Analysis`,
      card_subtype: 'management',
      meta: {
        rating: data.managementRating,
        roic: data.roic,
        operatingMargin: data.operatingMargin,
      },
    });
  }

  // 5. ESG CARD (if available)
  if (data.sustainability || data.esgHighlights) {
    cards.push({
      id: `${ticker}-esg`,
      type: 'insight',
      content: data.sustainability || data.esgHighlights,
      expanded: buildESGExpanded(ticker, data),
      tickers: [ticker],
      categories: ['ESG', 'Sustainability', data.sector].filter(Boolean),
      source: 'proxera',
      source_title: `${ticker} ESG Analysis`,
      card_subtype: 'esg',
      meta: {
        scores: data.esgScores,
      },
    });
  }

  return cards;
}

// Build expanded content for thesis card
function buildThesisExpanded(ticker, data) {
  let expanded = '';

  if (data.description) {
    expanded += `**About ${ticker}**\n${data.description}\n\n`;
  }

  if (data.growthDrivers?.length) {
    expanded += `**Growth Drivers**\n${data.growthDrivers.map(d => `• ${d}`).join('\n')}\n\n`;
  }

  if (data.segments?.length) {
    expanded += `**Revenue Segments**\n${data.segments.map(s => `• ${s.name}: ${s.pct}%`).join('\n')}\n\n`;
  }

  if (data.irrDecomposition) {
    const irr = data.irrDecomposition;
    expanded += `**Consensus IRR Breakdown**\n`;
    expanded += `Total: ${irr.total}%\n`;
    expanded += `• Dividend: +${irr.dividendYield}%\n`;
    expanded += `• Buybacks: +${irr.buybacks}%\n`;
    expanded += `• Sales Growth: +${irr.salesGrowth}%\n`;
    expanded += `• Margin Expansion: +${irr.marginExpansion}%\n\n`;
  }

  if (data.earningsCall) {
    // Handle case where earningsCall is a stringified array (Python-style)
    let earningsContent = data.earningsCall;
    if (typeof earningsContent === 'string' && earningsContent.startsWith('[')) {
      try {
        // Convert Python-style string to JSON-style
        // Handle single quotes, but be careful with apostrophes
        const jsonStr = earningsContent
          .replace(/^\[/, '[')
          .replace(/\]$/, ']')
          .replace(/(?<=[,\[]) '/g, ' "')  // ' after [ or ,
          .replace(/(?<=[,\[])'/g, '"')    // ' after [ or ,
          .replace(/', /g, '", ')          // ',
          .replace(/', $/g, '"]')          // '] at end
          .replace(/'\]$/g, '"]');         // '] at end
        const items = JSON.parse(jsonStr);
        earningsContent = items.map(item => `• ${item}`).join('\n');
      } catch (e) {
        // Fallback: just clean up the brackets and split
        earningsContent = data.earningsCall
          .replace(/^\[/, '')
          .replace(/\]$/, '')
          .split(/['"]\s*,\s*['"]/)
          .map(item => item.replace(/^['"]|['"]$/g, ''))
          .filter(item => item.trim())
          .map(item => `• ${item}`)
          .join('\n');
      }
    }
    expanded += `**Latest Earnings**\n${earningsContent}\n`;
  }

  return expanded || data.thesis;
}

// Build expanded content for moat card
function buildMoatExpanded(ticker, data) {
  let expanded = `**Moat Rating: ${data.moatRating || 'N/A'}**\n`;
  expanded += `Trend: ${data.moatTrend || 'Stable'}\n\n`;

  if (data.moatSources?.length) {
    expanded += `**Moat Sources**\n${data.moatSources.map(s => `• ${s}`).join('\n')}\n\n`;
  }

  expanded += data.moat;
  return expanded;
}

// Build expanded content for relevancy card
function buildRelevancyExpanded(ticker, data) {
  let expanded = `**Relevancy Rating: ${data.relevancyRating || 'Stable'}**\n`;
  expanded += `Trend: ${data.relevancyTrend || 'Stable'}\n\n`;

  if (data.relevancyDrivers?.length) {
    expanded += `**Relevancy Drivers**\n${data.relevancyDrivers.map(d => `• ${d}`).join('\n')}\n\n`;
  }

  if (data.tsr1y !== null || data.tsr3y !== null) {
    expanded += `**Total Shareholder Return**\n`;
    if (data.tsr1y !== null) expanded += `• 1-Year: ${data.tsr1y}%\n`;
    if (data.tsr3y !== null) expanded += `• 3-Year: ${data.tsr3y}%\n`;
    expanded += '\n';
  }

  expanded += data.relevancy;
  return expanded;
}

// Build expanded content for management card
function buildManagementExpanded(ticker, data) {
  let expanded = `**Management Rating: ${data.managementRating || 'Adequate'}**\n\n`;

  // Parse management data if it's a stringified dict
  let mgmt = null;
  if (typeof data.management === 'string' && data.management.startsWith('{')) {
    try {
      mgmt = JSON.parse(data.management.replace(/'/g, '"'));
    } catch (e) {
      mgmt = null;
    }
  }

  if (mgmt) {
    if (mgmt.ceo) {
      expanded += `**CEO:** ${mgmt.ceo}\n`;
    }
    if (mgmt.executives?.length) {
      expanded += `**Key Executives:** ${mgmt.executives.slice(0, 5).join(', ')}\n`;
    }
    if (mgmt.board_independence_pct) {
      expanded += `**Board Independence:** ${mgmt.board_independence_pct}%\n`;
    }
    expanded += '\n';
  }

  if (data.roic !== null && data.roic !== undefined) {
    expanded += `**Return on Invested Capital:** ${data.roic}%\n`;
  }
  if (data.operatingMargin !== null && data.operatingMargin !== undefined) {
    expanded += `**Operating Margin:** ${data.operatingMargin}%\n`;
  }

  return expanded;
}

// Build expanded content for ESG card
function buildESGExpanded(ticker, data) {
  let expanded = '';

  if (data.esgScores) {
    const scores = data.esgScores;
    expanded += `**ESG Scores (${scores.fiscal_year || 'Latest'})**\n`;
    if (scores.environmental !== null) expanded += `• Environmental: ${scores.environmental}\n`;
    if (scores.social !== null) expanded += `• Social: ${scores.social}\n`;
    if (scores.governance !== null) expanded += `• Governance: ${scores.governance}\n`;
    if (scores.overall !== null) expanded += `• Overall: ${scores.overall}\n`;
    expanded += '\n';
  }

  if (data.esgHighlights) {
    // Handle case where esgHighlights is a stringified array
    let highlights = data.esgHighlights;
    if (typeof highlights === 'string' && highlights.startsWith('[')) {
      try {
        const items = JSON.parse(highlights.replace(/'/g, '"'));
        highlights = items.map(item => `• ${item}`).join('\n');
      } catch (e) {
        highlights = data.esgHighlights;
      }
    }
    expanded += `**Highlights**\n${highlights}\n\n`;
  }

  expanded += data.sustainability || '';
  return expanded;
}

// Helper: Score and rank cards based on preferences
function scoreAndRankCards(cards, preferences, analystProfile) {
  const WEIGHTS = {
    analystIndustry: 2.0,
    analystGeo: 1.5,
    category: 1.0,
    type: 0.8,
    ticker: 0.6,
    exploration: 0.15,
  };

  const INDUSTRY_MAP = {
    technology: ['Technology', 'Software', 'AI', 'Cloud', 'Tech'],
    financials: ['Financials', 'Banking', 'Insurance'],
    healthcare: ['Healthcare', 'Biotech', 'Pharma'],
    consumer: ['Consumer', 'Retail', 'E-commerce'],
    industrials: ['Industrials', 'Manufacturing'],
    energy: ['Energy', 'Oil & Gas', 'Renewables'],
  };

  return cards
    .map(card => {
      let score = 0;

      // Analyst industry match
      if (analystProfile?.industries) {
        for (const industry of analystProfile.industries) {
          const related = INDUSTRY_MAP[industry] || [];
          for (const cat of card.categories || []) {
            if (related.some(r => cat.toLowerCase().includes(r.toLowerCase()))) {
              score += WEIGHTS.analystIndustry;
            }
          }
        }
      }

      // Learned preferences
      if (preferences?.category_scores) {
        for (const cat of card.categories || []) {
          score += (preferences.category_scores[cat] || 0) * WEIGHTS.category;
        }
      }

      // Exploration randomness
      score += (Math.random() - 0.5) * WEIGHTS.exploration;

      return { ...card, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...card }) => card);
}

// Helper: Update user preferences
async function updatePreferences(userId, cardId, action) {
  try {
    // Get card details
    const { data: card } = await supabase
      .from('cards')
      .select('categories, type, tickers')
      .eq('id', cardId)
      .single();

    if (!card) return;

    // Get current preferences
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    const categoryScores = prefs?.category_scores || {};
    const typeScores = prefs?.type_scores || {};
    const tickerScores = prefs?.ticker_scores || {};

    const boost = action === 'disliked' ? -0.5 : 0.3;

    // Update scores
    for (const cat of card.categories || []) {
      categoryScores[cat] = Math.max(-1, Math.min(1, (categoryScores[cat] || 0) + boost));
    }
    typeScores[card.type] = Math.max(-1, Math.min(1, (typeScores[card.type] || 0) + boost));
    for (const ticker of card.tickers || []) {
      tickerScores[ticker] = Math.max(-1, Math.min(1, (tickerScores[ticker] || 0) + boost));
    }

    // Save preferences
    await supabase.from('user_preferences').upsert({
      user_id: userId,
      category_scores: categoryScores,
      type_scores: typeScores,
      ticker_scores: tickerScores,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
  }
}

module.exports = router;
