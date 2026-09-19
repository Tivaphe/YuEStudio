@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title YueStudio - Arret

echo.
echo  Script de SECOURS : normalement, fermer la fenetre YueStudio suffit
echo  ^(le modele est decharge et le moteur coupe automatiquement^).
echo.
echo  Arret force de YueStudio ^(interface + moteur audio.cpp^)...
echo.

rem --- 1. L'interface Python (via son fichier PID)
set "PID="
if exist "%~dp0yuestudio.pid" set /p PID=<"%~dp0yuestudio.pid"
if defined PID (
  taskkill /F /PID %PID% >nul 2>nul
  if not errorlevel 1 (echo  [OK] Interface arretee ^(PID %PID%^).) else (echo  [..] Interface deja arretee.)
  del "%~dp0yuestudio.pid" >nul 2>nul
) else (
  echo  [..] Aucun fichier yuestudio.pid : interface probablement deja arretee.
)

rem --- 2. Le moteur audio.cpp
tasklist /FI "IMAGENAME eq audiocpp_server.exe" 2>nul | find /I "audiocpp_server.exe" >nul
if not errorlevel 1 (
  taskkill /F /IM audiocpp_server.exe >nul 2>nul
  echo  [OK] Moteur audio.cpp arrete : la VRAM est liberee.
) else (
  echo  [..] Le moteur audio.cpp ne tournait pas.
)

echo.
echo  Termine. Vous pouvez fermer cette fenetre.
echo.
timeout /t 4 >nul
endlocal
