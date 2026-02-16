@echo off
echo ====================================================
echo TUM ACIK PROJELERI DURDUR
echo ====================================================
echo.
echo UYARI: Bu script sistemdeki TUM gelistirme sureclerini
echo        durduracaktir (dotnet, node, npm, java, python vs.)
echo.
echo Devam etmek istediginizden emin misiniz?
echo.
pause

echo.
echo [1/6] Erasmus AI Projesi durduruluyor...
taskkill /FI "WINDOWTITLE eq ErasmusBackend*" /T /F 2>nul
taskkill /FI "WINDOWTITLE eq ErasmusFrontend*" /T /F 2>nul
taskkill /FI "WINDOWTITLE eq ErasmusAI-Backend*" /T /F 2>nul
taskkill /FI "WINDOWTITLE eq ErasmusAI-Frontend*" /T /F 2>nul

echo [2/6] .NET (dotnet) processleri durduruluyor...
taskkill /IM dotnet.exe /F 2>nul
taskkill /IM dotnet.dll /F 2>nul

echo [3/6] Node.js ve NPM processleri durduruluyor...
taskkill /IM node.exe /F 2>nul
taskkill /IM npm.cmd /F 2>nul
taskkill /IM npm /F 2>nul

echo [4/6] Web sunuculari durduruluyor...
taskkill /IM nginx.exe /F 2>nul
taskkill /IM httpd.exe /F 2>nul
taskkill /IM apache.exe /F 2>nul

echo [5/6] Diger gelistirme ortamlari durduruluyor...
taskkill /IM java.exe /F 2>nul
taskkill /IM javaw.exe /F 2>nul
taskkill /IM python.exe /F 2>nul
taskkill /IM pythonw.exe /F 2>nul
taskkill /IM php.exe /F 2>nul
taskkill /IM php-cgi.exe /F 2>nul

echo [6/6] Terminal processleri temizleniyor...
:: VS Code terminalleri
taskkill /FI "WINDOWTITLE eq *VS Code*" /IM cmd.exe /F 2>nul
taskkill /FI "WINDOWTITLE eq *PowerShell*" /IM powershell.exe /F 2>nul

echo.
echo ====================================================
echo TUM GELISTIRME PROCESSLERI DURDURULDU!
echo ====================================================
echo.
echo NOT: Bazi processler hala calisiyorsa, sistemi yeniden
echo      baslatmayi deneyin veya Task Manager'dan manuel 
echo      olarak kapatabilirsiniz.
echo.
pause
