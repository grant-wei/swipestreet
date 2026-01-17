const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../services/supabase');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/email');

const router = express.Router();
const VERIFICATION_CODE_TTL_MINUTES = 15;

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLinkedInUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isValidLinkedInUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./i, '');
    if (hostname !== 'linkedin.com') return false;
    return url.pathname.startsWith('/in/') || url.pathname.startsWith('/company/');
  } catch (error) {
    return false;
  }
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
      .select('id, email, name, subscription_status, subscription_end, analyst_profile, created_at, work_email, work_email_verified_at, linkedin_url, investor_verification_status, investor_verified_at')
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

// Request investor verification (work email + LinkedIn)
router.post('/investor/request', authenticateToken, async (req, res, next) => {
  try {
    const { work_email, linkedin_url } = req.body;

    if (!work_email || !linkedin_url) {
      return res.status(400).json({ error: 'work_email and linkedin_url required' });
    }

    const normalizedEmail = normalizeEmail(work_email);
    const normalizedLinkedIn = normalizeLinkedInUrl(linkedin_url);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid work email format' });
    }

    if (!isValidLinkedInUrl(normalizedLinkedIn)) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL' });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000
    ).toISOString();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('users')
      .update({
        work_email: normalizedEmail,
        linkedin_url: normalizedLinkedIn,
        investor_verification_status: 'pending_email',
        investor_verification_requested_at: now,
        investor_verification_code: code,
        investor_verification_code_expires_at: expiresAt,
        investor_verified_at: null,
        work_email_verified_at: null,
        updated_at: now,
      })
      .eq('id', req.user.userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to start verification' });
    }

    const emailResult = await sendVerificationEmail(normalizedEmail, code);
    if (!emailResult.sent && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({
      status: 'pending_email',
      expires_at: expiresAt,
      ...(emailResult.sent ? {} : { debug_code: code }),
    });
  } catch (error) {
    next(error);
  }
});

// Verify investor email code
router.post('/investor/verify', authenticateToken, async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'verification code required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('work_email, linkedin_url, investor_verification_code, investor_verification_code_expires_at')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.investor_verification_code) {
      return res.status(400).json({ error: 'No verification request found' });
    }

    if (
      user.investor_verification_code_expires_at &&
      new Date(user.investor_verification_code_expires_at) < new Date()
    ) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (String(code).trim() !== String(user.investor_verification_code)) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (!user.work_email || !user.linkedin_url) {
      return res.status(400).json({ error: 'Missing work email or LinkedIn URL' });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update({
        investor_verification_status: 'verified',
        work_email_verified_at: now,
        investor_verified_at: now,
        investor_verification_code: null,
        investor_verification_code_expires_at: null,
        updated_at: now,
      })
      .eq('id', req.user.userId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to verify investor' });
    }

    res.json({ status: 'verified', verified_at: now });
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
