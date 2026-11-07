@echo off
cd /d "%~dp0"
set "OVERLAY_LANG=zh"
call ".\install-requirements.bat" %*
