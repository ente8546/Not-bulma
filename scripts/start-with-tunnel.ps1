# Not Bulmaca + Cloudflare Tunnel birlikte başlatır.
# Önce: cloudflare\config.yml dosyasını config.yml.example'dan oluşturup doldurun.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$config = Join-Path $root "cloudflare\config.yml"

if (-not (Test-Path $config)) {
    Write-Host "HATA: cloudflare\config.yml bulunamadi." -ForegroundColor Red
    Write-Host "Once: Copy-Item cloudflare\config.yml.example cloudflare\config.yml"
    Write-Host "Dosyayi duzenleyin. Rehber: docs\CLOUDFLARE-TUNNEL.md"
    exit 1
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "HATA: cloudflared kurulu degil." -ForegroundColor Red
    Write-Host "Kurulum: winget install Cloudflare.cloudflared"
    exit 1
}

Set-Location $root

Write-Host "Node sunucusu baslatiliyor (port 3000)..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:root
    npm start 2>&1
}

Start-Sleep -Seconds 3

try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -eq 200) {
        Write-Host "Sunucu hazir." -ForegroundColor Green
    }
} catch {
    Write-Host "Uyari: Sunucu henuz yanit vermedi, yine de tunel baslatiliyor..." -ForegroundColor Yellow
}

Write-Host "Cloudflare Tunnel baslatiliyor..." -ForegroundColor Cyan
Write-Host "Durdurmak icin Ctrl+C (sunucu job'i da durdurulacak)" -ForegroundColor Gray
Write-Host ""

try {
    cloudflared tunnel --config $config run
} finally {
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
    Write-Host "Sunucu durduruldu." -ForegroundColor Gray
}
