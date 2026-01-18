const { createClient } = require('@supabase/supabase-js');

// Primary Supabase (SwipeStreet data)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase credentials not configured');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Proxera Supabase (company fundamentals data)
const proxeraUrl = process.env.PROXERA_SUPABASE_URL;
const proxeraKey = process.env.PROXERA_SUPABASE_KEY;

let proxeraSupabase = null;
if (proxeraUrl && proxeraKey) {
  proxeraSupabase = createClient(proxeraUrl, proxeraKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn('Proxera Supabase credentials not configured - company fundamentals will be unavailable');
}

module.exports = { supabase, proxeraSupabase };
