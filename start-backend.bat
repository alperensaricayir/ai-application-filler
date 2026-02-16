@echo off
echo ====================================================
echo Starting Erasmus AI Backend...
echo ====================================================

cd /d "%~dp0backend\ErasmusAi.Api"

echo 1. Building project...
dotnet build
if %errorlevel% neq 0 (
    echo ERROR: dotnet build failed. Please check the errors above.
    pause
    exit /b %errorlevel%
)

echo 2. Trusting HTTPS certificates...
dotnet dev-certs https --trust

echo 3. Launching Backend Server...
:: Using cmd /k to keep window open if it crashes
start "ErasmusBackend" cmd /k "dotnet run --launch-profile https"

echo Backend launch initiated.
timeout /t 2 >nul
