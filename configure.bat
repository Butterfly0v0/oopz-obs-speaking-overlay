@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "config.json" (
    if exist "config.example.json" (
        copy "config.example.json" "config.json" >nul
        echo config.json created from config.example.json
    ) else (
        echo Error: config.json and config.example.json not found!
        pause
        exit /b 1
    )
)

call "%~dp0scripts\ensure-python.bat"
if errorlevel 1 goto :python_missing

"%PYTHON_EXE%" "%~dp0scripts\config_editor.py"
set "PYEXIT=%errorlevel%"
exit /b %PYEXIT%

:python_missing
echo.
if /i not "%OVERLAY_LANG%"=="zh" goto :python_missing_en
<nul set /p "=未检测到可用的 Python。"
echo(
<nul set /p "=请先启动「安装依赖.bat」。"
echo(
echo.
pause
exit /b 1

:python_missing_en
echo Python was not found.
echo Run install-requirements.bat first.
echo.
pause
exit /b 1