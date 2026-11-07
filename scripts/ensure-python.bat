@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM Locate a real Python 3.10+ executable, skipping the WindowsApps store alias.
REM On success, export PYTHON_EXE to the caller.
REM Pass --install to install Python 3.14 when it is missing.

call :find_python
if not errorlevel 1 goto :ready
if /i "%~1"=="--install" goto :do_install
if /i "%~1"=="--check" echo python not found
endlocal & exit /b 1

:do_install
call :install_python
if errorlevel 1 goto :install_exit_fail

:ready
set "PYTHON_VERSION=unknown"
"%PYTHON_EXE%" -c "import sys; print(sys.version.split()[0])" > "%TEMP%\oopz-python-version.txt" 2>nul
set /p PYTHON_VERSION=<"%TEMP%\oopz-python-version.txt"
del "%TEMP%\oopz-python-version.txt" >nul 2>&1
if /i "%OVERLAY_LANG%"=="zh" goto :ready_zh
echo Using Python %PYTHON_VERSION%
echo.
goto :ready_export
:ready_zh
set "MESSAGE=使用 Python %PYTHON_VERSION%"
call :say
echo.
:ready_export
endlocal & set "PYTHON_EXE=%PYTHON_EXE%" & exit /b 0

:install_exit_fail
endlocal & exit /b 1

:find_python
set "PYTHON_EXE="
call :scan_path
if not errorlevel 1 exit /b 0
call :scan_registry
if not errorlevel 1 exit /b 0
call :scan_root "%LocalAppData%\Programs\Python"
if not errorlevel 1 exit /b 0
call :scan_root "%ProgramFiles%"
if not errorlevel 1 exit /b 0
call :scan_root "%ProgramFiles(x86)%"
if not errorlevel 1 exit /b 0
call :scan_pythoncore
if not errorlevel 1 exit /b 0
if not exist "%SystemRoot%\py.exe" exit /b 1
call :try_py "%SystemRoot%\py.exe"
exit /b %errorlevel%

:scan_path
for /f "delims=" %%P in ('where python 2^>nul') do call :try_file "%%P" && exit /b 0
for /f "delims=" %%P in ('where python3 2^>nul') do call :try_file "%%P" && exit /b 0
exit /b 1

:scan_registry
for %%V in (3.15 3.14 3.13 3.12 3.11 3.10) do call :reg_both %%V && exit /b 0
exit /b 1

:reg_both
call :reg_python "HKCU\Software\Python\PythonCore\%~1\InstallPath" && exit /b 0
call :reg_python "HKLM\Software\Python\PythonCore\%~1\InstallPath" && exit /b 0
call :reg_python "HKCU\Software\Python\PythonCore\%~1-32\InstallPath" && exit /b 0
call :reg_python "HKLM\Software\Python\PythonCore\%~1-32\InstallPath" && exit /b 0
exit /b 1

:reg_python
set "REG_PATH="
for /f "tokens=2,*" %%A in ('reg query "%~1" /ve 2^>nul ^| findstr /i "REG_SZ"') do set "REG_PATH=%%B"
if not defined REG_PATH exit /b 1
set "LAST=%REG_PATH:~-1% "
if "%LAST%"=="\ " set "REG_PATH=%REG_PATH:~0,-1%"
call :try_file "%REG_PATH%\python.exe"
exit /b %errorlevel%

:scan_root
if "%~1"=="" exit /b 1
call :scan_one "%~1" 315 && exit /b 0
call :scan_one "%~1" 314 && exit /b 0
call :scan_one "%~1" 313 && exit /b 0
call :scan_one "%~1" 312 && exit /b 0
call :scan_one "%~1" 311 && exit /b 0
call :scan_one "%~1" 310 && exit /b 0
exit /b 1

:scan_one
call :try_file "%~1\Python%~2\python.exe" && exit /b 0
call :try_file "%~1\Python%~2-64\python.exe" && exit /b 0
call :try_file "%~1\Python%~2-32\python.exe" && exit /b 0
exit /b 1

:scan_pythoncore
call :try_file "%LocalAppData%\Python\pythoncore-3.15-64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.14-64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.13-64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.12-64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.11-64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.10-64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.15-arm64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.14-arm64\python.exe" && exit /b 0
call :try_file "%LocalAppData%\Python\pythoncore-3.13-arm64\python.exe" && exit /b 0
exit /b 1

:try_py
"%~1" -3 -c "import sys; print(sys.executable)" > "%TEMP%\oopz-python-path.txt" 2>nul
if errorlevel 1 exit /b 1
set "PY_EXE="
set /p PY_EXE=<"%TEMP%\oopz-python-path.txt"
del "%TEMP%\oopz-python-path.txt" >nul 2>&1
if not defined PY_EXE exit /b 1
call :try_file "%PY_EXE%"
exit /b %errorlevel%

:try_file
if "%~1"=="" exit /b 1
if not exist "%~1" exit /b 1
call :is_store_alias "%~1"
if not errorlevel 1 exit /b 1
"%~1" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 exit /b 1
set "PYTHON_EXE=%~1"
exit /b 0

:is_store_alias
set "ALIAS=%~nx1"
set "ALIASDIR=%~dp1"
if /i not "%ALIASDIR:~-13%"=="\WindowsApps\" exit /b 1
if /i "%ALIAS%"=="python.exe" exit /b 0
if /i "%ALIAS%"=="python3.exe" exit /b 0
if /i "%ALIAS%"=="py.exe" exit /b 0
exit /b 1

:install_python
echo.
if /i "%OVERLAY_LANG%"=="zh" goto :install_msg_zh
echo Python 3.10 or newer is not available.
echo Downloading and installing Python 3.14 for the current user.
echo If an installer window appears, wait until it finishes. Do not cancel it.
goto :download_python

:install_msg_zh
set "MESSAGE=未检测到可用的 Python。"
call :say
set "MESSAGE=正在下载并安装 Python 3.14，只安装给当前用户。"
call :say
set "MESSAGE=如果出现安装窗口，请等待它结束，不要点取消。"
call :say

:download_python
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-python.ps1"
if errorlevel 1 goto :install_failed
call :find_python
if errorlevel 1 goto :install_failed
exit /b 0

:install_failed
echo.
if /i "%OVERLAY_LANG%"=="zh" goto :install_failed_zh
echo Automatic Python installation failed.
echo Install Python 3.10 or newer from the page below, and enable Add python.exe to PATH.
echo https://www.python.org/downloads/windows/
exit /b 1

:install_failed_zh
set "MESSAGE=自动安装 Python 失败。"
call :say
set "MESSAGE=请打开下面的页面，手动安装 Python 3.10 或更高版本。"
call :say
echo https://www.python.org/downloads/windows/
exit /b 1

:say
setlocal EnableDelayedExpansion
<nul set /p "=!MESSAGE!"
echo(
endlocal
exit /b 0
