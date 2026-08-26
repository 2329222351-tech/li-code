// ============================================================
//  explore.js - 快手极速版 UI 探索脚本
//  目的：进入快手极速版后, dump 所有页面的 text/desc 节点
//  跑完把日志截图发我, 我精写签到脚本
// ============================================================

"ui";
"auto";

// 路径前缀 - 把日志和截图都写到这里
const LOG_DIR = "/sdcard/kuaishou-signin-logs/";

function ensureLogDir() {
    if (!files.exists(LOG_DIR)) {
        files.ensureDir(LOG_DIR);
    }
}

function ts() {
    var d = new Date();
    return d.getFullYear() + "" + (d.getMonth() + 1) + "" + d.getDate() + "_" +
        d.getHours() + "" + d.getMinutes() + "" + d.getSeconds();
}

function log(msg) {
    console.log(msg);
    try {
        files.append(LOG_DIR + "explore.log", "[" + ts() + "] " + msg + "\n");
    } catch (e) {
        console.log("log err: " + e);
    }
}

function dumpUi(label) {
    log("=== UI DUMP: " + label + " ===");
    try {
        // 1) 截图
        var img = captureScreen();
        var imgPath = LOG_DIR + "screen_" + label + "_" + ts() + ".png";
        if (img) {
            images.save(img, imgPath);
            log("截图: " + imgPath);
        } else {
            log("截图失败");
        }

        // 2) 抓当前页所有 text 节点
        var texts = textMatches(/.*/).find();
        log("text 节点数: " + texts.length);
        var seen = {};
        var i;
        for (i = 0; i < texts.length; i++) {
            var t = texts[i].text();
            if (t && t.length > 0 && t.length < 60 && !seen[t]) {
                seen[t] = 1;
                log("  TEXT: " + t);
            }
        }

        // 3) 抓 desc 节点
        var descs = descMatches(/.*/).find();
        log("desc 节点数: " + descs.length);
        var seenD = {};
        for (i = 0; i < descs.length; i++) {
            var d = descs[i].desc();
            if (d && d.length > 0 && d.length < 60 && !seenD[d]) {
                seenD[d] = 1;
                log("  DESC: " + d);
            }
        }

        // 4) 当前包名
        log("当前包名: " + currentPackage());
    } catch (e) {
        log("dump err: " + e);
    }
    log("=== END DUMP ===");
}

function waitForText(txt, timeout) {
    timeout = timeout || 10000;
    return !!text(txt).findOne(timeout);
}

function go() {
    ensureLogDir();
    log("========= 开始探索 =========");

    // ========= 阶段 0: 启动快手极速版 =========
    log("启动快手极速版...");
    app.launchApp("快手极速版");
    sleep(6000);  // 等启动

    // ========= 阶段 1: 主页 dump =========
    log("等主页加载...");
    sleep(3000);
    dumpUi("01_home");

    // ========= 阶段 2: 进入"我"页面 =========
    // "我" 一般在底部 tab
    log("尝试点 '我' 标签...");
    var meTab = text("我").findOne(5000);
    if (meTab) {
        meTab.click();
        sleep(3000);
        dumpUi("02_me");
    } else {
        log("没找到 '我' 标签");
    }

    // ========= 阶段 3: 找"打卡"入口 =========
    // 在我页面里找打卡相关字眼
    log("在我页面找 '打卡' 入口...");
    var keywords = ["打卡", "每日签到", "签到", "赚金币", "任务中心", "福利中心", "日常任务"];
    var k;
    for (k = 0; k < keywords.length; k++) {
        var kw = keywords[k];
        var btn = textContains(kw).findOne(2000);
        if (btn) {
            log("找到关键字: " + kw);
            btn.click();
            sleep(4000);
            dumpUi("03_" + kw);
            sleep(2000);
            // 返回上一层
            back();
            sleep(2000);
        }
    }

    // ========= 阶段 4: 通过 widget 路径 =========
    // 试一下从桌面点 widget (如果可能)
    log("返回桌面, 试 widget 路径...");
    home();
    sleep(2000);
    dumpUi("04_home_screen");

    log("========= 探索完成 =========");
    log("请把以下内容发给我:");
    log("1. /sdcard/kuaishou-signin-logs/ 目录下所有 .png 截图");
    log("2. explore.log 日志文件");
    log("");
    log("如果不知道怎么取文件, 用 AutoX.js 左上角菜单 -> 文件管理 下载到本地");

    // 弹出通知
    $notification.post(
        "UI 探索完成",
        "请把日志和截图发给 Mavis",
        { importance: 1 }
    );
}

go();
