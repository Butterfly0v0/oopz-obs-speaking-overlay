@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not defined OVERLAY_LANG set "OVERLAY_LANG=en"

if "%~1"=="--check" (
  echo install-requirements ok
  exit /b 0
)

echo.
echo ================================================
if /i "%OVERLAY_LANG%"=="zh" (
  echo   安装依赖
) else (
  echo   Install Requirements
)
echo ================================================
echo.

call "%~dp0scripts\ensure-python.bat" --install
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

if /i "%OVERLAY_LANG%"=="zh" (
  echo 正在安装 requirements.txt 中的依赖...
) else (
  echo Installing packages from requirements.txt...
)
"%PYTHON_EXE%" -m pip install -r ".\requirements.txt"
if errorlevel 1 (
  echo.
  if /i "%OVERLAY_LANG%"=="zh" (
    echo 安装失败，请查看上面的报错。
  ) else (
    echo Installation failed. Please check the error above.
  )
  pause
  exit /b 1
)

echo.
if /i "%OVERLAY_LANG%"=="zh" (
  echo 依赖已安装完成。
) else (
  echo Requirements installed successfully.
)
pause
