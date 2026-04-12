# Run every migration in /migrations against Postgres (Supabase DB).
# Requires .env.local: DATABASE_URL or SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL
#
# Usage:
#   .\scripts\run-all-migrations.ps1
#   .\scripts\run-all-migrations.ps1 -SkipMissingIndexes

param(
    [switch] $SkipMissingIndexes
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$args = @()
if ($SkipMissingIndexes) { $args += "--skip-missing-indexes" }

node (Join-Path $PSScriptRoot "run-all-migrations.js") @args
exit $LASTEXITCODE
