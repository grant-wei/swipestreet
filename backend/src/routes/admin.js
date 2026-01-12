const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../services/supabase');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ============ CARDS MANAGEMENT ============

// List all cards (with pagination)
router.get('/cards', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('cards')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data: cards, count, error } = await query;

    if (error) throw error;

    res.json({
      cards,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / limit),
    });
  } catch (error) {
    next(error);
  }
});

// Create new card
router.post('/cards', async (req, res, next) => {
  try {
    const { type, content, expanded, tickers, categories } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'type and content required' });
    }

    const card = {
      id: uuidv4().slice(0, 8),
      type,
      content,
      expanded: expanded || null,
      tickers: tickers || [],
      categories: categories || [],
      source: 'admin',
      source_title: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('cards')
      .insert(card)
      .select()
      .single();

    if (error) throw error;

    res.json({ card: data });
  } catch (error) {
    next(error);
  }
});

// Update card
router.patch('/cards/:id', async (req, res, next) => {
  try {
    const { type, content, expanded, tickers, categories, is_active } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (type !== undefined) updates.type = type;
    if (content !== undefined) updates.content = content;
    if (expanded !== undefined) updates.expanded = expanded;
    if (tickers !== undefined) updates.tickers = tickers;
    if (categories !== undefined) updates.categories = categories;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('cards')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ card: data });
  } catch (error) {
    next(error);
  }
});

// Delete card
router.delete('/cards/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Bulk import cards
router.post('/cards/import', async (req, res, next) => {
  try {
    const { cards } = req.body;

    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: 'cards array required' });
    }

    const cardsToInsert = cards.map(card => ({
      id: card.id || uuidv4().slice(0, 8),
      type: card.type || 'lesson',
      content: card.content,
      expanded: card.expanded || null,
      tickers: card.tickers || [],
      categories: card.categories || [],
      source: 'import',
      source_title: null,
      is_active: true,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('cards')
      .upsert(cardsToInsert, { onConflict: 'id' })
      .select();

    if (error) throw error;

    res.json({ imported: data.length });
  } catch (error) {
    next(error);
  }
});

// ============ USERS MANAGEMENT ============

// List users
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data: users, count, error } = await supabase
      .from('users')
      .select('id, email, name, subscription_status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      users,
      total: count,
      page: parseInt(page),
    });
  } catch (error) {
    next(error);
  }
});

// Get user details
router.get('/users/:id', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// ============ ANALYTICS ============

// Dashboard stats
router.get('/stats', async (req, res, next) => {
  try {
    const [usersResult, cardsResult, activeSubsResult] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('cards').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    ]);

    res.json({
      total_users: usersResult.count || 0,
      total_cards: cardsResult.count || 0,
      active_subscribers: activeSubsResult.count || 0,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
