const express = require('express');
const Stripe = require('stripe');
const { supabase } = require('../services/supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get subscription status
router.get('/status', authenticateToken, async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_end, stripe_customer_id')
      .eq('id', req.user.userId)
      .single();

    const isActive = user?.subscription_status === 'active' &&
      (!user.subscription_end || new Date(user.subscription_end) > new Date());

    res.json({
      is_subscribed: isActive,
      status: user?.subscription_status || 'free',
      ends_at: user?.subscription_end,
    });
  } catch (error) {
    next(error);
  }
});

// Create checkout session
router.post('/checkout', authenticateToken, async (req, res, next) => {
  try {
    const { price_id, plan } = req.body;

    // Get or create Stripe customer
    const { data: user } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', req.user.userId)
      .single();

    let customerId = user?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        metadata: {
          user_id: req.user.userId,
        },
      });
      customerId = customer.id;

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.user.userId);
    }

    // Determine price ID
    const priceId = price_id || (plan === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        user_id: req.user.userId,
      },
    });

    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    next(error);
  }
});

// Create customer portal session
router.post('/portal', authenticateToken, async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', req.user.userId)
      .single();

    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    res.json({ portal_url: session.url });
  } catch (error) {
    next(error);
  }
});

// Get available plans
router.get('/plans', async (req, res, next) => {
  try {
    res.json({
      plans: [
        {
          id: 'monthly',
          name: 'Monthly',
          price: 9.99,
          currency: 'usd',
          interval: 'month',
          features: [
            'Unlimited card access',
            'AI-powered Q&A',
            'Personalized recommendations',
            'Offline access',
          ],
        },
        {
          id: 'yearly',
          name: 'Yearly',
          price: 79.99,
          currency: 'usd',
          interval: 'year',
          savings: '33%',
          features: [
            'Everything in Monthly',
            'Priority support',
            'Early access to new features',
          ],
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
