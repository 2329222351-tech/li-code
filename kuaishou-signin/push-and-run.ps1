# ============================================================
#  push-and-run.ps1
#  Push explore.js to LDPlayer and run it via AutoX.js
# ============================================================

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$LD_BASE = "D:\leidian\LDPlayer14"
$ADB_PORT = "5555"
$ADB = "127.0.0.1:$ADB_PORT"
$ADB_EXE = Join-Path $LD_BASE "adb.exe"
$PROJECT_DIR = "D:\gr\code1\kuaishou-signin"
$SCRIPTS = @("explore.js", "signin.js", "signin-smart.js")
$REMOTE_DIR = "/sdcard/Download/MavisScripts"

function Log($msg, $color = "White") {
    Write-Host $msg -ForegroundColor $color
}

Log "==========================================" "Cyan"
Log "  Push Scripts to LDPlayer" "Cyan"
Log "==========================================" "Cyan"

# Connect adb
Log "[1/3] Connecting adb..." "Green"
& $ADB_EXE connect $ADB 2>&1 | Out-Null
Start-Sleep -Seconds 1

# Check our device is online
$dev = & $ADB_EXE -s $ADB get-state 2>&1
if ($dev -ne "device") {
    Log "[X] Device $ADB not online. State: $dev" "Red"
    & $ADB_EXE devices 2>&1 | ForEach-Object { Log "    $_" "Gray" }
    exit 1
}
Log "    Device: $ADB (state=device)" "Gray"

# Create remote dir
Log "[2/3] Pushing scripts to $REMOTE_DIR..." "Green"
$out = & $ADB_EXE -s $ADB shell mkdir -p $REMOTE_DIR 2>&1
Log "    mkdir: $out" "Gray"

foreach ($script in $SCRIPTS) {
    $local = Join-Path $PROJECT_DIR $script
    $remote = "$REMOTE_DIR/$script"
    if (Test-Path $local) {
        $out = & $ADB_EXE -s $ADB push $local $remote 2>&1
        Log "    [OK] $script -> $remote" "Gray"
    } else {
        Log "    [SKIP] $script (not found locally)" "Yellow"
    }
}

# Verify on device
Log "[3/3] Verifying files on device..." "Green"
$ls = & $ADB_EXE -s $ADB shell ls $REMOTE_DIR 2>&1
Log "    Remote files:" "Gray"
$ls | ForEach-Object { Log "      $_" "Gray" }

Log "" "Green"
Log "==========================================" "Green"
Log "  Push Complete!" "Green"
Log "==========================================" "Green"
Log "" "Cyan"
Log "Next steps in AutoX.js (already running in emulator):" "Cyan"
Log "  1. Tap the menu (top-left)" "White"
Log "  2. Tap 'Files' or 'Open' to browse scripts" "White"
Log "  3. Navigate to: /sdcard/Download/MavisScripts/" "White"
Log "  4. Tap 'explore.js'" "White"
Log "  5. Tap the play/run button" "White"
Log "" "Cyan"
Log "The script will auto-explore the Kuaishou app UI." "Cyan"
Log "When it finishes, come back and tell me." "Cyan"
Log "Logs and screenshots will be at: /sdcard/kuaishou-signin-logs/" "Cyan"
Log "" "Cyan"
