const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../services/supabase');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user or login existing
router.post('/register', async (req, res, next) => {
  try {
    const { device_id, email, name } = req.body;

    if (!device_id && !email) {
      return res.status(400).json({ error: 'device_id or email required' });
    }

    // Check if user exists
    let query = supabase.from('users').select('*');
    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('device_id', device_id);
    }

    const { data: existingUser } = await query.single();

    if (existingUser) {
      // Return existing user
      const token = generateToken(existingUser.id, existingUser.email);
      return res.json({
        token,
        user_id: existingUser.id,
        is_new: false,
      });
    }

    // Create new user
    const userId = uuidv4();
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        device_id: device_id || null,
        email: email || null,
        name: name || null,
        subscription_status: 'free',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const token = generateToken(newUser.id, newUser.email);
    res.json({
      token,
      user_id: newUser.id,
      is_new: true,
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, subscription_status, subscription_end, analyst_profile, created_at')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.patch('/me', authenticateToken, async (req, res, next) => {
  try {
    const { name, email, analyst_profile } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (analyst_profile !== undefined) updates.analyst_profile = analyst_profile;
    updates.updated_at = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Delete account
router.delete('/me', authenticateToken, async (req, res, next) => {
  try {
    // Delete user data
    await supabase.from('user_progress').delete().eq('user_id', req.user.userId);
    await supabase.from('user_preferences').delete().eq('user_id', req.user.userId);
    await supabase.from('users').delete().eq('id', req.user.userId);

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
});

// Export user data (GDPR compliance)
router.get('/export', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const [userData, progressData, preferencesData] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('user_progress').select('*').eq('user_id', userId),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
    ]);

    res.json({
      exported_at: new Date().toISOString(),
      user: userData.data,
      progress: progressData.data,
      preferences: preferencesData.data,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
