// ============================================================
//  signin.js - 快手极速版自动签到 v1
//  通用版：根据文本匹配找签到入口，点击签到，发送结果通知
//  v1 是粗版，跑通后根据 explore.js 的日志再精调
// ============================================================

"ui";
"auto";

const LOG_DIR = "/sdcard/kuaishou-signin-logs/";

function ensureLogDir() {
    if (!files.exists(LOG_DIR)) {
        files.ensureDir(LOG_DIR);
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
        files.append(LOG_DIR + "signin.log",
            "[" + ts() + "] " + msg + "\n");
    } catch (e) { }
}

function shot(label) {
    try {
        var img = captureScreen();
        if (img) {
            var p = LOG_DIR + "signin_" + label + "_" + ts() + ".png";
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
    // 同时也 toast 一份
    toast(title + ": " + content);
}

function sleepSafe(ms) {
    sleep(ms);
}

function findAndClick(keywords, timeout, clickAll) {
    timeout = timeout || 3000;
    clickAll = clickAll || false;
    var i;
    for (i = 0; i < keywords.length; i++) {
        var kw = keywords[i];
        // 同时支持 text 和 desc
        var btn = textContains(kw).findOne(1000);
        if (!btn) {
            btn = descContains(kw).findOne(1000);
        }
        if (btn) {
            log("找到: " + kw);
            btn.click();
            return kw;
        }
    }
    log("没找到 keywords: " + keywords.join(", "));
    return null;
}

function checkAlreadyDone() {
    // 检查"已完成"标识
    var done = textMatches(/已完成|已签到|今日已签/).findOne(2000);
    if (done) {
        return true;
    }
    return false;
}

function go() {
    ensureLogDir();
    log("========== 签到脚本开始 ==========");

    try {
        // ======== Step 1: 启动快手极速版 ========
        log("启动快手极速版...");
        app.launchApp("快手极速版");
        sleepSafe(7000);

        var pkg = currentPackage();
        log("当前包名: " + pkg);

        if (!pkg || pkg.indexOf("kuaishou") === -1 && pkg.indexOf("gifmaker") === -1) {
            log("警告: 当前包名不像快手: " + pkg);
        }

        sleepSafe(3000);
        shot("01_started");

        // ======== Step 2: 找"我" tab, 进入个人页 ========
        // 多数情况下打卡入口在"我"页面
        log("找 '我' tab...");
        var meTab = text("我").findOne(5000);
        if (!meTab) {
            // 兜底: 屏幕右下角位置
            var w = device.width;
            var h = device.height;
            log("没找到 '我' tab, 兜底点右下角");
            click(w - 80, h - 80);
        } else {
            meTab.click();
        }
        sleepSafe(3000);
        shot("02_me_page");

        // ======== Step 3: 找打卡入口 ========
        // 多种可能: 打卡 / 每日签到 / 任务中心 / 福利中心 / 赚金币
        log("找打卡入口...");

        var entryFound = null;
        var entryKeys = ["打卡免费拿", "365天打卡", "每日任务", "任务中心", "福利中心", "赚金币", "签到"];
        entryFound = findAndClick(entryKeys, 5000);
        if (!entryFound) {
            log("首页没找到, 尝试滑动查找...");
            // 向上滑动一下
            var w = device.width;
            var h = device.height;
            swipe(w / 2, h * 0.7, w / 2, h * 0.3, 800);
            sleepSafe(2000);
            entryFound = findAndClick(entryKeys, 5000);
        }

        if (!entryFound) {
            shot("fail_no_entry");
            notify("打卡失败",
                "没找到打卡入口, 截图已保存, 发给 Mavis 调试");
            return false;
        }

        sleepSafe(4000);
        shot("03_signin_page");

        // ======== Step 4: 检查是否已签到 ========
        log("检查是否已签到...");
        if (checkAlreadyDone()) {
            notify("今日已签到", "无需重复打卡 ✓");
            log("今日已签到, 提前结束");
            return true;
        }

        // ======== Step 5: 找"每日签到"按钮 ========
        log("找签到按钮...");
        var signKeys = ["每日签到", "立即签到", "签到", "去签到", "点击签到"];
        var signBtn = findAndClick(signKeys, 5000);
        if (!signBtn) {
            shot("fail_no_signin_btn");
            notify("打卡失败",
                "没找到签到按钮, 截图已保存");
            return false;
        }

        sleepSafe(3000);
        shot("04_after_click");

        // ======== Step 6: 验证结果 ========
        log("验证签到结果...");
        // 找"签到成功" / "获得" / "奖励" / 金币变化
        var successKeys = ["签到成功", "获得", "奖励", "+", "已连续", "明日再来"];
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
            notify("打卡成功 ✓", "今天已打卡");
            shot("05_success");
            return true;
        } else {
            // 即使没明确标记, 再次检查"已完成"
            if (checkAlreadyDone()) {
                notify("打卡成功 ✓", "今日已完成");
                return true;
            }
            notify("打卡结果未知",
                "已点击签到, 但没看到成功提示, 请手动确认");
            shot("unknown_result");
            return false;
        }
    } catch (e) {
        log("脚本异常: " + e + "\n" + e.stack);
        notify("脚本异常", "" + e);
        shot("exception");
        return false;
    } finally {
        log("========== 脚本结束 ==========");
    }
}

var result = go();
log("最终结果: " + (result ? "成功" : "失败"));

// 退出脚本
exit();
