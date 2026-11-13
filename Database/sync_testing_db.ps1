# =============================================================================
# FILE  : sync_testing_db.ps1
# DESC  : Runs every schema migration in Database/ folder against the local
#         testing DB (MonitPaperDB_Testing on DEVRISHI\INDUS, Windows auth).
#
#         Since every migration uses `IF NOT EXISTS` guards, re-running them
#         is safe — already-applied changes are skipped, any missing ones get
#         applied. At the end the testing DB is schema-identical to production.
#
#         Files that are NOT applied:
#           • check_db_schema_diff.sql           (diagnostic only)
#           • reset_monitpaperdb_for_handover.sql (destructive + hard-locked to MonitPaperDB)
#           • sync_testing_db.ps1                 (this file)
#
# REQUIREMENTS:
#   - PowerShell with `SqlServer` module (Install-Module SqlServer -Scope CurrentUser)
#   - Windows account that can connect to DEVRISHI\INDUS
#
# HOW TO RUN (PowerShell):
#   cd "D:\Monit Papers\Monit\Database"
#   .\sync_testing_db.ps1
# =============================================================================

param(
    [string]$Server   = "DEVRISHI\INDUS",
    [string]$Database = "MonitPaperDB_Testing"
)

$ErrorActionPreference = "Stop"

# Module check
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "ERROR: SqlServer PowerShell module not installed." -ForegroundColor Red
    Write-Host "Run this once:  Install-Module SqlServer -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}
Import-Module SqlServer -ErrorAction Stop

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Syncing schema  →  $Server  /  $Database"
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Connectivity check
try {
    Invoke-Sqlcmd -ServerInstance $Server -Database $Database `
        -Query "SELECT DB_NAME() AS db" -TrustServerCertificate -ErrorAction Stop | Out-Null
    Write-Host "  ✓ Connected to $Database" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Cannot connect: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Files to skip
$skip = @(
    'check_db_schema_diff.sql',
    'reset_monitpaperdb_for_handover.sql'
)

# Collect migration files in lexical order (00_, 01_, …, V005_, V006_, V007_, 26_, 27_, 28_)
$files = Get-ChildItem -Path $PSScriptRoot -Filter *.sql |
         Where-Object  { $skip -notcontains $_.Name } |
         Sort-Object   Name

Write-Host ""
Write-Host "  Found $($files.Count) migration files to apply." -ForegroundColor Cyan
Write-Host ""

$ok   = 0
$fail = 0

foreach ($f in $files) {
    Write-Host ("─" * 60)
    Write-Host "  ▶  $($f.Name)" -ForegroundColor White

    try {
        # Read the file, rewrite the USE statement so it targets the testing DB.
        # Allow an optional trailing SQL line-comment (`-- …`) after the semicolon.
        $sql = Get-Content -Path $f.FullName -Raw
        $sql = $sql -replace '(?im)^\s*USE\s+\[?MonitPaperDB\]?\s*;?\s*(--[^\r\n]*)?$', "USE [$Database];"

        Invoke-Sqlcmd -ServerInstance $Server `
                      -Database      $Database `
                      -Query         $sql `
                      -TrustServerCertificate `
                      -QueryTimeout  120 `
                      -ErrorAction   Stop
        Write-Host "     ✓ OK" -ForegroundColor Green
        $ok++
    } catch {
        Write-Host "     ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host ("─" * 60)
Write-Host "  RESULT:  $ok ok   /   $fail failed   /   $($files.Count) total" `
    -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Yellow' })
Write-Host ("─" * 60)
Write-Host ""

if ($fail -eq 0) {
    Write-Host "  ✓ Testing DB is now schema-identical to production." -ForegroundColor Green
    Write-Host "    Optionally re-run check_db_schema_diff.sql to verify." -ForegroundColor Gray
}
