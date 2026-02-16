@echo off
echo ====================================================
echo Starting Erasmus AI Frontend...
echo ====================================================

cd /d "%~dp0frontend\erasmus-ai-web"

echo 1. Checking dependencies...
if not exist node_modules (
    echo node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed.
        pause
        exit /b %errorlevel%
    )
)

echo 2. Launching Frontend Server...
:: Using cmd /k to keep window open if it crashes
start "ErasmusFrontend" cmd /k "npm run dev"

echo Frontend launch initiated.
timeout /t 2 >nul
