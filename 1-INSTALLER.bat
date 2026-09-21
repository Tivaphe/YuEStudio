@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title YueStudio - Installation

echo.
echo ################################################################
echo #                  YueStudio - installation                    #
echo #   Moteur audio.cpp + modele YuE2-3B (GGUF) + verification    #
echo ################################################################
echo.
echo  Tout sera telecharge DANS CE DOSSIER (rien n'est installe dans Windows).
echo  Prevoir environ 5,5 Go d'espace disque (12 Go avec toutes les qualites).
echo  Option parolier local (ecrit les paroles hors ligne, +5 Go) : voir PAROLIER.md.
echo.
echo  Si Windows affiche une alerte de securite, autorisez l'execution :
echo  le script telecharge uniquement depuis github.com et huggingface.co.
echo.
pause

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1" %*
set RC=%ERRORLEVEL%

echo.
if not "%RC%"=="0" (
  echo [XX] L'installation s'est terminee avec des erreurs ^(code %RC%^).
  echo      Relancez ce script : les telechargements reprennent ou ils se sont arretes.
  echo      En cas de blocage, lisez la section DEPANNAGE du LISEZ-MOI.md
) else (
  echo [OK] Installation terminee.
)
echo.
pause
endlocal
