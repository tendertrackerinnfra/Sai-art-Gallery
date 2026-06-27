param(
  [string]$ProjectRef = "mbyzxswbtkipjwatnmoj",
  [string]$PoolerHost = "aws-1-ap-south-1.pooler.supabase.com"
)

$ErrorActionPreference = "Stop"

$securePassword = Read-Host "Enter the Supabase database password" -AsSecureString
$password = [Net.NetworkCredential]::new("", $securePassword).Password

if ([string]::IsNullOrWhiteSpace($password)) {
  throw "The Supabase database password cannot be empty."
}

$encodedPassword = [Uri]::EscapeDataString($password)
$databaseUser = "postgres.$ProjectRef"
$databaseUrl = "postgresql://${databaseUser}:${encodedPassword}@${PoolerHost}:6543/postgres?pgbouncer=true"
$directUrl = "postgresql://${databaseUser}:${encodedPassword}@${PoolerHost}:5432/postgres"
$authSecretBytes = New-Object byte[] 32
$randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomNumberGenerator.GetBytes($authSecretBytes)
$randomNumberGenerator.Dispose()
$authSecret = [Convert]::ToBase64String($authSecretBytes)

$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $projectRoot ".env.production.local"
$environmentContent = @"
DATABASE_URL="$databaseUrl"
DIRECT_URL="$directUrl"
AUTH_SECRET="$authSecret"
APP_NAME="Sai Art Gallery"
"@

[IO.File]::WriteAllText(
  $environmentPath,
  $environmentContent,
  [Text.UTF8Encoding]::new($false)
)

$password = $null
$encodedPassword = $null
$securePassword.Dispose()

Write-Host "Created .env.production.local. This file is ignored by Git."
