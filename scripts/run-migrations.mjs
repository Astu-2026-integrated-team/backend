/**
 * Run database migrations against Supabase using the REST API.
 * Uses the Supabase client's rpc or direct fetch to execute raw SQL.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xernqrsxldbfmqtexmbs.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhlcm5xcnN4bGRiZm1xdGV4bWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODk1NDUsImV4cCI6MjA5MzM2NTU0NX0.SZgRYLusJnUet9-kBGUsuAwVO_y5OQlUzBhabqPsb3w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// We'll use the Supabase SQL Editor API via fetch
async function runSQL(sql, label) {
  console.log(`\n--- Running: ${label} ---`);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`  ⚠ HTTP ${response.status}: ${text}`);
    return false;
  }
  console.log(`  ✓ ${label} completed`);
  return true;
}

// Check what tables exist by trying to query them
async function checkTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return false;
    }
    // Table exists but might be empty or have permission issues
    console.log(`  Table "${tableName}": exists (or permission issue: ${error.message})`);
    return true;
  }
  console.log(`  Table "${tableName}": exists, ${data.length} sample rows`);
  return true;
}

async function main() {
  console.log('=== Checking existing tables ===');
  
  const tables = [
    'admin_users', 'drivers', 'vehicles', 'devices',
    'telemetry_raw', 'telemetry_normalized', 'trips',
    'vehicle_latest_state', 'alerts', 'driver_violations',
    'user_profiles', 'user_vehicle_access', 'device_credentials'
  ];
  
  const tableStatus = {};
  for (const table of tables) {
    tableStatus[table] = await checkTable(table);
  }
  
  console.log('\n=== Table status summary ===');
  for (const [table, exists] of Object.entries(tableStatus)) {
    console.log(`  ${exists ? '✓' : '✗'} ${table}`);
  }
  
  // Check for admin user
  console.log('\n=== Checking admin user ===');
  const { data: admins, error: adminError } = await supabase.from('admin_users').select('*');
  if (adminError) {
    console.log('  Admin users table issue:', adminError.message);
  } else {
    console.log(`  Found ${admins.length} admin users:`, admins.map(a => a.username));
  }
}

main().catch(console.error);
