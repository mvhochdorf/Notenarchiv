@echo off
setlocal
title Notenarchiv Dev Server

REM === Node.js zur PATH hinzufuegen, falls noetig ===
where node >nul 2>&1
if errorlevel 1 (
    set "PATH=C:\Program Files\nodejs;%PATH%"
)

REM === In den website-Ordner wechseln (liegt unter diesem Repo-Root) ===
cd /d "%~dp0website"

echo.
echo ============================================
echo   Notenarchiv - Dev Server Launcher
echo ============================================
echo.

REM === Eigener Port, damit andere Projekte (z.B. Drecksau auf 3000) parallel laufen ===
REM === Muss zu "dev" in website\package.json passen ===
set "PORT=3010"

REM === Pruefen ob bereits ein Prozess auf dem Port laeuft ===
REM === (Get-NetTCPConnection statt netstat: netstat schreibt auf deutschem ===
REM ===  Windows "ABHOEREN" statt "LISTENING")                              ===
echo Pruefe Port %PORT% ...
set "FOUND=0"
for /f %%a in ('powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique"') do (
    echo   - Laufender Prozess PID %%a wird beendet
    taskkill /F /PID %%a >nul 2>&1
    set "FOUND=1"
)
if "%FOUND%"=="0" echo   - Kein laufender Server gefunden
echo.

REM === Optional: .next Cache loeschen bei Parameter "clean" ===
if /i "%~1"=="clean" (
    if exist ".next" (
        echo Loesche .next Cache ...
        rmdir /s /q .next
        echo.
    )
)

REM === Falls node_modules fehlt, installieren ===
if not exist "node_modules" (
    echo node_modules fehlt - installiere Dependencies ...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo FEHLER: npm install fehlgeschlagen
        pause
        exit /b 1
    )
    echo.
)

REM === Dev-Server in neuem Fenster starten ===
echo Starte Dev-Server in neuem Fenster ...
start "Notenarchiv Dev Server" cmd /k "npm run dev"

REM === Warten, bis Server bereit ist ===
echo Warte 6 Sekunden auf Server-Start ...
timeout /t 6 /nobreak >nul

REM === Browser oeffnen ===
echo Oeffne Browser ...
start "" http://localhost:%PORT%

echo.
echo ============================================
echo   Fertig. Server laeuft im separaten Fenster.
echo   Zum Beenden: Strg+C im Server-Fenster.
echo.
echo   Tipp: bei seltsamen Darstellungen mal
echo         "start.bat clean" ausfuehren.
echo ============================================
echo.

REM === Dieses Fenster nach 3 Sekunden schliessen ===
timeout /t 3 /nobreak >nul
endlocal
