@echo off
echo ====================================================
echo Erasmus AI - Hizli Baslat
echo ====================================================
echo.
echo Proje baslatiliyor... Lutfen bekleyin.
echo.

cd /d "%~dp0"

:: Backend'i arka planda başlat
cd backend\ErasmusAi.Api
echo [1/2] Backend baslatiliyor...
start "ErasmusAI-Backend" cmd /c "dotnet run --launch-profile https"
cd ..\..

:: Biraz bekle backend ayağa kalksın
timeout /t 3 >nul

:: Frontend'i başlat
cd frontend\erasmus-ai-web
echo [2/2] Frontend baslatiliyor...
start "ErasmusAI-Frontend" cmd /c "npm run dev"
cd ..\..

echo.
echo ====================================================
echo PROJE BASLATILDI!
echo ====================================================
echo.
echo Backend API: https://localhost:7099/swagger
echo Frontend UI: http://localhost:5173
echo.
echo NOT: Backend ve Frontend ayri pencerelerde acildi.
echo      Durum mesajlarini o pencerelerde gorebilirsiniz.
echo.
echo Projeyi durdurmak icin stop.bat dosyasini calistirin.
echo.
echo Bu pencereyi kapatabilirsiniz.
echo ====================================================
echo.
pause
