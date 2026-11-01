# AI News Studio — Lanceur PowerShell pour Windows
# Usage: .\scripts\start-studio.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "AI News Studio — Windows Launcher"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "         AI NEWS STUDIO — DÉMARRAGE WINDOWS           " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] Node.js n'a pas été détecté sur votre système Windows." -ForegroundColor Red
    Write-Host "Veuillez installer Node.js v20+ depuis https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Lancer le diagnostic environnemental
Write-Host "[1/2] Vérification de l'environnement système..." -ForegroundColor Gray
node scripts/check-environment.js

# Démarrer le studio Vite sur le port 3000
Write-Host "[2/2] Lancement d'AI News Studio sur http://localhost:3000..." -ForegroundColor Green
npm run start:studio
