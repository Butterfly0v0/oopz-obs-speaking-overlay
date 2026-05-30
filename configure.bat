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

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Python not found. Please install Python and add it to PATH.
    pause
    exit /b 1
)

python "%~dp0scripts\config_editor.py"
set "PYEXIT=%errorlevel%"
exit /b %PYEXIT%