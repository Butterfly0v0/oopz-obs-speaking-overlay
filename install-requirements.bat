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
if /i "%OVERLAY_LANG%"=="zh" goto :banner_zh
echo   Install Requirements
goto :banner_done
:banner_zh
set "MESSAGE=  安装依赖"
call :say
:banner_done
echo ================================================
echo.

call "%~dp0scripts\ensure-python.bat" --install
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

if /i "%OVERLAY_LANG%"=="zh" goto :pip_zh
echo Installing packages from requirements.txt...
goto :pip_run
:pip_zh
set "MESSAGE=正在安装 requirements.txt 中的依赖..."
call :say
:pip_run
"%PYTHON_EXE%" -m pip install -r ".\requirements.txt"
if errorlevel 1 goto :pip_fail

echo.
if /i "%OVERLAY_LANG%"=="zh" goto :done_zh
echo Requirements installed successfully.
goto :done_pause
:done_zh
set "MESSAGE=依赖已安装完成。"
call :say
:done_pause
echo.
pause
exit /b 0

:pip_fail
echo.
if /i "%OVERLAY_LANG%"=="zh" goto :pip_fail_zh
echo Installation failed. Please check the error above.
goto :pip_fail_pause
:pip_fail_zh
set "MESSAGE=安装失败，请查看上面的报错。"
call :say
:pip_fail_pause
echo.
pause
exit /b 1

:say
setlocal EnableDelayedExpansion
<nul set /p "=!MESSAGE!"
echo(
endlocal
exit /b 0
