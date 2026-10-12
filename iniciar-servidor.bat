@echo off
chcp 65001 > nul
title Control de Stock de Perfumes - Servidor en Vivo
cd /d "%~dp0"

echo ================================================================
echo    🧴 INICIANDO SERVIDOR DE CONTROL DE STOCK DE PERFUMES
echo ================================================================
echo.
echo  Base de datos: SQLite (stock.db)
echo  Sincronizacion en tiempo real: Activada
echo.
echo  Abriendo la aplicacion en tu navegador...
echo.

:: Abrir navegador en segundo plano
start "" http://localhost:3000

:: Iniciar servidor Node.js
node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Hubo un problema al iniciar el servidor.
    pause
)
