@echo off
chcp 65001 > nul
title AI News Studio — Windows Launcher

echo ======================================================
echo          AI NEWS STUDIO — DEMARRAGE WINDOWS          
echo ======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'a pas ete trouve dans le PATH Windows.
    echo Veuillez installer Node.js v20+ depuis https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Diagnostic de l'environnement...
node scripts/check-environment.js

echo [2/2] Lancement du Studio sur http://localhost:3000...
npm run start:studio
pause
