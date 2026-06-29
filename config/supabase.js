// config/supabase.js
// ------------------------------------------------------------
// Creates one Supabase client for backend database operations.
// The service key must stay on the server and must never be exposed
// to frontend JavaScript or EJS pages.
// ------------------------------------------------------------

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    'Supabase is not fully configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to your .env file.'
  );
} else {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = supabase;
