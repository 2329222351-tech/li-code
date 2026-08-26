// ============================================================
//  ks-detector.js - 快手打卡检测器（Tasker JavaScriptlet）
//  用途：检测用户今天是否打开过快手，没开过则通知
//  原理：用 dumpsys package 拿快手包最后更新时间
//  风险：0（不操作快手，只查系统记录）
// ============================================================

// ====== 配置 ======
var PKG = "com.kuaishou.nebula";         // 快手极速版包名
var DEBOUNCE_MS = 4 * 60 * 60 * 1000;   // 4 小时去重
var PREFS_NAME = "kuaishou_reminder";

// ====== 拿到今天 0 点时间戳 ======
var now = java.lang.System.currentTimeMillis();
var cal = java.util.Calendar.getInstance();
cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
cal.set(java.util.Calendar.MINUTE, 0);
cal.set(java.util.Calendar.SECOND, 0);
cal.set(java.util.Calendar.MILLISECOND, 0);
var startOfToday = cal.getTimeInMillis();

// ====== 用 shell 拿快手 lastUpdateTime ======
// dumpsys package 不需要任何权限
var shell;
try {
    shell = java.lang.Runtime.getRuntime().exec(["sh", "-c", "dumpsys package " + PKG + " | grep lastUpdateTime | head -1"]);
} catch (e) {
    flash("执行 shell 失败: " + e);
    setGlobal("KS_RESULT", "error");
    setGlobal("KS_ERROR", "shell failed: " + e);
    exit();
}

var br = new java.io.BufferedReader(new java.io.InputStreamReader(shell.getInputStream()));
var line;
var lastUpdateStr = "";
while ((line = br.readLine()) != null) {
    lastUpdateStr = line.trim();
    break;
}
shell.waitFor();
br.close();

if (lastUpdateStr === "" || lastUpdateStr.indexOf("lastUpdateTime") < 0) {
    flash("拿不到 lastUpdateTime: " + lastUpdateStr);
    setGlobal("KS_RESULT", "error");
    setGlobal("KS_ERROR", "no lastUpdateTime found");
    exit();
}

// 解析 "lastUpdateTime=2026-08-08 17:46:39"
var match = lastUpdateStr.match(/lastUpdateTime=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
if (!match) {
    flash("解析时间失败: " + lastUpdateStr);
    setGlobal("KS_RESULT", "error");
    setGlobal("KS_ERROR", "parse failed: " + lastUpdateStr);
    exit();
}

var lastUpdate = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").parse(match[1]).getTime();
setGlobal("KS_LAST_USED", lastUpdate);

// ====== 判断今天是否打开过 ======
var openedToday = lastUpdate >= startOfToday;

if (openedToday) {
    // 今天打开过
    setGlobal("KS_RESULT", "opened");
    setGlobal("KS_SHOULD_NOTIFY", "0");
    flash("今天已打开过 ✓");
} else {
    // 今天没打开过
    setGlobal("KS_RESULT", "not_opened");

    // 去重：4 小时内只发一次
    var prefs = context.getSharedPreferences(PREFS_NAME, 0);
    var lastNotify = prefs.getLong("last_notify", 0);

    if (now - lastNotify > DEBOUNCE_MS) {
        prefs.edit().putLong("last_notify", now).apply();
        setGlobal("KS_SHOULD_NOTIFY", "1");
        flash("今天没打开过快手，需要通知");
    } else {
        setGlobal("KS_SHOULD_NOTIFY", "0");
        flash("今天没打开过，但 4h 内已提醒过");
    }
}

// ====== 跨天重置清理（防止状态文件堆积） ======
var prefs2 = context.getSharedPreferences(PREFS_NAME, 0);
var lastReset = prefs2.getLong("last_reset", 0);
if (now - lastReset > 24 * 60 * 60 * 1000) {
    prefs2.edit()
        .putLong("last_reset", now)
        .putLong("last_notify", 0)  // 重置去重
        .apply();
}
