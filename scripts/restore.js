// Usage: npm run restore -- backups/backup_YYYY-MM-DD_HH-MM.json
// Non-destructive: upserts records by primary key, does not delete existing data.
// Set SUPABASE_SERVICE_KEY for a full restore that bypasses RLS.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ldbrabnvpiidrdkmjpbo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYnJhYm52cGlpZHJka21qcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDMxOTQsImV4cCI6MjA5MzUxOTE5NH0.mJZINJgMl8QD-gTSc2LLikwc8OUloCTyfqoHqRe1xZI';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const BATCH_SIZE = 500;

async function upsertAll(supabase, table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch);
    if (error) throw new Error(error.message);
  }
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/restore.js backups/backup_YYYY-MM-DD_HH-MM.json');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.warn('WARNING: SUPABASE_SERVICE_KEY not set — falling back to anon key.');
    console.warn('         Restore may be blocked by RLS for other users\' data.\n');
  }

  const backup = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  console.log(`Restoring backup exported at ${backup.exportedAt}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  for (const [table, rows] of Object.entries(backup.tables || {})) {
    if (!rows || rows.length === 0) {
      console.log(`  — ${table}: 0 records, skipping`);
      continue;
    }
    try {
      await upsertAll(supabase, table, rows);
      console.log(`  ✓ ${table}: ${rows.length} record${rows.length !== 1 ? 's' : ''} upserted`);
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
    }
  }

  console.log('\nRestore complete.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
