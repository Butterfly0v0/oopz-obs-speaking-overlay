@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not exist "config.json" (
  copy "config.example.json" "config.json" >nul
  echo 未检测到 config.json，已自动从 config.example.json 创建默认配置。
  echo.
)

if "%~1"=="--check" (
  echo start-overlay ok
  exit /b 0
)

echo.
echo ================================================
echo   OOPZ OBS Speaking Overlay
echo ================================================
echo.
echo Please make sure:
echo  1. OOPZ is running
echo  2. OOPZ built-in screen overlay is enabled
echo.
echo After startup, use this URL in OBS Browser Source:
echo  http://127.0.0.1:5173/overlay
echo.
echo 如需修改配置，请运行 "配置设置.bat"
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found.
  echo Please install Python 3.10 or newer and enable "Add Python to PATH".
  echo.
  pause
  exit /b 1
)

python ".\backend\app.py"

echo.
echo Server stopped.
pause
