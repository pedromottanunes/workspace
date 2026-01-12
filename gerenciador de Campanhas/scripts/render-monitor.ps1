<#
PowerShell helper to interact with Render API.
Usage (PowerShell):
  $env:RENDER_API_KEY = "your_api_key"
  .\render-monitor.ps1 -ServiceId <serviceId> -Action status

Actions:
  status         - list recent deploys for the service
  deploy         - trigger a new deploy (empty trigger)
  last           - show the latest deploy details
  logs <deployId> - fetch events for a given deploy id

Notes:
- Set $env:RENDER_API_KEY with your Render API key before running.
- This script uses Invoke-RestMethod which is available in PowerShell 5.1+.
#>
param(
  [Parameter(Mandatory=$true)][string]$ServiceId,
  [Parameter(Mandatory=$true)][ValidateSet("status","deploy","last","logs")][string]$Action,
  [string]$DeployId
)

if (-not $env:RENDER_API_KEY) {
  Write-Error "Set environment variable RENDER_API_KEY first: $env:RENDER_API_KEY"
  exit 1
}

$base = "https://api.render.com/v1/services/$ServiceId"
$headers = @{ Authorization = "Bearer $($env:RENDER_API_KEY)"; "Accept" = "application/json" }

switch ($Action) {
  'status' {
    $url = "$base/deploys"
    Write-Host "GET $url"
    $res = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $res | Select-Object id, state, serviceId, startedAt, finishedAt | Format-Table -AutoSize
  }
  'last' {
    $url = "$base/deploys?limit=1"
    Write-Host "GET $url"
    $res = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($res -and $res.Count -gt 0) {
      $d = $res[0]
      $d | ConvertTo-Json -Depth 6 | Out-String
    } else { Write-Host "No deploys found." }
  }
  'deploy' {
    $url = "$base/deploys"
    Write-Host "POST $url -> trigger deploy"
    $res = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body '{}' -ContentType 'application/json'
    $res | Select-Object id, state, serviceId, createdAt | Format-Table -AutoSize
  }
  'logs' {
    if (-not $DeployId) { Write-Error "Provide -DeployId for logs action"; exit 1 }
    $url = "https://api.render.com/v1/services/$ServiceId/deploys/$DeployId/events"
    Write-Host "GET $url"
    $res = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    # Print messages
    foreach ($e in $res) { Write-Output ("[{0}] {1}" -f $e.createdAt, $e.message) }
  }
}
