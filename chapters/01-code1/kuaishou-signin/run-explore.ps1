# ============================================================
#  run-explore.ps1
#  Try multiple ways to start explore.js in AutoX.js
# ============================================================

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ADB = "127.0.0.1:5555"
$ADB_EXE = "D:\leidian\LDPlayer14\adb.exe"
$SCRIPT_PATH = "/sdcard/Download/MavisScripts/explore.js"
$LOCAL_SCRIPT = "D:\gr\code1\kuaishou-signin\explore.js"

function Log($msg, $color = "White") {
    Write-Host $msg -ForegroundColor $color
}

function RunAdb($cmd) {
    try {
        $out = & $ADB_EXE -s $ADB $cmd 2>&1
        if ($out) { $out | ForEach-Object { Log "    $_" "Gray" } }
        return $true
    } catch {
        Log "    [WARN] $($_.Exception.Message)" "Yellow"
        return $false
    }
}

Log "==========================================" "Cyan"
Log "  Auto-Run explore.js in AutoX.js" "Cyan"
Log "==========================================" "Cyan"

# Connect adb
Log "[Setup] Connecting adb..." "Yellow"
RunAdb "connect $ADB" | Out-Null
Start-Sleep -Seconds 1

# Method 1: am start with path extra
Log "" "Yellow"
Log "[Method 1] am start with -e path..." "Yellow"
RunAdb "shell am start -n org.autojs.autoxjs/org.autojs.autojs.ui.main.SplashActivity -e path '$SCRIPT_PATH'"
Start-Sleep -Seconds 3

# Check if app is foregrounded
$top = RunAdb "shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | head -2"
Log "" "Gray"

# Method 2: broadcast to AutoX.js (legacy)
Log "[Method 2] broadcast intent..." "Yellow"
RunAdb "shell am broadcast -a org.autojs.autojs.action.execute -e path '$SCRIPT_PATH' -p org.autojs.autoxjs"
Start-Sleep -Seconds 2

# Method 3: copy to default script dir
Log "" "Yellow"
Log "[Method 3] Copy to /sdcard/脚本/ and restart AutoX.js..." "Yellow"
RunAdb "shell mkdir -p /sdcard/脚本"
RunAdb "push $LOCAL_SCRIPT /sdcard/脚本/explore.js"
RunAdb "shell am force-stop org.autojs.autoxjs"
Start-Sleep -Seconds 1
RunAdb "shell am start -n org.autojs.autoxjs/org.autojs.autojs.ui.main.SplashActivity"
Start-Sleep -Seconds 3

# Method 4: deeplink
Log "" "Yellow"
Log "[Method 4] deeplink..." "Yellow"
RunAdb "shell am start -a android.intent.action.VIEW -d 'autojs://run?path=$SCRIPT_PATH' org.autojs.autoxjs"
Start-Sleep -Seconds 2

Log "" "Green"
Log "==========================================" "Green"
Log "  Attempted all methods" "Green"
Log "==========================================" "Green"
Log "" "Cyan"
Log "What to do NOW in the emulator:" "Cyan"
Log "" "White"
Log "1. Look at the LDPlayer window" "White"
Log "2. AutoX.js should be in foreground now" "White"
Log "3. If you see a dialog asking to run a script -> tap RUN" "White"
Log "4. If you see the AutoX.js home screen, look for the explore.js file" "White"
Log "   - Check the home tab, projects tab, or file manager" "White"
Log "5. Take a SCREENSHOT of what you see and send it to me" "White"
Log "" "Cyan"
Log "I need to see the AutoX.js UI to know how to navigate it." "Cyan"
