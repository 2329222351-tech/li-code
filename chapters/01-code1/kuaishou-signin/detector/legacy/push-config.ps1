# ============================================================
#  push-config.ps1
#  Push apps.json from PC to the device.
#  The detector script on the device (app-detector.js) reads this file.
#
#  Usage:
#    .\push-config.ps1                          # use first connected device + default apps.json
#    .\push-config.ps1 -Device <serial>         # target a specific device
#    .\push-config.ps1 -Source <path>           # use a different apps.json
#    .\push-config.ps1 -ListDevices             # show connected devices
# ============================================================

[CmdletBinding()]
param(
    [string]$Device,
    [string]$Source,
    [string]$AdbPath = "D:\leidian\LDPlayer14\adb.exe",
    [string]$RemoteDir = "/sdcard/MavisReminder",
    [switch]$ListDevices
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$PROJECT_DIR   = $PSScriptRoot
$DEFAULT_SOURCE = Join-Path $PROJECT_DIR "apps.json"

function Log([string]$msg, [string]$color = "White") {
    Write-Host $msg -ForegroundColor $color
}

if (-not (Test-Path $AdbPath)) { throw "adb not found: $AdbPath" }

# --- List devices mode ---
if ($ListDevices) {
    Log "Connected devices:" "Cyan"
    & $AdbPath devices -l 2>&1 | ForEach-Object { Log "    $_" "Gray" }
    exit 0
}

# --- Determine source file ---
if (-not $Source) { $Source = $DEFAULT_SOURCE }
if (-not (Test-Path $Source)) {
    Log "[X] Config not found: $Source" "Red"
    Log "    Run list-apps.ps1 first, then save your apps.json to:" "Yellow"
    Log "    $DEFAULT_SOURCE" "Yellow"
    exit 1
}

# --- Determine target device ---
if (-not $Device) {
    $devs = (& $AdbPath devices 2>&1) -join "`n"
    $online = @()
    foreach ($line in $devs -split "`n") {
        if ($line -match "^(.+?)\s+device\s*$") { $online += $matches[1].Trim() }
    }
    if ($online.Count -eq 0) {
        Log "[X] No device online" "Red"
        Log "    Run: adb connect <ip>:<port>" "Yellow"
        exit 1
    }
    if ($online.Count -gt 1) {
        Log "Multiple devices found:" "Yellow"
        $online | ForEach-Object { Log "    $_" "Gray" }
        Log "    Use -Device <serial> to pick one" "Yellow"
        exit 1
    }
    $Device = $online[0]
}

$RemotePath = "$RemoteDir/apps.json"

Log "==========================================" "Cyan"
Log "  Push apps.json" "Cyan"
Log "  Source: $Source" "Gray"
Log "  Device: $Device" "Gray"
Log "  Target: $RemotePath" "Gray"
Log "==========================================" "Cyan"

# --- Show what we're pushing ---
Log "" "Yellow"
Log "Config content:" "Yellow"
$content = Get-Content $Source -Raw -Encoding UTF8
Log "    $content" "Gray"

# Validate it's a parseable JSON
try {
    $parsed = $content | ConvertFrom-Json
    $count = if ($parsed.apps) { $parsed.apps.Count } else { 0 }
    Log "    -> $count apps to monitor" "Cyan"
} catch {
    Log "[X] apps.json is not valid JSON: $($_.Exception.Message)" "Red"
    exit 1
}

# --- Connect & verify device ---
Log "" "Yellow"
Log "Connecting adb..." "Yellow"
& $AdbPath connect $Device 2>&1 | Out-Null
$state = & $AdbPath -s $Device get-state 2>&1
if ($state -ne "device") {
    Log "[X] Device $Device not online" "Red"
    exit 1
}

# --- Push ---
Log "" "Yellow"
Log "Creating remote dir..." "Yellow"
& $AdbPath -s $Device shell "mkdir -p $RemoteDir" 2>&1 | Out-Null

Log "Pushing $Source -> $RemotePath ..." "Yellow"
$pushOut = & $AdbPath -s $Device push $Source $RemotePath 2>&1
$pushOut -join "`n" | ForEach-Object { Log "    $_" "Gray" }

# --- Verify ---
Log "" "Yellow"
Log "Verifying on device..." "Yellow"
$remote = (& $AdbPath -s $Device shell "cat $RemotePath" 2>&1) -join "`n"
$remote | ForEach-Object { Log "    $_" "Gray" }

# Sanity check: did the bytes really land?
if ($remote -match "package|pkg|apps") {
    Log "" "Green"
    Log "==========================================" "Green"
    Log "  OK! Pushed $count apps" "Green"
    Log "==========================================" "Green"
} else {
    Log "" "Red"
    Log "==========================================" "Red"
    Log "  [WARN] File may not have pushed correctly" "Red"
    Log "  Check device manually" "Red"
    Log "==========================================" "Red"
}
