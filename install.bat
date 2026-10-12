@echo off
setlocal
title Notenarchiv - Install Dependencies

REM === Node.js zur PATH hinzufuegen, falls noetig ===
where node >nul 2>&1
if errorlevel 1 (
    set "PATH=C:\Program Files\nodejs;%PATH%"
)

REM === In den website-Ordner wechseln (liegt unter diesem Repo-Root) ===
cd /d "%~dp0website"

echo.
echo ============================================
echo   Notenarchiv - npm install
echo ============================================
echo.

REM === Vorhandene node_modules optional aufraeumen ===
if exist "node_modules" (
    echo Loesche altes node_modules ...
    rmdir /s /q node_modules
    echo.
)

REM === Dependencies installieren ===
echo Installiere Dependencies ...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo.
    echo FEHLER: npm install fehlgeschlagen.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Fertig. Du kannst jetzt start.bat starten.
echo ============================================
echo.
pause
endlocal
