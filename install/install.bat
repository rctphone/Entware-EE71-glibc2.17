@echo off
REM install.bat — Install opkg on EE71 via ADB (Windows)
REM
REM Usage: install.bat
REM
REM Requires: adb.exe in PATH (Android Platform Tools)
REM Download: https://developer.android.com/tools/releases/platform-tools

setlocal

set REPO=https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71
set SETUP_URL=%REPO%/install/setup.sh

echo === EE71 opkg installer ===
echo.

REM Check ADB
where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR] adb.exe not found.
    echo.
    echo Download Android Platform Tools:
    echo   https://developer.android.com/tools/releases/platform-tools
    echo.
    echo Extract and add to PATH, or run from the extracted folder.
    exit /b 1
)

REM Check device
adb devices | findstr /C:"device" | findstr /V /C:"List" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR] No device found.
    echo.
    echo 1. Connect EE71 via USB
    echo 2. Enable ADB (hold Reset 10s for recovery, or use tcl_switch_usb.py)
    echo 3. Run: adb devices
    exit /b 1
)

echo [*] Device found

REM Download setup script
echo [*] Downloading setup script...
set TMP=%TEMP%\ee71-install
mkdir "%TMP%" 2>nul
curl -sL "%SETUP_URL%" -o "%TMP%\setup.sh"
if %errorlevel% neq 0 (
    echo [ERR] Download failed. Check internet connection.
    exit /b 1
)

REM Push and run
echo [*] Pushing to device...
adb push "%TMP%\setup.sh" /tmp/setup.sh

echo [*] Running setup on device...
echo.
adb shell "sh /tmp/setup.sh"

echo.
echo [*] Done!
echo.
echo Connect to device:
echo   adb shell
echo.
echo Install packages:
echo   opkg update
echo   opkg install dropbear curl iperf3

REM Cleanup
del /q "%TMP%\setup.sh" 2>nul
rmdir "%TMP%" 2>nul

endlocal
