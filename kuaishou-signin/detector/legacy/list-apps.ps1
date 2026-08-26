# ============================================================
#  list-apps.ps1
#  Auto-detect installed 3rd-party apps from device, extract
#  their display names (aapt2 > dumpsys > pkg fallback), and
#  generate a clean HTML picker for the user to choose which
#  apps to monitor.
#
#  Usage:
#    .\list-apps.ps1                       # default: LDPlayer 14 emulator
#    .\list-apps.ps1 -Device 127.0.0.1:5555
#    .\list-apps.ps1 -Device <serial>      # any adb-connected device
#    .\list-apps.ps1 -NoBrowser            # don't auto-open the browser
#    .\list-apps.ps1 -IncludeSystem        # include system apps too
# ============================================================

[CmdletBinding()]
param(
    [string]$Device = "127.0.0.1:5555",
    [string]$AdbPath = "D:\leidian\LDPlayer14\adb.exe",
    [string]$Aapt2Path = "C:\Program Files (x86)\Android\android-sdk\build-tools\36.0.0\aapt2.exe",
    [switch]$NoBrowser,
    [switch]$IncludeSystem,
    [switch]$ListDevices,
    [switch]$SkipApkCache    # don't pull APKs (faster but no app names)
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Paths
$PROJECT_DIR    = $PSScriptRoot
$APK_CACHE      = Join-Path $PROJECT_DIR "_apk_cache"
$HTML_PATH      = Join-Path $PROJECT_DIR "app-picker.html"
$LIST_JSON      = Join-Path $PROJECT_DIR "apps_list.json"
$TEMPLATE_PATH  = Join-Path $PROJECT_DIR "app-picker.template.html"

if (-not (Test-Path $APK_CACHE)) { New-Item -ItemType Directory -Path $APK_CACHE | Out-Null }

function Log([string]$msg, [string]$color = "White") {
    Write-Host $msg -ForegroundColor $color
}

# --- Sanity checks ---
if (-not (Test-Path $AdbPath))    { throw "adb not found: $AdbPath" }
if (-not (Test-Path $Aapt2Path))  { throw "aapt2 not found: $Aapt2Path" }
if (-not (Test-Path $TEMPLATE_PATH)) { throw "HTML template not found: $TEMPLATE_PATH" }

# --- List devices mode ---
if ($ListDevices) {
    Log "Connected devices:" "Cyan"
    & $AdbPath devices -l 2>&1 | ForEach-Object { Log "    $_" "Gray" }
    Log "" "Cyan"
    Log "To scan a specific device, use: -Device <serial>" "Cyan"
    exit 0
}

Log "==========================================" "Cyan"
Log "  APP List & Picker (auto-detect)" "Cyan"
Log "  Device: $Device" "Gray"
Log "==========================================" "Cyan"

# --- 1. Connect adb ---
Log "[1/5] Connecting adb..." "Green"
& $AdbPath connect $Device 2>&1 | Out-Null
$state = & $AdbPath -s $Device get-state 2>&1
if ($state -ne "device") {
    Log "[X] Device not online: $state" "Red"
    Log "    Try: adb connect $Device" "Yellow"
    exit 1
}

# --- 2. List packages ---
Log "[2/5] Listing packages..." "Green"
$pkgFlag = if ($IncludeSystem) { "" } else { "-3" }
$raw = (& $AdbPath -s $Device shell "pm list packages $pkgFlag" 2>&1) -join "`n"
$pkgs = @()
foreach ($line in $raw -split "`n") {
    $line = $line.Trim()
    if ($line -match "package:(.+)") {
        $pkgs += $matches[1].Trim()
    }
}
Log "    Found $($pkgs.Count) apps" "Gray"

# --- 3. For each package: get APK path, pull, extract name ---
Log "[3/5] Building app info (pulling APKs to cache)..." "Green"

$apps = [System.Collections.Generic.List[object]]::new()
$total = $pkgs.Count
$idx = 0
foreach ($pkg in $pkgs) {
    $idx++
    $pct = [math]::Floor($idx * 100 / $total)
    Write-Host -NoNewline ("`r    [{0}%] {1}/{2}  {3}                    " -f $pct, $idx, $total, $pkg) -ForegroundColor Gray

    # Get APK path on device (collapse to a single string so -match works)
    $apkPathRaw = (& $AdbPath -s $Device shell "pm path $pkg" 2>&1) -join "`n"
    if ($apkPathRaw -notmatch "package:(.+)") { continue }
    $apkOnDevice = $matches[1].Trim()

    # Local cached APK path (use a sanitized name)
    $safePkg = $pkg -replace '[^a-zA-Z0-9._-]', '_'
    $apkLocal = Join-Path $APK_CACHE "$safePkg.apk"

    # Pull if not cached (unless -SkipApkCache)
    $name = $null
    if (-not $SkipApkCache) {
        if (-not (Test-Path $apkLocal)) {
            & $AdbPath -s $Device pull $apkOnDevice $apkLocal 2>&1 | Out-Null
        }

        # Get app name via aapt2 (force UTF-8 codepage to avoid GBK mojibake on Chinese Windows)
        if (Test-Path $apkLocal) {
            $badging = (cmd /c "chcp 65001 >NUL & `"$Aapt2Path`" dump badging `"$apkLocal`" 2>&1") -join "`n"
            # Prefer zh-CN label, then any zh label, then default application-label
            foreach ($pattern in @(
                "application-label-zh-CN:'([^']+)'",
                "application-label-zh:'([^']+)'",
                "application-label:'([^']+)'"
            )) {
                if ($badging -match $pattern) {
                    $name = $matches[1]
                    break
                }
            }
        }
    }

    # Fallback: dumpsys (collapse multi-line output to single string for -match)
    if (-not $name) {
        $dumpsys = (& $AdbPath -s $Device shell "dumpsys package $pkg" 2>&1) -join "`n"
        foreach ($pattern in @(
            "applicationLabel[=:](.+)",
            "nonLocalizedLabel[=:](.+)"
        )) {
            $m = [regex]::Match($dumpsys, $pattern)
            if ($m.Success) {
                $candidate = $m.Groups[1].Value.Trim() -replace "`r?`n.*$", ""
                if ($candidate) { $name = $candidate; break }
            }
        }
    }

    # Final fallback: last segment of package name
    if (-not $name) {
        $name = $pkg.Split('.')[-1]
    }

    $apps.Add([PSCustomObject]@{
        pkg  = $pkg
        name = $name
    })
}
Write-Host "`r    [100%] Done                                          " -ForegroundColor Gray

# Sort by name (case-insensitive)
$apps = $apps | Sort-Object -Property @{Expression={$_.name.ToLower()}}

# --- 4. Save apps_list.json ---
Log "[4/5] Saving apps_list.json..." "Green"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$jsonText = $apps | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($LIST_JSON, $jsonText, $utf8NoBom)
Log "    $LIST_JSON  ($($apps.Count) apps)" "Gray"

# --- 5. Generate HTML from template ---
Log "[5/5] Generating app-picker.html..." "Green"

# Read template as UTF-8 (no BOM assumption) to avoid PowerShell here-string eating
# backticks and ${} in JavaScript template literals.
$templateBytes = [System.IO.File]::ReadAllBytes($TEMPLATE_PATH)
$templateText = [System.Text.Encoding]::UTF8.GetString($templateBytes)
$PLACEHOLDER = '___APPS_DATA_PLACEHOLDER___'
$html = $templateText.Replace($PLACEHOLDER, $jsonText)

[System.IO.File]::WriteAllText($HTML_PATH, $html, $utf8NoBom)
Log "    $HTML_PATH  ($([math]::Floor($html.Length / 1KB)) KB)" "Gray"

# Open browser
if (-not $NoBrowser) {
    Log "" "Green"
    Log "Opening picker in default browser..." "Cyan"
    Start-Process $HTML_PATH
}

Log "" "Green"
Log "==========================================" "Green"
Log "  Done! Found $($apps.Count) apps" "Green"
Log "==========================================" "Green"
Log "" "Cyan"
Log "Next:" "White"
Log "  1. Browser will show the picker (or open app-picker.html)" "Gray"
Log "  2. Tick apps to monitor" "Gray"
Log "  3. Click 'Save as apps.json' (or 'Copy JSON')" "Gray"
Log "  4. Save it to: $PROJECT_DIR\apps.json" "Gray"
Log "  5. Run: .\push-config.ps1" "Gray"
