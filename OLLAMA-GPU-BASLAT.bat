@echo off
echo ==========================================
echo   OLLAMA GPU MODU BASLATILIYOR (RTX 3050)
echo ==========================================

echo [1/3] Mevcut Ollama islemleri kapatiliyor...
taskkill /IM "ollama app.exe" /F 2>nul
taskkill /IM "ollama.exe" /F 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] GPU ayarlari yapiliyor...
:: Tum katmanlari GPU'ya zorla
set OLLAMA_NUM_GPU=999
:: NVIDIA GPU 0'i sec
set CUDA_VISIBLE_DEVICES=0
:: VRAM kullanimini maksimize et
set OLLAMA_GPU_MEMORY=4096

echo    - OLLAMA_NUM_GPU=999
echo    - CUDA_VISIBLE_DEVICES=0

echo [3/3] Ollama baslatiliyor...
start "Ollama GPU Server" /MIN ollama serve
timeout /t 5 /nobreak >nul

echo.
echo BASARILI! Ollama GPU modunda calisiyor.
echo Pencereyi kapatabilirsiniz (Ollama arka planda calisacak).
pause
