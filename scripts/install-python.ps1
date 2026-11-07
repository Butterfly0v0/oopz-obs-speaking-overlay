$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$arch = "amd64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") {
    $arch = "arm64"
} elseif ($env:PROCESSOR_ARCHITECTURE -eq "x86" -and [string]::IsNullOrEmpty($env:PROCESSOR_ARCHITEW6432)) {
    $arch = "win32"
}

$version = "3.14.10"
if ($arch -eq "win32") {
    $fileName = "python-$version.exe"
} else {
    $fileName = "python-$version-$arch.exe"
}

$url = "https://www.python.org/ftp/python/$version/$fileName"
$out = Join-Path $env:TEMP "oopz-$fileName"
$target = Join-Path $env:LOCALAPPDATA "Programs\Python\Python314"
$log = Join-Path $env:TEMP "oopz-python-install.log"

Write-Host "Download: $url"
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if ($curl) {
    & curl.exe -L --fail --retry 2 --output $out $url
    if ($LASTEXITCODE -ne 0) {
        throw "curl exited with $LASTEXITCODE"
    }
} else {
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}

Write-Host "Installing to $target"
$argLine = "/passive InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_test=0 Include_launcher=0 Shortcuts=0 TargetDir=`"$target`" /log `"$log`""
$proc = Start-Process -FilePath $out -ArgumentList $argLine -Wait -PassThru
if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
    Write-Host "Installer exit code: $($proc.ExitCode)"
    Write-Host "Log: $log"
    exit 1
}

Remove-Item -LiteralPath $out -Force -ErrorAction SilentlyContinue
exit 0
