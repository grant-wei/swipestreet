const express = require('express');
const Stripe = require('stripe');
const { supabase } = require('../services/supabase');

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe webhook handler
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutComplete(session) {
  const userId = session.metadata?.user_id;
  if (!userId) return;

  await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      stripe_subscription_id: session.subscription,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`Subscription activated for user ${userId}`);
}

async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;

  // Find user by customer ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  const status = subscription.status === 'active' ? 'active' :
    subscription.status === 'past_due' ? 'past_due' : 'inactive';

  await supabase
    .from('users')
    .update({
      subscription_status: status,
      subscription_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  console.log(`Subscription updated for user ${user.id}: ${status}`);
}

async function handleSubscriptionCanceled(subscription) {
  const customerId = subscription.customer;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  await supabase
    .from('users')
    .update({
      subscription_status: 'canceled',
      subscription_end: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  console.log(`Subscription canceled for user ${user.id}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // TODO: Send email notification about payment failure
  console.log(`Payment failed for user ${user.id}`);
}

module.exports = router;
