require('dotenv').config();
import { createClient  } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be defined in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
});

export { supabase };
