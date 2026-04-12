#!/usr/bin/env node
/**
 * Run one SQL file from /migrations (direct Postgres, same auth as run-all-migrations.js).
 *
 * Usage:
 *   node scripts/run-migration-file.js add_onboarding_and_practice_address.sql
 *
 * Prerequisites (.env.local):
 *   - DATABASE_URL, or
 *   - SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL
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
  const fileName =
    process.argv[2] || "add_onboarding_and_practice_address.sql";
  if (!/^[\w.-]+\.sql$/i.test(fileName)) {
    console.error("Invalid migration file name:", fileName);
    process.exit(1);
  }

  const full = path.join(__dirname, "..", "migrations", fileName);
  if (!fs.existsSync(full)) {
    console.error("File not found:", full);
    process.exit(1);
  }

  const sql = fs.readFileSync(full, "utf8");
  const client = await connectFirstWorking();
  try {
    console.log("Applying:", fileName);
    await client.query(sql);
    console.log("OK");
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

main();
