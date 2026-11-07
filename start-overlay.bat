@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not defined OVERLAY_LANG set "OVERLAY_LANG=en"

if exist "config.json" goto :after_config
copy "config.example.json" "config.json" >nul
if /i not "%OVERLAY_LANG%"=="zh" goto :config_created_en
set "MESSAGE=未检测到 config.json，已自动从 config.example.json 创建默认配置。"
call :say
goto :config_created_done
:config_created_en
echo config.json not found. Created a default copy from config.example.json.
:config_created_done
echo.

:after_config
if "%~1"=="--check" (
  echo start-overlay ok
  exit /b 0
)

echo.
echo ================================================
if /i "%OVERLAY_LANG%"=="zh" goto :banner_zh
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
echo Visual config editor:
echo  http://127.0.0.1:5173/config
echo  or run "open-config-editor.bat"
echo.
echo For other settings, run "configure.bat"
goto :after_banner

:banner_zh
set "MESSAGE=  OOPZ OBS 语音叠加层"
call :say
echo ================================================
echo.
set "MESSAGE=请确认："
call :say
set "MESSAGE= 1. OOPZ 客户端已运行"
call :say
set "MESSAGE= 2. OOPZ 自带屏幕覆盖功能已开启"
call :say
echo.
set "MESSAGE=启动后，在 OBS 浏览器源中使用此地址："
call :say
echo  http://127.0.0.1:5173/overlay
echo.
set "MESSAGE=可视化配置编辑器："
call :say
echo  http://127.0.0.1:5173/config
set "MESSAGE=或运行「打开配置编辑器.bat」"
call :say
echo.
set "MESSAGE=如需修改配置，也可运行「配置设置.bat」"
call :say

:after_banner
echo.

call "%~dp0scripts\ensure-python.bat"
if errorlevel 1 goto :python_missing

"%PYTHON_EXE%" ".\backend\app.py"
set "PYEXIT=%ERRORLEVEL%"

echo.
if not "%PYEXIT%"=="0" goto :start_failed
if /i "%OVERLAY_LANG%"=="zh" goto :stopped_zh
echo Server stopped.
goto :stopped_pause
:stopped_zh
set "MESSAGE=服务已停止。"
call :say
goto :stopped_pause

:start_failed
if /i "%OVERLAY_LANG%"=="zh" goto :start_failed_zh
echo Startup failed with exit code %PYEXIT%. See the error above.
goto :stopped_pause
:start_failed_zh
set "MESSAGE=启动失败，退出码 %PYEXIT%。请查看上面的报错。"
call :say

:stopped_pause
echo.
pause
exit /b 0

:python_missing
echo.
if /i not "%OVERLAY_LANG%"=="zh" goto :python_missing_en
set "MESSAGE=未检测到可用的 Python。"
call :say
set "MESSAGE=请先启动「安装依赖.bat」。"
call :say
echo.
pause
exit /b 1

:python_missing_en
echo Python was not found.
echo Run install-requirements.bat first.
echo.
pause
exit /b 1

:say
setlocal EnableDelayedExpansion
<nul set /p "=!MESSAGE!"
echo(
endlocal
exit /b 0
