@echo off
echo ============================================================
echo Starting Kompanero Tracking Desktop App
echo ============================================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting Electron app...
call npm run electron

pause
