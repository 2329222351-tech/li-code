// ============================================================
//  app-detector.js - 通用 APP 打卡检测器（Tasker JavaScriptlet）
//  用途：检测用户今天是否打开过指定 APP 列表里的任意一个
//        没打开过就通知
//  APP 列表来源：/sdcard/MavisReminder/apps.json
//                （由 PC 端工具或 AutoX.js UI 生成）
//  风险：0（不操作 APP，只查系统记录）
// ============================================================

// ====== 配置 ======
var CONFIG_PATH = "/sdcard/MavisReminder/apps.json";
var PREFS_NAME = "app_reminder";
var DEBOUNCE_MS = 4 * 60 * 60 * 1000;   // 4 小时去重

// ====== 读 APP 列表 ======
var configStr = "";
try {
    configStr = files.read(CONFIG_PATH);
} catch (e) {
    flash("读不到 " + CONFIG_PATH + ": " + e);
    setGlobal("APP_RESULT", "error");
    setGlobal("APP_ERROR", "no config file");
    exit();
}

if (!configStr || configStr.length === 0) {
    flash("配置文件为空");
    setGlobal("APP_RESULT", "error");
    setGlobal("APP_ERROR", "empty config");
    exit();
}

var config;
try {
    config = JSON.parse(configStr);
} catch (e) {
    flash("配置 JSON 解析失败: " + e);
    setGlobal("APP_RESULT", "error");
    setGlobal("APP_ERROR", "bad json: " + e);
    exit();
}

var APPS = config.apps || [];  // [{ name: "快手", pkg: "com.kuaishou.nebula" }, ...]

if (APPS.length === 0) {
    flash("配置里没 APP");
    setGlobal("APP_RESULT", "error");
    setGlobal("APP_ERROR", "no apps in config");
    exit();
}

setGlobal("APP_LIST", APPS.map(function(a) { return a.name; }).join(", "));

// ====== 拿到今天 0 点时间戳 ======
var now = java.lang.System.currentTimeMillis();
var cal = java.util.Calendar.getInstance();
cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
cal.set(java.util.Calendar.MINUTE, 0);
cal.set(java.util.Calendar.SECOND, 0);
cal.set(java.util.Calendar.MILLISECOND, 0);
var startOfToday = cal.getTimeInMillis();

// ====== 工具：用 shell 拿某个包的 lastUpdateTime ======
function getLastUpdate(pkg) {
    try {
        var sh = java.lang.Runtime.getRuntime().exec(["sh", "-c", "dumpsys package " + pkg + " | grep lastUpdateTime | head -1"]);
        var br = new java.io.BufferedReader(new java.io.InputStreamReader(sh.getInputStream()));
        var line = br.readLine();
        br.close();
        sh.waitFor();
        if (!line || line.indexOf("lastUpdateTime") < 0) return 0;
        var m = line.match(/lastUpdateTime=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        if (!m) return 0;
        return new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").parse(m[1]).getTime();
    } catch (e) {
        return 0;
    }
}

// ====== 检查每个 APP ======
var openedApps = [];      // 今天打开过的
var notOpenedApps = [];   // 今天没打开的

for (var i = 0; i < APPS.length; i++) {
    var app = APPS[i];
    var last = getLastUpdate(app.pkg);
    app.lastUsed = last;
    if (last >= startOfToday) {
        openedApps.push(app);
    } else {
        notOpenedApps.push(app);
    }
}

setGlobal("APP_OPENED_TODAY", openedApps.map(function(a) { return a.name; }).join(", "));
setGlobal("APP_NOT_OPENED_TODAY", notOpenedApps.map(function(a) { return a.name; }).join(", "));

// ====== 决策 ======
if (notOpenedApps.length === 0) {
    // 全部打开过
    setGlobal("APP_RESULT", "all_opened");
    setGlobal("APP_SHOULD_NOTIFY", "0");
    flash("所有 APP 今天都已打开 ✓");
} else {
    // 有没打开的
    setGlobal("APP_RESULT", "some_not_opened");

    // 去重：4 小时内只发一次
    var prefs = context.getSharedPreferences(PREFS_NAME, 0);
    var lastNotify = prefs.getLong("last_notify", 0);

    if (now - lastNotify > DEBOUNCE_MS) {
        prefs.edit().putLong("last_notify", now).apply();
        setGlobal("APP_SHOULD_NOTIFY", "1");
        setGlobal("APP_NOTIFY_LIST", notOpenedApps.map(function(a) { return a.name; }).join("、"));
        flash(notOpenedApps.length + " 个 APP 今天没打开，需要通知");
    } else {
        setGlobal("APP_SHOULD_NOTIFY", "0");
        setGlobal("APP_NOTIFY_LIST", notOpenedApps.map(function(a) { return a.name; }).join("、"));
        flash(notOpenedApps.length + " 个 APP 今天没打开，但 4h 内已提醒过");
    }
}

// ====== 跨天重置 ======
var prefs2 = context.getSharedPreferences(PREFS_NAME, 0);
var lastReset = prefs2.getLong("last_reset", 0);
if (now - lastReset > 24 * 60 * 60 * 1000) {
    prefs2.edit()
        .putLong("last_reset", now)
        .putLong("last_notify", 0)
        .apply();
}
