<#
Interactive PowerShell helper to test Mongo connection without saving the URI.
It prompts for the MongoDB URI (secure input), an optional DB name, then runs
the Node test script `scripts/test-mongo-connection.js` with those env vars.
#>
Param()

Write-Host "Interactive MongoDB connection tester"
$secure = Read-Host "Enter MongoDB URI (example: mongodb+srv://user:pass@cluster.../odrive_app)" -AsSecureString
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if (-not $plain -or $plain.Trim().Length -eq 0) {
    Write-Error "No URI provided. Aborting."
    exit 1
}

$env:MONGO_URI = $plain
$db = Read-Host "Enter DB name (default: odrive_app)"
if ([string]::IsNullOrWhiteSpace($db)) { $env:MONGO_DB_NAME = 'odrive_app' } else { $env:MONGO_DB_NAME = $db }

Write-Host "Running Node test script..."
node .\scripts\test-mongo-connection.js

# cleanup
$env:MONGO_URI = $null
Write-Host "Done. MONGO_URI not saved to disk."
