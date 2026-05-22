# Windows güvenlik duvarında 3000 portunu açar (telefon/tablet erişimi için).
# Sağ tık → "PowerShell'i yönetici olarak çalıştır" →:
#   cd "C:\...\Not belirleme uygulaması\scripts"
#   .\open-firewall.ps1

$port = 3000
$ruleName = "Not Bulmaca PWA ($port)"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Kural zaten var: $ruleName"
} else {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow `
        -Profile Any | Out-Null
    Write-Host "Güvenlik duvarı kuralı eklendi: TCP $port"
}

Write-Host ""
Write-Host "Simdi npm start calistirin ve telefonda http://BILGISAYAR-IP:$port adresini acin."
