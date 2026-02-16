@echo off
echo ====================================================
echo Erasmus AI - Proje Durdurma
echo ====================================================

echo 1. Backend ve Frontend servisleri durduruluyor...
taskkill /FI "WINDOWTITLE eq ErasmusBackend*" /T /F 2>nul
taskkill /FI "WINDOWTITLE eq ErasmusFrontend*" /T /F 2>nul
taskkill /FI "WINDOWTITLE eq ErasmusAI-Backend*" /T /F 2>nul
taskkill /FI "WINDOWTITLE eq ErasmusAI-Frontend*" /T /F 2>nul

echo 2. Kalan procesler temizleniyor...
echo NOT: Bu islem kalan dotnet/node processlerini kapatmaya calisir.
taskkill /IM dotnet.exe /F 2>nul
taskkill /IM node.exe /F 2>nul

echo ====================================================
echo Servisler durduruldu.
echo ====================================================
pause
