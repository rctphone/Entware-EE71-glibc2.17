@echo off
REM install.bat — Install opkg on EE71 via ADB (Windows)
REM
REM Usage: install.bat
REM
REM Downloads everything from GitHub on the host, pushes to device via ADB,
REM then runs setup on the device. Works in both normal and recovery mode.
REM
REM Requires: adb.exe in PATH (Android Platform Tools)
REM Download: https://developer.android.com/tools/releases/platform-tools

setlocal

set REPO=https://raw.githubusercontent.com/rctphone/Entware-EE71-glibc2.17/ee71
set OPKG_REPO=https://raw.githubusercontent.com/rctphone/ee71-opkg/main

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

REM Create temp dir
set TMP=%TEMP%\ee71-install
mkdir "%TMP%" 2>nul

REM Download all files on the host
echo [*] Downloading files from GitHub...
curl -sL "%REPO%/install/setup.sh" -o "%TMP%\setup.sh"
if %errorlevel% neq 0 (
    echo [ERR] Download failed. Check internet connection.
    exit /b 1
)

curl -sL "%OPKG_REPO%/Packages" -o "%TMP%\Packages"
curl -sL "%OPKG_REPO%/opkg-status" -o "%TMP%\opkg-status"
curl -sL "%REPO%/install/patch_usb_kernel" -o "%TMP%\patch_usb_kernel"

REM Find opkg filename from Packages index
for /f "tokens=2" %%a in ('findstr /B "Filename: opkg_" "%TMP%\Packages"') do set OPKG_FILE=%%a
if "%OPKG_FILE%"=="" (
    echo [ERR] opkg package not found in index
    exit /b 1
)

echo [*] Downloading %OPKG_FILE%...
curl -sL "%OPKG_REPO%/%OPKG_FILE%" -o "%TMP%\%OPKG_FILE%"

REM Push everything to device
echo [*] Pushing to device...
adb push "%TMP%\setup.sh" /tmp/setup.sh
adb push "%TMP%\Packages" /tmp/Packages
adb push "%TMP%\%OPKG_FILE%" /tmp/%OPKG_FILE%
adb push "%TMP%\opkg-status" /tmp/opkg-status
adb push "%TMP%\patch_usb_kernel" /tmp/patch_usb_kernel

REM Run setup on device
echo [*] Running setup on device...
echo.
adb shell "sh /tmp/setup.sh"

echo.
echo [*] Done!
echo.
echo Connect to device:
echo   adb shell                (USB)
echo   ssh root@device-ip       (after installing Dropbear SSH)
echo.
echo Install packages:
echo   opkg update
echo   opkg install dropbear curl iperf3

REM Cleanup
del /q "%TMP%\*" 2>nul
rmdir "%TMP%" 2>nul

endlocal
