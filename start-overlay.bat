@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not defined OVERLAY_LANG set "OVERLAY_LANG=en"

if not exist "config.json" (
  copy "config.example.json" "config.json" >nul
  if /i "%OVERLAY_LANG%"=="zh" (
    echo 未检测到 config.json，已自动从 config.example.json 创建默认配置。
  ) else (
    echo config.json not found. Created a default copy from config.example.json.
  )
  echo.
)

if "%~1"=="--check" (
  echo start-overlay ok
  exit /b 0
)

echo.
echo ================================================
if /i "%OVERLAY_LANG%"=="zh" (
  echo   OOPZ OBS 语音叠加层
) else (
  echo   OOPZ OBS Speaking Overlay
)
echo ================================================
echo.
if /i "%OVERLAY_LANG%"=="zh" (
  echo 请确认：
  echo  1. OOPZ 客户端已运行
  echo  2. OOPZ 自带屏幕覆盖功能已开启
  echo.
  echo 启动后，在 OBS 浏览器源中使用此地址：
  echo  http://127.0.0.1:5173/overlay
  echo.
  echo 可视化配置编辑器：
  echo  http://127.0.0.1:5173/config
  echo  或运行「打开配置编辑器.bat」
  echo.
  echo 如需修改配置，也可运行「配置设置.bat」
) else (
  echo Please make sure:
  echo  1. OOPZ is running
  echo  2. OOPZ built-in screen overlay is enabled
  echo.
  echo After startup, use this URL in OBS Browser Source:
  echo  http://127.0.0.1:5173/overlay
  echo.
  echo Visual config editor:
  echo  http://127.0.0.1:5173/config
  echo  or run "open-config-editor.bat"
  echo.
  echo For other settings, run "configure.bat"
)
echo.

where python >nul 2>nul
if errorlevel 1 (
  if /i "%OVERLAY_LANG%"=="zh" (
    echo 未找到 Python。
    echo 请安装 Python 3.10 或更高版本，并勾选「Add Python to PATH」。
  ) else (
    echo Python was not found.
    echo Please install Python 3.10 or newer and enable "Add Python to PATH".
  )
  echo.
  pause
  exit /b 1
)

python ".\backend\app.py"

echo.
if /i "%OVERLAY_LANG%"=="zh" (
  echo 服务已停止。
) else (
  echo Server stopped.
)
pause
