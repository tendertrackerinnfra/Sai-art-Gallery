$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $projectRoot ".env.production.local"

if (-not (Test-Path -LiteralPath $environmentPath)) {
  throw "Run npm.cmd run setup:supabase before seeding production."
}

Get-Content -LiteralPath $environmentPath | ForEach-Object {
  if ($_ -match '^([A-Z_]+)="(.*)"$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
  }
}

$securePassword = Read-Host "Create the production Owner login password (12+ characters)" -AsSecureString
$ownerPassword = [Net.NetworkCredential]::new("", $securePassword).Password

if ($ownerPassword.Length -lt 12 -or $ownerPassword.Length -gt 128) {
  throw "The Owner password must be between 12 and 128 characters."
}

$env:DEFAULT_OWNER_PASSWORD = $ownerPassword

try {
  Push-Location $projectRoot
  npm.cmd run prisma:seed
} finally {
  Pop-Location
  Remove-Item Env:DEFAULT_OWNER_PASSWORD -ErrorAction SilentlyContinue
  $ownerPassword = $null
  $securePassword.Dispose()
}
