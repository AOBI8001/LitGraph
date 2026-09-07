@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -Command "try { Invoke-WebRequest 'http://127.0.0.1:4320/' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel% equ 0 goto open_browser

for /f "delims=" %%I in ('where node 2^>nul') do if not defined LITGRAPH_NODE set "LITGRAPH_NODE=%%I"

if not exist "%LITGRAPH_NODE%" (
  echo Node.js was not found. Please install Node.js 22 or newer.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run pnpm install first.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo The LitGraph build is missing. Run pnpm build first.
  pause
  exit /b 1
)

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%LITGRAPH_NODE%' -ArgumentList 'node_modules\vite\bin\vite.js','preview','--host','127.0.0.1','--port','4320' -WorkingDirectory '%CD%' -WindowStyle Hidden"
timeout /t 2 /nobreak >nul

:open_browser
start "" "http://127.0.0.1:4320/"
endlocal
