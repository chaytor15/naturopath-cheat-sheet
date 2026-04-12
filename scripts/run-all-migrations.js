#!/usr/bin/env node
/**
 * Run all SQL files in /migrations in dependency order (direct Postgres, not Supabase REST).
 *
 * Prerequisites (same as scripts/run-migration.js):
 *   - .env.local with DATABASE_URL (recommended), OR
 *   - SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL (builds db.<ref>.supabase.co URL)
 *
 * Usage:
 *   node scripts/run-all-migrations.js
 *   node scripts/run-all-migrations.js --skip-missing-indexes
 *
 * --skip-missing-indexes  Omits add_missing_indexes.sql (needs condition_herbs, conditions, etc.)
 */
const path = require("path");
const fs = require("fs");
const { Client } = require("pg");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        process.env[key] = val;
      }
    });
}

function encodePassword(pwd) {
  return encodeURIComponent(pwd);
}

/** Order: base tables first, then alters. */
const MIGRATION_ORDER = [
  "create_clients_tables.sql",
  "create_consult_tables.sql",
  "create_booking_tables.sql",
  "add_address_fields_to_clients.sql",
  "add_first_last_name_to_clients.sql",
  "add_formula_data_column.sql",
  "add_buffer_time_to_clinic_settings.sql",
  "add_currency_to_clinic_settings.sql",
  "add_profile_fields.sql",
  "add_onboarding_and_practice_address.sql",
  "fix_profiles_rls_self_access.sql",
  "add_missing_indexes.sql",
];

function getConnectionAttempts() {
  let connectionString = process.env.DATABASE_URL;
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL.match(
        /https:\/\/([^.]+)\.supabase\.co/
      ) || [])[1]
    : null;
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!connectionString && password && projectRef) {
    connectionString = `postgresql://postgres:${encodePassword(
      password
    )}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  if (!connectionString) {
    console.error("Missing DATABASE_URL or SUPABASE_DB_PASSWORD.");
    console.error(
      "Add to .env.local (password from Supabase → Project Settings → Database)"
    );
    process.exit(1);
  }

  const attempts = [connectionString];
  if (password && projectRef && !process.env.DATABASE_URL) {
    attempts.push(
      `postgresql://postgres:${encodePassword(
        password
      )}@db.${projectRef}.supabase.co:6543/postgres`
    );
    const regions = (
      process.env.SUPABASE_DB_REGION || "us-east-1,eu-west-1,ap-southeast-1"
    ).split(",");
    for (const region of regions) {
      attempts.push(
        `postgresql://postgres.${projectRef}:${encodePassword(
          password
        )}@aws-0-${region.trim()}.pooler.supabase.com:5432/postgres`
      );
    }
  }
  return attempts;
}

async function connectFirstWorking() {
  const attempts = getConnectionAttempts();
  let lastErr;
  for (const conn of attempts) {
    const client = new Client({ connectionString: conn });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch (_) {}
    }
  }
  console.error("Could not connect:", lastErr?.message);
  process.exit(1);
}

async function main() {
  const skipIndexes = process.argv.includes("--skip-missing-indexes");
  const files = MIGRATION_ORDER.filter(
    (f) => !(skipIndexes && f === "add_missing_indexes.sql")
  );

  const migrationsDir = path.join(__dirname, "..", "migrations");
  for (const name of files) {
    const full = path.join(migrationsDir, name);
    if (!fs.existsSync(full)) {
      console.error("Missing migration file:", full);
      process.exit(1);
    }
  }

  const client = await connectFirstWorking();
  try {
    for (const name of files) {
      const full = path.join(migrationsDir, name);
      const sql = fs.readFileSync(full, "utf8");
      console.log("Applying:", name);
      await client.query(sql);
      console.log("  OK");
    }
    console.log("\nAll migrations applied.");
  } catch (err) {
    console.error("\nFailed:", err.message);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

main();
