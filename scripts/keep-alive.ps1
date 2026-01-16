# KEEP-ALIVE SCRIPT - Evita Cold Start no Render
# PowerShell version para Windows
# Mantém os serviços acordados fazendo ping a cada 10 minutos

$services = @(
    @{ Name = "Backend (Gerenciador)"; Url = "https://oddrive-backend.onrender.com/api/session/health" },
    @{ Name = "Gerador de Orçamentos"; Url = "https://oddrive-gerador.onrender.com/health" },
    @{ Name = "Workspace"; Url = "https://oddrive-workspace.onrender.com/index.html" }
)

$pingInterval = 600 # 10 minutos em segundos

function Get-Timestamp {
    return Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

function Ping-Service {
    param($Service)
    
    $timestamp = Get-Timestamp
    $startTime = Get-Date
    
    try {
        $response = Invoke-WebRequest -Uri $Service.Url -TimeoutSec 30 -UseBasicParsing
        $duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds, 0)
        
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
            Write-Host "✅ [$timestamp] $($Service.Name) - OK ($($response.StatusCode)) - ${duration}ms" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠️  [$timestamp] $($Service.Name) - Status $($response.StatusCode) - ${duration}ms" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "❌ [$timestamp] $($Service.Name) - ERRO: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Ping-AllServices {
    Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
    Write-Host "🔔 [$(Get-Timestamp)] Iniciando ping em todos os serviços..." -ForegroundColor Cyan
    Write-Host "$('=' * 60)" -ForegroundColor Cyan
    
    $results = @()
    foreach ($service in $services) {
        $results += Ping-Service -Service $service
    }
    
    $successCount = ($results | Where-Object { $_ -eq $true }).Count
    $totalCount = $results.Count
    
    Write-Host "$('=' * 60)" -ForegroundColor Cyan
    Write-Host "📊 Resultado: $successCount/$totalCount serviços online" -ForegroundColor Cyan
    Write-Host "⏱️  Próximo ping em $($pingInterval / 60) minutos" -ForegroundColor Cyan
    Write-Host "$('=' * 60)" -ForegroundColor Cyan
}

# Início do script
Write-Host "🚀 Keep-Alive Script iniciado" -ForegroundColor Green
Write-Host "📅 $(Get-Timestamp)" -ForegroundColor Gray
Write-Host "⏱️  Intervalo: $($pingInterval / 60) minutos" -ForegroundColor Gray
Write-Host "🌐 Monitorando $($services.Count) serviços" -ForegroundColor Gray

# Ping inicial
Ping-AllServices

# Loop infinito com ping a cada intervalo
Write-Host "`nPressione Ctrl+C para encerrar...`n" -ForegroundColor Yellow

try {
    while ($true) {
        Start-Sleep -Seconds $pingInterval
        Ping-AllServices
    }
} catch {
    Write-Host "`n👋 Keep-Alive encerrado" -ForegroundColor Yellow
}
