# ============================================================
#  MavisReminder.ps1
#  Single entry point. Detects phone, runs a tiny local server,
#  opens browser. User just clicks around — no JSON, no manual
#  file moves, no separate push step.
#
#  Usage:
#    .\MavisReminder.ps1
#    .\MavisReminder.ps1 -Port 8765
#    .\MavisReminder.ps1 -NoBrowser
# ============================================================

[CmdletBinding()]
param(
    [int]$Port = 8765,
    [string]$AdbPath = "D:\leidian\LDPlayer14\adb.exe",
    [string]$Aapt2Path = "C:\Program Files (x86)\Android\android-sdk\build-tools\36.0.0\aapt2.exe",
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ====== Paths ======
$PROJECT_DIR    = $PSScriptRoot
$APK_CACHE      = Join-Path $PROJECT_DIR "_apk_cache"
$CONFIG_LOCAL   = Join-Path $PROJECT_DIR "apps.json"
$CONFIG_REMOTE  = "/sdcard/MavisReminder/apps.json"
$HTML_TEMPLATE  = Join-Path $PROJECT_DIR "MavisReminder.template.html"

if (-not (Test-Path $APK_CACHE)) { New-Item -ItemType Directory -Path $APK_CACHE | Out-Null }

# ====== Helpers ======
function Log([string]$msg, [string]$color = "White") {
    Write-Host $msg -ForegroundColor $color
}

function Send-JsonResp($response, $obj, [int]$status = 200) {
    $response.StatusCode = $status
    $response.ContentType = 'application/json; charset=utf-8'
    $response.Headers.Add('Access-Control-Allow-Origin', '*')
    $body = ($obj | ConvertTo-Json -Depth 10 -Compress)
    $buf = [System.Text.Encoding]::UTF8.GetBytes($body)
    $response.ContentLength64 = $buf.Length
    $response.OutputStream.Write($buf, 0, $buf.Length)
}

function Send-FileResp($response, $path) {
    if (-not (Test-Path $path)) {
        $response.StatusCode = 404
        return
    }
    $response.StatusCode = 200
    $response.ContentType = 'text/html; charset=utf-8'
    $buf = [System.IO.File]::ReadAllBytes($path)
    $response.ContentLength64 = $buf.Length
    $response.OutputStream.Write($buf, 0, $buf.Length)
}

function Read-Body($request) {
    if ($request.HasEntityBody) {
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    }
    return ""
}

# ====== adb helpers ======

# Get the first connected + authorized device, or report status
function Get-DeviceStatus {
    $raw = (& $AdbPath devices 2>&1) -join "`n"

    $lines = $raw -split "`n"
    $unauthorized = @()
    $offline = @()
    $online = @()

    foreach ($line in $lines) {
        $line = $line.Trim()
        if ($line -match "^(.+?)\s+device\s*$") {
            $online += $matches[1].Trim()
        } elseif ($line -match "^(.+?)\s+unauthorized") {
            $unauthorized += $matches[1].Trim()
        } elseif ($line -match "^(.+?)\s+offline") {
            $offline += $matches[1].Trim()
        }
    }

    if ($online.Count -gt 0) {
        $serial = $online[0]
        # Get device model
        $modelRaw = (& $AdbPath -s $serial shell "getprop ro.product.model" 2>&1) -join "`n"
        $model = $modelRaw.Trim() -split "`n" | Select-Object -First 1
        return @{
            status  = "connected"
            device  = $serial
            model   = $model
        }
    }
    if ($unauthorized.Count -gt 0) {
        return @{
            status  = "unauthorized"
            device  = $unauthorized[0]
        }
    }
    if ($offline.Count -gt 0) {
        return @{
            status  = "offline"
            device  = $offline[0]
        }
    }
    return @{ status = "no_device" }
}

# Pull the 3rd-party package list
function Get-Apps {
    param([string]$Device)
    $pkgFlag = "-3"
    $raw = (& $AdbPath -s $Device shell "pm list packages $pkgFlag" 2>&1) -join "`n"
    $pkgs = @()
    foreach ($line in $raw -split "`n") {
        $line = $line.Trim()
        if ($line -match "package:(.+)") {
            $pkgs += $matches[1].Trim()
        }
    }

    $apps = [System.Collections.Generic.List[object]]::new()
    $total = $pkgs.Count
    $idx = 0
    foreach ($pkg in $pkgs) {
        $idx++
        $pct = [math]::Floor($idx * 100 / $total)
        Write-Host -NoNewline ("`r    [{0}%] {1}/{2}  {3}                    " -f $pct, $idx, $total, $pkg) -ForegroundColor Gray

        $apkPathRaw = (& $AdbPath -s $Device shell "pm path $pkg" 2>&1) -join "`n"
        if ($apkPathRaw -notmatch "package:(.+)") { continue }
        $apkOnDevice = $matches[1].Trim()

        $safePkg = $pkg -replace '[^a-zA-Z0-9._-]', '_'
        $apkLocal = Join-Path $APK_CACHE "$safePkg.apk"

        if (-not (Test-Path $apkLocal)) {
            & $AdbPath -s $Device pull $apkOnDevice $apkLocal 2>&1 | Out-Null
        }

        $name = $null
        if (Test-Path $apkLocal) {
            $badging = (cmd /c "chcp 65001 >NUL & `"$Aapt2Path`" dump badging `"$apkLocal`" 2>&1") -join "`n"
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
        if (-not $name) {
            $dumpsys = (& $AdbPath -s $Device shell "dumpsys package $pkg" 2>&1) -join "`n"
            $m = [regex]::Match($dumpsys, "applicationLabel[=:](.+)")
            if ($m.Success) {
                $name = $m.Groups[1].Value.Trim() -replace "`r?`n.*$", ""
            }
        }
        if (-not $name) { $name = $pkg.Split('.')[-1] }

        $apps.Add([PSCustomObject]@{ pkg = $pkg; name = $name })
    }
    Write-Host "`r    [100%] Done                                          " -ForegroundColor Gray

    $sorted = $apps | Sort-Object -Property @{Expression={$_.name.ToLower()}}
    return $sorted
}

# Save apps.json locally + push to device
function Save-AndPush {
    param([string]$Device, $Apps)

    $jsonText = $Apps | ConvertTo-Json -Depth 10
    $wrapper = @{ apps = $Apps; updated = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() } | ConvertTo-Json -Depth 10
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($CONFIG_LOCAL, $wrapper, $utf8NoBom)

    & $AdbPath -s $Device shell "mkdir -p /sdcard/MavisReminder" 2>&1 | Out-Null
    $pushOut = (& $AdbPath -s $Device push $CONFIG_LOCAL $CONFIG_REMOTE 2>&1) -join "`n"
    if ($pushOut -notmatch "pushed") {
        return @{ ok = $false; error = "推送失败：$pushOut" }
    }

    $count = if ($Apps) { @($Apps).Count } else { 0 }
    Log "    -> pushed $count apps to $Device" "Gray"
    return @{ ok = $true; count = $count }
}

# Send a test notification via adb (works on Android 8+)
function Send-TestNotification {
    param([string]$Device)
    $cmd = "cmd notification post -t 'MavisReminder 测试' MavisTest '通知系统工作正常 ✓ 看到这条说明能正常提醒'"
    $out = (& $AdbPath -s $Device shell $cmd 2>&1) -join "`n"
    if ($out -match "Permission Denial|Error occurred") {
        return @{ ok = $false; error = $out.Trim() }
    }
    return @{ ok = $true }
}

# ====== Sanity ======
if (-not (Test-Path $AdbPath))    { throw "adb not found: $AdbPath" }
if (-not (Test-Path $Aapt2Path))  { throw "aapt2 not found: $Aapt2Path" }
if (-not (Test-Path $HTML_TEMPLATE)) { throw "HTML template not found: $HTML_TEMPLATE" }

Log "" "Cyan"
Log "==========================================" "Cyan"
Log "  MavisReminder  - APP 打卡提醒助手" "Cyan"
Log "==========================================" "Cyan"
Log "  按 Ctrl+C 退出" "Gray"
Log "==========================================" "Cyan"
Log "" "White"

# ====== Start HTTP server ======
# Try the requested port; if taken, try a few nearby ports before giving up
$listener = $null
$actualPort = 0
$portsToTry = @($Port) + (8766..8770 | Where-Object { $_ -ne $Port }) + (9876..9880) + (7776..7780)
foreach ($p in $portsToTry) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    try {
        $l.Start()
        $listener = $l
        $actualPort = $p
        break
    } catch {
        $l.Close()
    }
}
if (-not $listener) {
    Log "[X] 所有候选端口都被占：$($portsToTry -join ', ')" "Red"
    Log "    试试别的端口：.\MavisReminder.ps1 -Port 9999" "Yellow"
    exit 1
}
$Port = $actualPort
Log "  端口: $Port" "Gray"

Log "[OK] 服务已启动 → http://localhost:$Port/" "Green"

# Open browser
if (-not $NoBrowser) {
    Start-Sleep -Milliseconds 200
    Start-Process "http://localhost:$Port/"
}

# ====== Main loop ======
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $path = $request.Url.AbsolutePath

            switch -Wildcard ($path) {
                '/' {
                    Send-FileResp $response $HTML_TEMPLATE
                }
                '/api/status' {
                    $status = Get-DeviceStatus
                    Send-JsonResp $response $status
                }
                '/api/apps' {
                    $st = Get-DeviceStatus
                    if ($st.status -ne 'connected') {
                        Send-JsonResp $response @{ error = "设备未连接" } 400
                    } else {
                        try {
                            Log "[扫描] 拉取 APP 列表..." "Yellow"
                            $apps = Get-Apps -Device $st.device
                            Log "    -> $($apps.Count) apps" "Gray"
                            Send-JsonResp $response @{ apps = $apps }
                        } catch {
                            Log "    [X] $($_.Exception.Message)" "Red"
                            Send-JsonResp $response @{ error = $_.Exception.Message } 500
                        }
                    }
                }
                '/api/save' {
                    if ($request.HttpMethod -ne 'POST') {
                        Send-JsonResp $response @{ error = "POST only" } 405
                        break
                    }
                    $st = Get-DeviceStatus
                    if ($st.status -ne 'connected') {
                        Send-JsonResp $response @{ ok = $false; error = "设备未连接" } 400
                        break
                    }
                    try {
                        $body = Read-Body $request
                        $payload = $body | ConvertFrom-Json
                        $apps = @($payload.apps)
                        if ($apps.Count -eq 0) {
                            Send-JsonResp $response @{ ok = $false; error = "没选 APP" } 400
                            break
                        }
                        Log "[保存] 推 $($apps.Count) 个 APP 到 $($st.device)..." "Yellow"
                        $result = Save-AndPush -Device $st.device -Apps $apps
                        Send-JsonResp $response $result
                    } catch {
                        Log "    [X] $($_.Exception.Message)" "Red"
                        Send-JsonResp $response @{ ok = $false; error = $_.Exception.Message } 500
                    }
                }
                '/api/test' {
                    if ($request.HttpMethod -ne 'POST') {
                        Send-JsonResp $response @{ error = "POST only" } 405
                        break
                    }
                    $st = Get-DeviceStatus
                    if ($st.status -ne 'connected') {
                        Send-JsonResp $response @{ ok = $false; error = "设备未连接" } 400
                        break
                    }
                    Log "[测试] 发测试通知..." "Yellow"
                    $result = Send-TestNotification -Device $st.device
                    Send-JsonResp $response $result
                }
                default {
                    $response.StatusCode = 404
                }
            }
        } catch {
            Log "[X] 处理请求出错：$($_.Exception.Message)" "Red"
        } finally {
            try { $response.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Log "" "Yellow"
    Log "服务已关闭。再见！" "Yellow"
}
