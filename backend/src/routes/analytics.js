const express = require('express');
const { supabase } = require('../services/supabase');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Track analytics event
router.post('/event', optionalAuth, async (req, res) => {
  try {
    const { event, properties } = req.body;
    const userId = req.user?.id || null;

    // Store event in database
    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_name: event,
      event_data: properties || {},
      device_info: {
        user_agent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    res.json({ success: true });
  } catch (error) {
    // Silent fail - don't break client for analytics issues
    console.error('Analytics error:', error);
    res.json({ success: false });
  }
});

// Get event counts (admin only)
router.get('/summary', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Get event counts by type
    const { data: events } = await supabase
      .from('analytics_events')
      .select('event_name, created_at')
      .gte('created_at', since.toISOString());

    // Aggregate by event name
    const summary = {};
    events?.forEach((e) => {
      summary[e.event_name] = (summary[e.event_name] || 0) + 1;
    });

    // Get daily active users
    const { data: dauData } = await supabase
      .from('analytics_events')
      .select('user_id, created_at')
      .gte('created_at', since.toISOString())
      .not('user_id', 'is', null);

    const dailyUsers = {};
    dauData?.forEach((e) => {
      const day = e.created_at.split('T')[0];
      if (!dailyUsers[day]) dailyUsers[day] = new Set();
      dailyUsers[day].add(e.user_id);
    });

    const dau = Object.entries(dailyUsers).map(([date, users]) => ({
      date,
      count: users.size,
    }));

    res.json({
      event_counts: summary,
      daily_active_users: dau,
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to get analytics summary' });
  }
});

module.exports = router;
