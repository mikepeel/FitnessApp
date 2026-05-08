// Usage: npm run backup
// For a full all-users export, set SUPABASE_SERVICE_KEY to the service_role key
// from the Supabase dashboard (Settings → API). The anon key is subject to RLS
// and will only return data visible to an unauthenticated request.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Auto-load .env from project root if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = 'https://ldbrabnvpiidrdkmjpbo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYnJhYm52cGlpZHJka21qcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDMxOTQsImV4cCI6MjA5MzUxOTE5NH0.mJZINJgMl8QD-gTSc2LLikwc8OUloCTyfqoHqRe1xZI';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const TABLES = ['profiles', 'user_settings', 'workout_sessions', 'logged_sets', 'personal_records'];
const PAGE_SIZE = 1000;

async function fetchAll(supabase, table) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.warn('WARNING: SUPABASE_SERVICE_KEY not set — falling back to anon key.');
    console.warn('         Only data accessible without auth (per RLS) will be exported.');
    console.warn('         For a full all-users backup, set SUPABASE_SERVICE_KEY to the');
    console.warn('         service_role key from Supabase dashboard → Settings → API.\n');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Exporting tables...');
  const backup = { exportedAt: new Date().toISOString(), tables: {} };

  for (const table of TABLES) {
    try {
      const rows = await fetchAll(supabase, table);
      backup.tables[table] = rows;
      console.log(`  ✓ ${table}: ${rows.length} record${rows.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
      backup.tables[table] = [];
    }
  }

  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
    console.log('\nCreated backups/ directory');
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const filename = `backup_${ts}.json`;
  const outPath = path.join(backupsDir, filename);

  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup saved → backups/${filename}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
