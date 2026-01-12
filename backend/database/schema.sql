-- SwipeStreet Database Schema
-- Run this in Supabase SQL Editor

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT,

  -- Subscription
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled')),
  subscription_end TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,

  -- Profile
  analyst_profile JSONB DEFAULT '{}',
  is_admin BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- ============ CARDS ============
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('insight', 'prediction', 'contrarian', 'number', 'thesis', 'stat', 'mechanic', 'lesson', 'pattern', 'framework')),
  content TEXT NOT NULL,
  expanded TEXT,
  tickers TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'research',
  source_title TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_active ON cards(is_active);
CREATE INDEX idx_cards_categories ON cards USING GIN(categories);
CREATE INDEX idx_cards_tickers ON cards USING GIN(tickers);

-- ============ USER PROGRESS ============
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('seen', 'saved', 'unsaved', 'liked', 'disliked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, card_id)
);

CREATE INDEX idx_progress_user ON user_progress(user_id);
CREATE INDEX idx_progress_card ON user_progress(card_id);
CREATE INDEX idx_progress_action ON user_progress(action);

-- ============ USER PREFERENCES ============
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category_scores JSONB DEFAULT '{}',
  type_scores JSONB DEFAULT '{}',
  ticker_scores JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ CHAT LOGS ============
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  message_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_user ON chat_logs(user_id);
CREATE INDEX idx_chat_created ON chat_logs(created_at);

-- ============ ANALYTICS EVENTS ============
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

-- ============ ROW LEVEL SECURITY ============

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Cards are public read
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cards are viewable by everyone" ON cards FOR SELECT USING (is_active = true);

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own progress" ON user_progress FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can upsert own preferences" ON user_preferences FOR ALL USING (auth.uid()::text = user_id::text);

-- Service role bypass for backend
-- Note: The backend uses service_role key which bypasses RLS

-- ============ FUNCTIONS ============

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
