const express = require('express');
const { supabase } = require('../services/supabase');
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
