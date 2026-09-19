@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title YueStudio

if not exist "%~dp0engine\audiocpp_server.exe" (
  echo.
  echo [XX] Le moteur audio.cpp est absent du dossier "engine".
  echo      Lancez d'abord :  1-INSTALLER.bat
  echo.
  pause
  exit /b 1
)

rem Recherche d'un vrai Python (le raccourci du Microsoft Store ne compte pas)
set "PY="
py -3 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PY=py -3"

if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)

if not defined PY (
  python3 -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python3"
)

if not defined PY (
  echo.
  echo [XX] Python est introuvable, alors que l'interface en a besoin.
  echo.
  echo      Installez-le avec cette commande ^(puis fermez et rouvrez cette fenetre^) :
  echo.
  echo          winget install -e --id Python.Python.3.12
  echo.
  echo      Ou telechargez-le ici : https://www.python.org/downloads/windows/
  echo      ^>^> Cochez "Add python.exe to PATH" pendant l'installation ^<^<
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0models\Yue2-3B-GGUF" (
  echo.
  echo [!!] Le dossier "models\Yue2-3B-GGUF" est absent : l'interface demarre,
  echo      mais la generation echouera tant que le modele n'est pas telecharge.
  echo      Lancez 1-INSTALLER.bat dans une autre fenetre si besoin.
  echo.
)

echo.
echo  Demarrage de YueStudio...
echo  Le navigateur va s'ouvrir sur http://127.0.0.1:8090
echo  GARDEZ CETTE FENETRE OUVERTE pendant que vous creez de la musique.
echo.
echo  Pour tout arreter : FERMEZ SIMPLEMENT CETTE FENETRE.
echo  Le modele est alors decharge (VRAM liberee) et le moteur coupe tout seul.
echo  Rien d'autre a faire : 3-ARRETER.bat ne sert qu'en cas de blocage.
echo.

%PY% "%~dp0app\server.py" --port 8090
set RC=%ERRORLEVEL%

echo.
echo  YueStudio est arrete ^(code %RC%^).
pause
endlocal
