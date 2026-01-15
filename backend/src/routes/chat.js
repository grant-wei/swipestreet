const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../services/supabase');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chat about a card
router.post('/message', optionalAuth, async (req, res, next) => {
  try {
    const { card_id, messages, card: cardPayload } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    let card = null;
    if (card_id) {
      const { data, error } = await supabase
        .from('cards')
        .select('type, content, expanded, categories, tickers')
        .eq('id', card_id)
        .single();

      if (!error && data) {
        card = data;
      }
    }

    if (!card && cardPayload) {
      card = {
        type: cardPayload.type || 'insight',
        content: cardPayload.content,
        expanded: cardPayload.expanded || '',
        categories: Array.isArray(cardPayload.categories) ? cardPayload.categories : [],
        tickers: Array.isArray(cardPayload.tickers) ? cardPayload.tickers : [],
      };
    }

    if (!card || !card.content) {
      return res.status(card_id ? 404 : 400).json({ error: 'Card not found' });
    }

    // Build context from card only - no internal data
    const systemPrompt = `
You are a helpful investing tutor. The user is reading an insight card with the following content:

CARD TYPE: ${card.type}
CATEGORIES: ${card.categories?.join(', ') || 'General'}
${card.tickers?.length > 0 ? `RELATED TICKERS: ${card.tickers.join(', ')}` : ''}

INSIGHT:
${card.content}

${card.expanded ? `EXPANDED CONTEXT:\n${card.expanded}` : ''}

Help the user understand this insight better. Be concise (2-3 sentences max per response). Focus on practical understanding and application. Do not reference any external data, databases, or internal systems - only discuss the concepts in this card. Do not mention sources or where this content came from.
`.trim();

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const assistantMessage = response.content[0].text;

    // Log chat for analytics (optional)
    if (req.user?.userId) {
      const { error: logError } = await supabase.from('chat_logs').insert({
        user_id: req.user.userId,
        card_id,
        message_count: messages.length + 1,
        created_at: new Date().toISOString(),
      });
      if (logError) {
        console.warn('Chat log insert failed:', logError.message || logError);
      }
    }

    res.json({
      message: assistantMessage,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);

    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    next(error);
  }
});

module.exports = router;
