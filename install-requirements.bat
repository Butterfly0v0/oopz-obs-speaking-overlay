@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if "%~1"=="--check" (
  echo install-requirements ok
  exit /b 0
)

echo.
echo ================================================
echo   Install Requirements
echo ================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found.
  echo Please install Python 3.10 or newer and enable "Add Python to PATH".
  echo.
  pause
  exit /b 1
)

echo Installing packages from requirements.txt...
python -m pip install -r ".\requirements.txt"
if errorlevel 1 (
  echo.
  echo Installation failed. Please check the error above.
  pause
  exit /b 1
)

echo.
echo Requirements installed successfully.
pause
