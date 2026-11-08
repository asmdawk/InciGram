[CmdletBinding()]
param([switch]$PrepareLibraries)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if ($env:OS -ne 'Windows_NT') { throw 'Run this script on Windows x64.' }
foreach ($tool in @('python', 'git', 'cmake', 'cl.exe')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing $tool. Open an x64 Visual Studio developer PowerShell first."
    }
}
if (-not $env:INCIGRAM_API_ID -or $env:INCIGRAM_API_ID -notmatch '^\d+$' -or -not $env:INCIGRAM_API_HASH -or $env:INCIGRAM_API_HASH -notmatch '^[a-fA-F0-9]{32}$') {
    throw 'Set your own INCIGRAM_API_ID and INCIGRAM_API_HASH locally. Do not send them in chat.'
}
$patch = Join-Path $PSScriptRoot 'lib-ui.patch'
if (-not (Test-Path (Join-Path $repo 'Telegram/lib_ui/ui/colors.palette'))) {
    throw 'Missing submodules. Use the full source archive, or initialize the pinned submodules first.'
}
$palette = Join-Path $repo 'Telegram/lib_ui/ui/colors.palette'
if ((Get-FileHash $palette -Algorithm SHA256).Hash -ne 'A5C933231F84231A906D9DF948928FEF52E51233D6E509743F8F987287BBA842') {
    & git -C (Join-Path $repo 'Telegram/lib_ui') apply --check $patch
    if ($LASTEXITCODE -eq 0) {
        & git -C (Join-Path $repo 'Telegram/lib_ui') apply $patch
        if ($LASTEXITCODE -ne 0) { throw 'Unable to apply the InciGram palette patch.' }
    } else {
        & git -C (Join-Path $repo 'Telegram/lib_ui') apply --reverse --check $patch
        if ($LASTEXITCODE -ne 0) { throw 'Unexpected palette. Review local changes before applying the InciGram patch.' }
    }
}
Push-Location $repo
try {
    if ($PrepareLibraries) {
        & cmd.exe /c Telegram\build\prepare\win.bat skip-release
        if ($LASTEXITCODE -ne 0) { throw 'Dependency preparation failed.' }
    }
    Push-Location (Join-Path $repo 'Telegram')
    try {
        & cmd.exe /c configure.bat x64 -D "TDESKTOP_API_ID=$env:INCIGRAM_API_ID" -D "TDESKTOP_API_HASH=$env:INCIGRAM_API_HASH" -D DESKTOP_APP_DISABLE_AUTOUPDATE=ON -D DESKTOP_APP_DISABLE_CRASH_REPORTS=ON
        if ($LASTEXITCODE -ne 0) { throw 'Configuration failed.' }
    } finally { Pop-Location }
    & cmake --build out --config Debug --target Telegram
    if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
    $exe = Join-Path $repo 'out/Debug/InciGram.exe'
    if (-not (Test-Path $exe)) { throw 'Build finished but InciGram.exe was not found at the expected path.' }
    Write-Host "Built: $exe"
} finally { Pop-Location }
