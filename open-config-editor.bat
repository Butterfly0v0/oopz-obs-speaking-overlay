@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not exist "config.json" (
  if exist "config.example.json" (
    copy "config.example.json" "config.json" >nul
  )
)

echo.
echo ================================================
set "MESSAGE=  OOPZ Overlay 可视化配置编辑器"
call :say
echo ================================================
echo.
set "MESSAGE=请确保叠加层服务已启动（运行 start-overlay.bat）。"
call :say
set "MESSAGE=即将在浏览器中打开配置编辑器："
call :say
echo   http://127.0.0.1:5173/config
echo.

start "" "http://127.0.0.1:5173/config"
exit /b 0

:say
setlocal EnableDelayedExpansion
<nul set /p "=!MESSAGE!"
echo(
endlocal
exit /b 0
