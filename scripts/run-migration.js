#!/usr/bin/env node
/**
 * Run the add_address_fields_to_clients migration.
 * Requires DATABASE_URL in .env.local, or SUPABASE_DB_PASSWORD with NEXT_PUBLIC_SUPABASE_URL.
 *
 * Get your database password from: Supabase Dashboard > Project Settings > Database
 */
const path = require('path');
const fs = require('fs');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    });
}

const { Client } = require('pg');

function encodePassword(pwd) {
  return encodeURIComponent(pwd);
}

async function main() {
  let connectionString = process.env.DATABASE_URL;
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1]
    : 'rjoeiaqkovwkpoqnnogb';
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!connectionString && password && projectRef) {
    connectionString = `postgresql://postgres:${encodePassword(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  if (!connectionString) {
    console.error('Missing DATABASE_URL or SUPABASE_DB_PASSWORD.');
    console.error('Add SUPABASE_DB_PASSWORD to .env.local (from Supabase Dashboard > Settings > Database)');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '..', 'migrations', 'add_address_fields_to_clients.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const attempts = [connectionString];
  if (password && projectRef && !process.env.DATABASE_URL) {
    attempts.push(`postgresql://postgres:${encodePassword(password)}@db.${projectRef}.supabase.co:6543/postgres`);
    const regions = (process.env.SUPABASE_DB_REGION || 'us-east-1,eu-west-1,ap-southeast-1').split(',');
    for (const region of regions) {
      attempts.push(`postgresql://postgres.${projectRef}:${encodePassword(password)}@aws-0-${region.trim()}.pooler.supabase.com:5432/postgres`);
    }
  }

  let lastErr;
  for (const conn of attempts) {
    const client = new Client({ connectionString: conn });
    try {
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log('Migration applied successfully.');
      return;
    } catch (err) {
      lastErr = err;
      try { await client.end(); } catch (_) {}
    }
  }
  console.error('Migration failed:', lastErr.message);
  process.exit(1);
}

main();
