@echo off
echo ========================================
echo Creating Distribution Package
echo ========================================
echo.

REM Create distribution folder
if exist "distribution" rmdir /s /q "distribution"
mkdir "distribution"

echo Copying unpacked application...
xcopy "dist\win-unpacked" "distribution" /E /I /Y

echo.
echo Copying configuration template...
copy ".env.example" "distribution\.env.example"

echo.
echo Creating USER_GUIDE.txt...
(
echo ========================================
echo KOMPANERO TRACKING - QUICK START
echo ========================================
echo.
echo 1. Copy .env.example to .env
echo 2. Edit .env with your Shopify credentials:
echo    - SHOPIFY_STORE_URL=your-store.myshopify.com
echo    - SHOPIFY_ACCESS_TOKEN=shpat_your_token_here
echo.
echo 3. Run "Kompanero Tracking.exe"
echo.
echo ========================================
echo.
echo IMPORTANT: The .env file must be in the same folder as the .exe file!
echo.
) > "distribution\README.txt"

echo.
echo ========================================
echo Distribution package created!
echo ========================================
echo.
echo Location: distribution\
echo.
echo Contents:
dir /b "distribution"
echo.
echo Next steps:
echo 1. Go to distribution\ folder
echo 2. Copy .env.example to .env
echo 3. Edit .env with your Shopify credentials
echo 4. Run "Kompanero Tracking.exe"
echo.
pause
