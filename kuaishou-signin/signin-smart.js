// ============================================================
//  signin-smart.js - 快手极速版 365 天自动打卡 (智能版)
//
//  核心改进 vs v1 (signin.js):
//   1) 启动 APP 前先读 /sdcard/kuaishou-signin-logs/state.json,
//      今日已完成 (success / already_done) 则直接通知, 不启动 APP
//   2) 结果写回 state.json (success / already_done / failed)
//   3) 失败自动重试 FAST_RETRY 次
//   4) 包名动态获取 (app.getPackageName), 避免硬编码
//   5) 截图/日志/状态文件统一写到 /sdcard/kuaishou-signin-logs/
// ============================================================

"ui";
"auto";

// ============================================================
//  可调参数 (按需修改)
// ============================================================
const SCRIPT_VERSION = "smart-v1";
const LOG_DIR = "/sdcard/kuaishou-signin-logs/";
const STATE_FILE = LOG_DIR + "state.json";
const SLEEP_BETWEEN_ACTIONS = 800;   // 关键操作之间的默认间隔 (毫秒)
const FAST_RETRY = 2;                // 失败后重试次数 (总共最多跑 FAST_RETRY+1 次)
const APP_NAME = "快手极速版";        // APP 名称 (用于 launchApp / getPackageName)
const RETRY_INTERVAL = 1500;         // 重试之间多等一会, 让 APP 稳下来

// ============================================================
//  工具函数 (与 v1 保持一致, 仅微调)
// ============================================================

function ensureLogDir() {
    try {
        if (!files.exists(LOG_DIR)) {
            files.ensureDir(LOG_DIR);
        }
    } catch (e) {
        console.log("ensureLogDir 失败: " + e);
    }
}

function ts() {
    var d = new Date();
    return d.getFullYear() + "" +
        ("0" + (d.getMonth() + 1)).slice(-2) + "" +
        ("0" + d.getDate()).slice(-2) + "_" +
        ("0" + d.getHours()).slice(-2) + "" +
        ("0" + d.getMinutes()).slice(-2) + "" +
        ("0" + d.getSeconds()).slice(-2);
}

function log(msg) {
    console.log(msg);
    try {
        files.append(LOG_DIR + "signin-smart.log",
            "[" + ts() + "] " + msg + "\n");
    } catch (e) { }
}

function shot(label) {
    try {
        var img = captureScreen();
        if (img) {
            var p = LOG_DIR + "signin_smart_" + label + "_" + ts() + ".png";
            images.save(img, p);
            log("截图: " + p);
            return p;
        }
    } catch (e) {
        log("截图失败: " + e);
    }
    return null;
}

function notify(title, content) {
    log("NOTIFY: " + title + " - " + content);
    try {
        $notification.post(title, content, { importance: 1 });
    } catch (e) {
        log("通知发送失败: " + e);
    }
    try {
        toast(title + ": " + content);
    } catch (e) { }
}

function sleepSafe(ms) {
    try {
        sleep(ms);
    } catch (e) {
        log("sleep 异常: " + e);
    }
}

function findAndClick(keywords) {
    var i;
    for (i = 0; i < keywords.length; i++) {
        var kw = keywords[i];
        var btn = textContains(kw).findOne(1000);
        if (!btn) {
            btn = descContains(kw).findOne(1000);
        }
        if (btn) {
            log("找到: " + kw);
            try {
                btn.click();
            } catch (e) {
                log("点击失败: " + e);
                continue;
            }
            return kw;
        }
    }
    log("没找到 keywords: " + keywords.join(", "));
    return null;
}

function checkAlreadyDone() {
    var done = textMatches(/已完成|已签到|明日再来|今日已/).findOne(2000);
    if (done) {
        return true;
    }
    return false;
}

// ============================================================
//  状态文件 (持久化签到结果, 用于预检)
// ============================================================

function todayString() {
    var d = new Date();
    return d.getFullYear() + "-" +
        ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
        ("0" + d.getDate()).slice(-2);
}

function readState() {
    try {
        if (!files.exists(STATE_FILE)) {
            return null;
        }
        var raw = files.read(STATE_FILE);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    } catch (e) {
        log("读 state.json 失败 (按无历史处理): " + e);
        return null;
    }
}

function writeState(obj) {
    try {
        files.write(STATE_FILE, JSON.stringify(obj));
        log("写 state.json: " + JSON.stringify(obj));
    } catch (e) {
        log("写 state.json 失败: " + e);
    }
}

// 预检: 今日已 success / already_done → 返回 true 表示可跳过
//  注: 用户 spec 写的是 "status == success", 这里同时跳过 already_done,
//      因为两者都意味着今天已经搞定了, 没必要再启动 APP
//      如需严格遵循 spec, 把 || state.status === "already_done" 删掉即可
function precheckTodayDone() {
    var state = readState();
    if (!state) {
        log("预检: 无历史状态, 正常走流程");
        return false;
    }
    var today = todayString();
    if (state.last_signin_date === today &&
        (state.status === "success" || state.status === "already_done")) {
        log("预检: 今日已完成 (status=" + state.status + "), 跳过签到");
        notify("今日已签到 ✓", "今天已打卡 (" + state.status + ")");
        sleepSafe(3000);
        return true;
    }
    log("预检: 需要走签到流程 (state=" + JSON.stringify(state) + ")");
    return false;
}

// ============================================================
//  主流程 (单次, 不含预检和重试)
// ============================================================

function doSignin() {
    // ======== Step 0: 动态解析包名 (避免硬编码) ========
    var pkg = null;
    try {
        pkg = app.getPackageName(APP_NAME);
        log("包名解析: " + APP_NAME + " -> " + pkg);
    } catch (e) {
        log("包名解析失败 (继续): " + e);
    }

    // ======== Step 1: 启动 APP ========
    log("启动 " + APP_NAME + "...");
    try {
        app.launchApp(APP_NAME);
    } catch (e) {
        return "failed: 启动失败 - " + e;
    }
    sleepSafe(3000);

    // 运行时核对包名
    var cur = currentPackage();
    log("当前包: " + cur);
    if (!cur || (cur.indexOf("kuaishou") === -1 && cur.indexOf("gifmaker") === -1)) {
        log("警告: 当前包名不像快手, 继续往下走");
    }

    sleepSafe(2000);
    shot("01_started");

    // ======== Step 2: 找"我" tab ========
    log("找 '我' tab...");
    var meTab = text("我").findOne(5000);
    if (!meTab) {
        // 兜底: 屏幕右下角
        var w = device.width;
        var h = device.height;
        log("没找到 '我' tab, 兜底点右下角");
        click(w - 80, h - 80);
    } else {
        meTab.click();
    }
    sleepSafe(2500);
    shot("02_me_page");

    // ======== Step 3: 找打卡入口 ========
    log("找打卡入口...");
    var entryKeys = ["打卡免费拿", "365天打卡", "每日任务", "任务中心", "福利中心", "赚金币", "签到"];
    var entryFound = findAndClick(entryKeys);
    if (!entryFound) {
        // 兜底: 向上滑一下重试
        log("首屏没找到, 滑动重试...");
        var w2 = device.width;
        var h2 = device.height;
        swipe(w2 / 2, h2 * 0.7, w2 / 2, h2 * 0.3, 600);
        sleepSafe(2000);
        entryFound = findAndClick(entryKeys);
    }

    if (!entryFound) {
        shot("fail_no_entry");
        return "failed: 没找到打卡入口";
    }

    sleepSafe(3000);
    shot("03_signin_page");

    // ======== Step 4: 检查是否已签到 ========
    log("检查是否已签到...");
    if (checkAlreadyDone()) {
        return "already_done";
    }

    // ======== Step 5: 找签到按钮 ========
    log("找签到按钮...");
    var signKeys = ["每日签到", "立即签到", "去签到", "点击签到", "签到"];
    var signBtn = findAndClick(signKeys);
    if (!signBtn) {
        shot("fail_no_signin_btn");
        return "failed: 没找到签到按钮";
    }

    sleepSafe(3000);
    shot("04_after_click");

    // ======== Step 6: 验证结果 ========
    log("验证签到结果...");
    var successKeys = ["签到成功", "获得", "奖励", "已连续", "明日再来"];
    var success = false;
    for (var i = 0; i < successKeys.length; i++) {
        var ok = textContains(successKeys[i]).findOne(2000);
        if (ok) {
            success = true;
            log("签到成功标记: " + successKeys[i]);
            break;
        }
    }

    if (success) {
        shot("05_success");
        return "success";
    }

    // 再做一次 "已完成" 检查
    if (checkAlreadyDone()) {
        shot("05_already_done");
        return "already_done";
    }

    shot("unknown_result");
    return "failed: 点击后没看到成功提示";
}

// ============================================================
//  结果处理 (写 state.json + 通知)
// ============================================================

function handleResult(result) {
    var state = {
        last_signin_date: todayString(),
        ts: Date.now()
    };
    if (result === "success") {
        state.status = "success";
        writeState(state);
        notify("签到成功 ✓", "今天已打卡");
    } else if (result === "already_done") {
        state.status = "already_done";
        writeState(state);
        notify("今日已签到 ✓", "无需重复打卡");
    } else {
        state.status = "failed";
        state.error = "" + result;
        writeState(state);
        notify("签到失败 ✗", "" + result);
    }
}

// ============================================================
//  入口
// ============================================================

function go() {
    ensureLogDir();
    log("========== 签到脚本开始 (" + SCRIPT_VERSION + ") ==========");
    log("参数: SLEEP=" + SLEEP_BETWEEN_ACTIONS + "ms, FAST_RETRY=" + FAST_RETRY);

    // 1) 状态预检
    if (precheckTodayDone()) {
        log("预检通过, 提前结束 (不启动 APP)");
        log("========== 脚本结束 ==========");
        return "skipped";
    }

    // 2) 主流程 (含失败重试)
    var result = null;
    var attempt = 0;
    while (true) {
        if (attempt > 0) {
            log("========== 重试 " + attempt + "/" + FAST_RETRY + " ==========");
            sleepSafe(RETRY_INTERVAL);
        }
        try {
            result = doSignin();
        } catch (e) {
            log("doSignin 异常: " + e + "\n" + e.stack);
            shot("exception");
            result = "failed: 异常 - " + e;
        }
        if (result === "success" || result === "already_done") {
            break;
        }
        attempt++;
        if (attempt > FAST_RETRY) {
            break;
        }
    }

    // 3) 处理结果
    handleResult(result);

    log("最终结果: " + result);
    log("========== 脚本结束 ==========");
    return result;
}

go();
exit();
