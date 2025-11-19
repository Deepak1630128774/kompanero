@echo off
echo ========================================
echo    Kompanero Tracking Dashboard
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    echo.
    call npm install
    echo.
)

echo Starting Electron Desktop App...
echo.
echo ========================================
echo.

npm run electron

pause
