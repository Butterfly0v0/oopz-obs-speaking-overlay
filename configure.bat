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
if errorlevel 1 (
    echo.
    if /i "%OVERLAY_LANG%"=="zh" (
        echo 未检测到可用的 Python 3.10 或更高版本。
        echo 请先运行「安装依赖.bat」完成安装。
    ) else (
        echo Python 3.10 or newer is not available.
        echo Run "install-requirements.bat" first.
    )
    echo.
    pause
    exit /b 1
)

"%PYTHON_EXE%" "%~dp0scripts\config_editor.py"
set "PYEXIT=%errorlevel%"
exit /b %PYEXIT%