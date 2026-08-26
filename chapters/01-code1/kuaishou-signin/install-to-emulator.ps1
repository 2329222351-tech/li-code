# ============================================================
#  install-to-emulator.ps1
#  Install AutoX.js APK to LDPlayer via adb
#  Run this AFTER you've downloaded the APK and renamed it
# ============================================================

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# === Config ===
$LD_BASE      = "D:\leidian\LDPlayer14"
$DOWNLOAD_DIR = "D:\gr\code1\kuaishou-signin\downloads"
$APK_NAME     = "autoxjs.apk"
$ADB_PORT     = "5555"

function Log($msg, $color = "White") {
    Write-Host $msg -ForegroundColor $color
}

function Step($n, $total, $msg) {
    Log "[$n/$total] $msg" "Green"
}

Log "==========================================" "Cyan"
Log "  AutoX.js Installer for LDPlayer" "Cyan"
Log "==========================================" "Cyan"

# === Check adb ===
$adbExe = Join-Path $LD_BASE "adb.exe"
if (-not (Test-Path $adbExe)) {
    Log "[X] adb.exe not found: $adbExe" "Red"
    Log "    Update `$LD_BASE to your LDPlayer path" "Yellow"
    exit 1
}

# === Check APK ===
$apkPath = Join-Path $DOWNLOAD_DIR $APK_NAME
if (-not (Test-Path $apkPath)) {
    Log "[!] autoxjs.apk not found, searching for any AutoX apk..." "Yellow"
    $found = Get-ChildItem $DOWNLOAD_DIR -Filter "*.apk" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "autox|autojs" } | Sort-Object LastWriteTime -Descending
    if ($found) {
        $apkPath = $found[0].FullName
        Log "    [OK] Found: $($found[0].Name)" "Green"
    } else {
        Log "" "Yellow"
        Log "[X] No AutoX APK found in $DOWNLOAD_DIR" "Yellow"
        Log "    Please download from:" "Yellow"
        Log "    - https://www.pczhi.com/soft/143213.html" "White"
        Log "    - https://www.jb51.net/softs/523496.html" "White"
        exit 1
    }
}

# === Check / start LDPlayer ===
$running = Get-Process -Name "dnplayer","ldconsole" -ErrorAction SilentlyContinue
if (-not $running) {
    Log "[!] LDPlayer not running, starting it..." "Yellow"
    $ldExe = Join-Path $LD_BASE "dnplayer.exe"
    if (-not (Test-Path $ldExe)) { $ldExe = Join-Path $LD_BASE "ldplayer.exe" }
    if (Test-Path $ldExe) {
        Start-Process $ldExe
        Log "    Waiting 15s for LDPlayer to boot..." "Yellow"
        Start-Sleep -Seconds 15
    } else {
        Log "[X] LDPlayer exe not found in $LD_BASE" "Red"
        Log "    Please start LDPlayer manually" "Red"
        exit 1
    }
}

# === Connect adb ===
Step 1 4 "Connecting adb..."
& $adbExe connect "127.0.0.1:$ADB_PORT" 2>&1 | Out-Null
Start-Sleep -Seconds 2

$deviceList = @()
$ports = @($ADB_PORT, "5556", "6555", "5557")
foreach ($p in $ports) {
    $result = & $adbExe connect "127.0.0.1:$p" 2>&1
    Start-Sleep -Milliseconds 500
    $d = & $adbExe devices 2>&1 | Select-String "127.0.0.1:$p"
    if ($d -and $d -notmatch "offline") {
        $deviceList += "127.0.0.1:$p"
        break
    }
}

if ($deviceList.Count -eq 0) {
    Log "[X] No adb device found. Tried ports: $($ports -join ', ')" "Red"
    exit 1
}
$device = $deviceList[0]
Log "    Found device: $device" "Green"

# === Install APK ===
Step 2 4 "Installing APK..."
Log "    This may take 30-60 seconds..." "Gray"
$installOutput = & $adbExe -s $device install -r -t -g $apkPath 2>&1
$installText = $installOutput -join "`n"
Log "    $installText" "Gray"

if ($installText -notmatch "Success") {
    Log "[X] Install failed" "Red"
    if ($installText -match "INSTALL_FAILED_VERSION_DOWNGRADE") {
        Log "    Need to uninstall old version first:" "Yellow"
        Log "    $adbExe -s $device uninstall org.autojs.autoxjs" "Yellow"
    } elseif ($installText -match "INSTALL_FAILED_INSUFFICIENT_STORAGE") {
        Log "    Not enough storage in emulator. Free up space." "Yellow"
    }
    exit 1
}

# === Verify ===
Step 3 4 "Verifying installation..."
$packages = & $adbExe -s $device shell pm list packages 2>&1
$autojsPackages = $packages | Select-String "autojs"
if ($autojsPackages) {
    Log "    [OK] Installed packages:" "Green"
    $autojsPackages | ForEach-Object { Log "         $_" "Gray" }
} else {
    Log "    [X] No autojs package found" "Red"
    exit 1
}

# === Launch ===
Step 4 4 "Launching AutoX.js..."
$launchOut = & $adbExe -s $device shell am start -W -n "org.autojs.autoxjs/org.autojs.autojs.ui.main.MainActivity" 2>&1
$launchText = $launchOut -join "`n"
Log "    $launchText" "Gray"
Start-Sleep -Seconds 3

Log "" "Green"
Log "==========================================" "Green"
Log "  Install Complete!" "Green"
Log "==========================================" "Green"
Log "" "Cyan"
Log "Next steps in the emulator:" "Cyan"
Log "  1. AutoX.js should be open now" "White"
Log "  2. In AutoX.js: Menu -> Settings -> Accessibility -> Enable" "White"
Log "  3. Push the explore script:" "White"
Log "     $adbExe -s $device push D:\gr\code1\kuaishou-signin\explore.js /sdcard/Download/" "Gray"
Log "  4. In AutoX.js, open /sdcard/Download/explore.js -> Run" "White"
Log "" "Cyan"
