@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo Erasmus AI - Project Launcher
echo ====================================================

:: Check Prerequisites
echo [1/3] Checking prerequisites...
where dotnet >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: .NET SDK is not installed or not in PATH.
    echo Please install .NET 8 SDK from https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js/npm is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Launch Backend
echo [2/3] Launching Backend...
call "%~dp0start-backend.bat"

:: Launch Frontend
echo [3/3] Launching Frontend...
call "%~dp0start-frontend.bat"

echo ====================================================
echo Proje Basariyla Baslatildi!
echo.
echo Backend API: https://localhost:7099/swagger
echo Frontend UI: http://localhost:5173
echo.
echo NOT: Eger pencereler hemen kapanirsa, konsol pencerelerinde
echo      hata mesajlarini kontrol edin.
echo Projeyi durdurmak icin stop.bat dosyasini calistirin.
echo ====================================================
pause
