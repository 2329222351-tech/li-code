# 快手极速版 365 天打卡 — 排错指南

> 本文档收集项目日常最容易踩的坑。每个问题统一用 **症状 / 原因 / 解决** 三段式描述。
> 出问题时先看目录里有没有对应的，**90% 的问题都在这 10 条里**。
> 末尾附「求助模板」——出错直接复制模板贴回，省得来回追问。

---

## 📑 快速索引

| # | 问题 | 频率 |
|---|------|------|
| 1 | ⭐ 脚本没找到打卡入口 | 🔥🔥🔥 几乎必遇 |
| 2 | 点了签到按钮但没看到"签到成功" | 🔥🔥🔥 |
| 3 | ⭐ Tasker 到了 08:00 没触发 | 🔥🔥🔥 |
| 4 | 脚本运行报"无障碍未开启" | 🔥🔥 |
| 5 | 脚本跑完没看到通知 | 🔥🔥 |
| 6 | 蓝叠装不上快手极速版 | 🔥 |
| 7 | AutoX.js 在蓝叠里跑没反应 / 没输出 | 🔥🔥 |
| 8 | 脚本在模拟器里能跑，真机挂了 | 🔥🔥 |
| 9 | ⭐ state.json 一直显示 failed | 🔥🔥🔥 |
| 10 | ⭐ MagicOS 10 杀 Tasker 定时器 | 🔥🔥🔥 |

⭐ = 用户**最高频遇到**，真机部署后几乎一定会触发。

---

## 1. ⭐ 脚本没找到打卡入口

### 症状

- 通知弹出「打卡失败：没找到打卡入口，截图已保存，发给 Mavis 调试」
- `/sdcard/kuaishou-signin-logs/` 目录下多了 `fail_no_entry_*.png`
- `signin.log` 里最后几行是：

  ```
  没找到 keywords: 打卡免费拿, 365天打卡, 每日任务, 任务中心, 福利中心, 赚金币, 签到
  ```

### 原因

快手极速版**每隔几周会改版一次**——打卡入口可能：

- 文字变了（「打卡免费拿」→「天天领金币」）
- 位置变了（原来在"我"页，现在藏在二级页面）
- 入口整个换了个新名字（"红包签到"、"每日福利"之类）
- App 启动后页面没加载完就去找，自然找不到

### 解决

1. **不要手动改 signin.js**，先重新跑一次 `explore.js`：
   ```bash
   # 打开 AutoX.js → 打开 explore.js → 点 ▶️ 运行
   ```
2. 跑完去 `/sdcard/kuaishou-signin-logs/` 把**所有 `screen_*.png` 截图 + `explore.log`** 通过微信/QQ 发给 Mavis。
3. 看截图找新的入口文案（一般在"我"页里找带"金币/福利/签到/任务/打卡"字样的按钮）。
4. Mavis 拿到截图后会改 `signin.js` 里的 `entryKeys` 数组：

   ```javascript
   // signin.js 里第 137 行附近
   var entryKeys = ["打卡免费拿", "365天打卡", "每日任务",
                    "任务中心", "福利中心", "赚金币", "签到"];
   // ↑ 改成新发现的关键词，比如 ["天天领金币", "今日福利", ...]
   ```
5. 改完手动跑一次 signin.js 验证。

---

## 2. 点了签到按钮但没看到"签到成功"

### 症状

- 通知说"打卡成功"或"打卡结果未知"
- 打开快手极速版一查：今天根本没签到，或者金币没到账
- 日志显示 `签到成功标记: +`（说明脚本只匹配到了"+"号，可能误判）

### 原因

可能性从高到低：

1. **页面没加载完就点了签到**——脚本默认 `sleep 3000~5000ms` 不够
2. **弹窗遮挡**——首次签到会弹"同意协议"、"新人福利"之类的小窗
3. **快手风控**——检测到自动化行为，点了但实际没生效
4. **误判**——脚本只匹配到"+"号就认为成功

### 解决

**分步排查：**

1. **看日志关键词**——打开 `signin.log`，看是"签到成功标记"是哪个词：
   - 如果是 `+` → 大概率是误判
   - 如果是 `签到成功` / `已连续` → 真点中了但页面延迟

2. **加长等待时间**——编辑 `signin.js`：

   ```javascript
   // 把这几个 sleepSafe() 数字调大
   sleepSafe(7000);   // 启动快手后的等待，默认 7000 改成 12000
   sleepSafe(4000);   // 进入签到页后的等待
   sleepSafe(3000);   // 点击签到后的等待
   ```

3. **加弹窗检测**——在第 5 步找签到按钮之前，加一段：

   ```javascript
   // 关掉可能的弹窗
   var closeBtn = textMatches(/关闭|跳过|知道了|我知道了/).findOne(2000);
   if (closeBtn) { closeBtn.click(); sleepSafe(1500); }
   ```

4. **加失败重试**——把 `go()` 整个函数包个 retry：

   ```javascript
   var ok = false;
   for (var retry = 0; retry < 3 && !ok; retry++) {
       log("第 " + (retry + 1) + " 次尝试");
       ok = go();
       if (!ok) sleepSafe(5000);
   }
   ```

5. **手动打开快手**——确认今天**真的没签到**（有时候你以为没签到其实已经签过了）。

---

## 3. ⭐ Tasker 到了 08:00 没触发

### 症状

- 早上 8 点了，没收到任何通知
- 手动打开快手极速版：今天没签到
- 打开 Tasker → 日志 / 运行历史：08:00 这一条根本没记录

### 原因

MagicOS 10 的后台管理**非常激进**。Tasker 装上后**默认会被杀掉**——所以你就算配了定时也触发不了。常见原因：

1. `setup-guide.md` 第 3 步的 **6 个白名单没全做**
2. 没开"精确闹钟"权限（Android 12+ 必开）
3. Tasker 在省电模式下被冻结
4. 手机处于"勿扰"或"睡眠"模式，Tasker 没法唤醒 CPU
5. AutoX.js 也没在白名单里 → 即使 Tasker 触发了，run JS 那一步也失败

### 解决

**A. 验证 Tasker 自己能不能跑**（最关键的一步）

1. 打开 Tasker → 任务（Tasks）→ + → 名字填 `test`
2. 加 Action：`Misc → Flash → "Tasker 在跑"`
3. Profiles（配置文件）→ + → Time → 选**1 分钟后**的时间
4. 关联到 `test` 任务
5. 退到桌面等 1 分钟
6. **如果 1 分钟后没看到 "Tasker 在跑" 的 Toast/通知** → 100% 是白名单没配好
7. **如果 1 分钟能弹** → Tasker 本身没问题，跳到 B

**B. 检查 6 个白名单全做完没**

打开 `setup-guide.md` 第 3 步，对照做：

```
✅ 3.1 应用启动管理（最关键）
   设置 → 电池 → 应用启动管理
   → AutoX.js：自动启动 / 关联启动 / 后台运行 三开关全开
   → Tasker：同上

✅ 3.2 电池优化
   设置 → 电池 → 更多电池设置 → 电池优化
   → 切换"所有应用" → AutoX.js 和 Tasker 选"不优化"

✅ 3.3 多任务卡片锁定
   上滑打开多任务 → 长按 AutoX.js 卡片 → 锁定
   → 长按 Tasker 卡片 → 锁定

✅ 3.4 通知权限
   设置 → 通知 → 应用通知管理 → AutoX.js / Tasker 全开

✅ 3.5 自启动
   设置 → 应用 → 应用管理 → 找到 AutoX.js / Tasker → 自启动开

✅ 3.6 后台耗电详情
   设置 → 电池 → 耗电详情 → 看有没有"被限制" → 允许
```

**C. 开精确闹钟**（Android 12+ 必开，很多人栽这）

```
设置 → 辅助功能 → 快捷启动及手势 → 精确闹钟
  → 打开
```

或在 Tasker 里：
- 打开 Tasker → 右上角 ⋮ → 首选项（Preferences）→ 监视器（Monitor）→ **前台服务** 启用
- 同样在首选项 → 动作（Action）→ 检查有没有"精确闹钟"选项

**D. 关省电模式 / 关电池优化全局**

```
设置 → 电池 → 省电模式 → 关
设置 → 电池 → 超级省电 → 关
```

**E. 验证完后再回 A 步重测一次**，1 分钟定时能弹了再挂 08:00 真任务。

---

## 4. 脚本运行报"无障碍未开启"

### 症状

- 打开 signin.js / explore.js → 点运行
- 立刻弹 `Error: 无障碍服务未启用，请手动开启后重试`
- 或 `Cannot find UI node, no accessibility service`

### 原因

AutoX.js 的所有 UI 操作（找节点、点击）都依赖**系统级无障碍服务**。没开就等于脚本"看不见"屏幕，自然什么也做不了。

### 解决

1. 打开 **AutoX.js**
2. 通常会**自动跳**到无障碍设置；如果没跳，手动：
   ```
   设置 → 辅助功能 → 无障碍 → AutoX.js → 打开
   ```
3. 弹出系统确认框："AutoX.js 可能会监控您的操作" → **确定**
4. 回到 AutoX.js → 重新点运行脚本

**真机 MagicOS 10 路径**（顺序略有不同）：
```
设置 → 辅助功能 → 无障碍 → 已下载的服务 → AutoX.js → 打开
```

**蓝叠 / 模拟器路径**：
```
蓝叠桌面 → 设置 → 辅助功能 → AutoX.js → 打开
```
或装个小工具「无障碍一键开启」直接点。

**验证已开启**：
- 打开 AutoX.js → 左上角菜单 → 看到"无障碍服务：已启用" = 通了
- 没启用的话菜单会直接显示"前往开启"按钮

---

## 5. 脚本跑完没看到通知

### 症状

- Tasker 跑了 / 手动跑了脚本
- 通知栏里**什么也没有**
- 但 `signin.log` 里明明有 `NOTIFY: xxx` 的记录

### 原因

通知被静默了，常见三连：

1. **通知权限没开**（最常见）
2. **通知渠道被关**（AutoX.js 有多个通知渠道，每个可独立关）
3. **App 被杀**——脚本都跑完了，但 AutoX.js 在后台被清掉，通知就跟着没

### 解决

**第一步：检查通知权限**

```
设置 → 通知 → 应用通知管理 → AutoX.js → 全部允许
```

**第二步：检查 AutoX.js 内的通知渠道**

1. 打开 AutoX.js → 左上角菜单 → 设置（Settings）
2. 找到 "通知" / "Notification" 相关
3. 确认"脚本通知" / "运行通知"渠道都**没被关**

**第三步：检查脚本里 `importance` 参数**

打开 `signin.js` 第 54 行：

```javascript
$notification.post(title, content, { importance: 1 });
//                      ↑ 这是最低优先级，改成 4 或 5 试试
// importance: 1=静默  3=默认  4=重要  5=横幅
```

推荐改成：

```javascript
$notification.post(title, content, { importance: 5 });
```

**第四步：锁多任务卡片**

参考问题 3 的 `3.3` —— AutoX.js 卡片要锁定，否则被杀通知就丢了。

---

## 6. 蓝叠模拟器装不上快手极速版

### 症状

- 下载了快手极速版 APK
- 双击 / 拖进蓝叠 → 没反应，或弹"安装失败"
- 蓝叠应用中心搜不到

### 原因

1. APK 跟蓝叠的安卓版本不兼容（比如快手新版要 Android 10+，蓝叠装了 Android 7）
2. APK 损坏（下载没下完整）
3. 蓝叠版本太老
4. 蓝叠里"允许安装未知来源"没开

### 解决

**优先用蓝叠应用中心**（最稳）：

1. 打开蓝叠 → 桌面"应用中心"图标
2. 搜「快手极速版」
3. 直接点安装

**如果应用中心没有**：

1. 蓝叠右上角设置 → 检查安卓版本（**要 Android 9 以上**）
2. 如果版本低：蓝叠设置 → 引擎 → 选更新的镜像（推荐 Nougat 64-bit 或 Pie 64-bit）
3. 装个**旧版快手极速版**试试（APKPure / 豌豆荚下历史版本）

**还不行就换模拟器**：

| 模拟器 | 安装快手 | 备注 |
|--------|---------|------|
| 蓝叠 5 | ✅ 推荐 | 默认开箱即用 |
| 夜神 | ✅ | 国产老牌 |
| 雷电 | ⚠️ 可能 | 部分版本兼容性差 |
| Android Studio 模拟器 | ❌ 不推荐 | x86 镜像装不上 arm64 的快手 |

参考 `emulator-guide.md` 的备选清单。

---

## 7. AutoX.js 在蓝叠里跑看不到控制台输出

### 症状

- 打开 signin.js → 点运行
- 模拟器里**快手极速版被启动了**，脚本在跑
- 但是**控制台一片空白**，啥日志都没有
- 不知道脚本卡在哪一步

### 原因

AutoX.js 默认把日志输出到 **logcat**（Android 底层日志系统），而不是 App 内的控制台。需要手动配置。

### 解决

**方法 1：打开 App 内控制台**

1. 打开 AutoX.js → 左上角菜单 → 设置（Settings）
2. 找到 **"日志输出服务"** / "Log Service"
3. 选 **"在控制台中显示"** 或 "Console"
4. 重新跑脚本

**方法 2：用 logcat 抓日志**

```powershell
# 在 Windows 终端里执行
adb logcat -s AutoX-js:V AutoX:V Script:V

# 或更宽松
adb logcat | findstr "autojs"
```

**方法 3：把脚本里的 console.log 改成 log()**

打开 `signin.js`，把所有 `console.log(msg)` 替换成 `log(msg)`（脚本里已经定义了 `log` 函数）。`log` 函数会把消息**同时写文件 + 写控制台**：

```javascript
function log(msg) {
    console.log(msg);  // 控制台
    files.append(LOG_DIR + "signin.log", "[" + ts() + "] " + msg + "\n");
    //                      ↑ 同时写文件到 /sdcard/kuaishou-signin-logs/signin.log
}
```

**方法 4：直接看日志文件**

不管控制台有没有输出，**所有 `log()` 调用都会写到文件**：

```
/sdcard/kuaishou-signin-logs/signin.log
```

用蓝叠文件管理器打开看，最稳。

---

## 8. 脚本在模拟器里能跑，真机挂了

### 症状

- 蓝叠里 signin.js 完美跑通，每天都能签到
- 换到 MagicOS 10 真机后，脚本一启动就 fail
- 日志里看到 `当前包名: xxx` 不是 `kuaishou` / `gifmaker`

### 原因

模拟器和真机的环境差异：

1. **包名不同**——快手极速版的包名可能跟标准版不一样（`com.smile.gifmaker` vs `com.kuaishou.nebula`）
2. **分辨率不同**——真机分辨率跟模拟器不一致，固定坐标的点击失效
3. **权限不同**——真机权限弹窗、通知权限管得更严
4. **启动方式不同**——`app.launchApp("快手极速版")` 在真机上要精确匹配 App 名称

### 解决

**A. 验证包名**

跑一次 explore.js，看 `当前包名: xxx` 是啥。常见候选：

```javascript
// signin.js 第 109 行附近
if (!pkg || pkg.indexOf("kuaishou") === -1 && pkg.indexOf("gifmaker") === -1) {
    log("警告: 当前包名不像快手: " + pkg);
}
```

如果新包名不在 `kuaishou` / `gifmaker` 关键词里，**手动加进去**：

```javascript
// 改成
if (!pkg || pkg.indexOf("kuaishou") === -1
          && pkg.indexOf("gifmaker") === -1
          && pkg.indexOf("nebula") === -1) {  // 加新关键词
    log("警告: 当前包名不像快手: " + pkg);
}
```

**B. 坐标用相对值，别用绝对值**

```javascript
// ❌ 错的（硬编码坐标）
click(540, 1200);

// ✅ 对的（按 device.width 算）
var w = device.width;
var h = device.height;
click(w * 0.5, h * 0.7);  // 屏幕中央偏下
```

`signin.js` 里的兜底逻辑已经有这种写法（`click(w - 80, h - 80)`），照抄即可。

**C. 启动方式改用包名**

```javascript
// 旧（按 App 名）
app.launchApp("快手极速版");

// 新（按包名，更稳）
app.launchPackage("com.smile.gifmaker");
```

**D. 真机手动跑一次**

```bash
1. 真机打开 AutoX.js
2. 打开 signin.js → 点运行
3. 看每一步截图（保存到 /sdcard/kuaishou-signin-logs/）
4. 卡在哪步 → 把那步截图发 Mavis
```

---

## 9. ⭐ state.json 一直显示 failed

### 症状

- 连续 3 天 / 5 天通知说"打卡失败"
- state.json 里的 `lastStatus` 一直是 `failed`
- streak 计数器没涨，快手 App 里查也没签到

### 排查路径（按这个顺序走）

**Step 1：先看截图**

```bash
# 打开文件管理器（蓝叠 / 真机都行）
# 路径：/sdcard/kuaishou-signin-logs/
# 找到最近几天的：
#   - fail_*.png  ← 失败时的截图（最重要）
#   - unknown_result_*.png  ← 不确定是否成功
```

**看截图判断**：

| 截图里看到 | 说明 | 下一步 |
|----------|------|------|
| 快手在首页，没进签到页 | 入口没找到 | 走问题 1 |
| 进了签到页但没看到按钮 | 按钮文字变了 | 走问题 1 |
| 看到签到按钮但没反应 | 弹窗挡住 / 加载慢 | 走问题 2 |
| 看到"签到成功"但金币没到 | 风控 / 误判 | 走问题 2 |
| 看到的是 Tasker / AutoX 设置页 | 权限掉了 | 走问题 4 |

**Step 2：看日志**

打开 `/sdcard/kuaishou-signin-logs/signin.log`，找最后几行的关键词：

```bash
# 真机 / 模拟器里都能用：
grep -E "警告|失败|找不到|Error" signin.log | tail -20
```

常见关键词含义：

- `当前包名: com.android.settings` → 权限掉了或脚本根本没启动快手
- `没找到 keywords: ...` → 走问题 1
- `脚本异常: ...` → 看具体的 e.message
- `警告: 当前包名不像快手` → 走问题 8

**Step 3：手动跑一次 explore.js**

如果 signin.js 一直 fail，**先别死磕**——跑一遍 explore.js 看真实 UI：

```bash
1. AutoX.js → 打开 explore.js → 运行
2. 跑完把 /sdcard/kuaishou-signin-logs/ 整个目录打包
3. 发给 Mavis 看
```

Mavis 拿到截图后会：
- 看新版 UI 结构
- 改 signin.js 里的关键词
- 加新的等待时间

**Step 4：手动运行 signin.js 验证**

explore 完 + 改完 signin.js 后，**手动跑一次**（不要等 Tasker 触发），确认能跑通。

**Step 5：再挂回 Tasker**

手动能跑通后，再挂回 Tasker 定时，观察 3 天。

---

## 10. ⭐ MagicOS 10 后台被杀后，Tasker 定时器也停了

### 症状

- 一开始 Tasker 能正常触发
- 用了一两周后，**早上 8 点不跑了**
- 不是"一次没跑"，是**连续几天都不跑**
- 手动打开 Tasker → 看到任务和 profile 都在，但**没触发记录**

### 原因

MagicOS 10 的"超速杀后台"行为：

- 哪怕白名单全配了，**用久了系统还是会把 Tasker 拉进"冷冻室"**
- 冷冻室里的 App 定时器**不会触发**（不是被冻结，是定时器被系统挂起）
- 常见触发条件：连续几天不打开 App / 系统更新后 / 省电模式自动开启

### 解决

**A. 重新做一遍白名单**（问题 3 的 A~E 全跑一遍）

最常被搞掉的是这两个：
- **3.6 后台耗电详情**——系统会偷偷加回来
- **精确闹钟**——系统更新后默认关

**B. 锁多任务卡片**

```
上滑打开多任务 → 找到 Tasker 卡片 → 长按 → 锁定
```

锁定的 App 在清理时不会被杀。**AutoX.js 也要锁**。

**C. 加"心跳 task"保活**

在 Tasker 里加个每 30 分钟跑一次的小任务，**强制唤醒 Tasker 自己**：

1. Tasks → + → 名字 `heartbeat`
2. 加 Action：
   ```
   Variable → Variable Set → 名字 %HEARTBEAT → 值 %TIME
   ```
3. Profiles → + → Time → **Every 30 Minutes**
4. 关联到 `heartbeat` 任务
5. 保存

这样 Tasker 每 30 分钟自己会醒一下，定时器就不容易被系统挂起。

**D. 每周手动开一次 Tasker**

养成习惯：**每周日打开一次 Tasker 主界面**（哪怕啥也不干）。这能"骗"系统认为这个 App 是活跃的，不进冷冻室。

**E. 终极方案：用 ADB 永久保活**

```powershell
# 在 Windows 上执行（需要 USB 调试已开）
adb shell dumpsys deviceidle whitelist +com.joaomgcd.tasker
adb shell dumpsys deviceidle whitelist +org.autojs.autojs
```

加进系统级的"doze 白名单"，**系统杀不动**。这是最稳的方案，但要每次系统更新后重新执行。

**F. 备选：换调度 App**

如果 Tasker 实在保不住，可以试：
- **MacroDroid**（免费版够用，国产兼容性更好）
- **Automate**（可视化流程）
- **系统自带"定时任务"**（荣耀 MagicOS 自带的，可能更稳）

---

## 📋 求助模板

> 出问题时，**直接复制下面这段到聊天框，把 `< >` 里的内容填好**发回来，可以大幅减少来回追问的次数。

```
## 求助 - 快手极速版自动打卡

【问题编号】troubleshooting.md 第 X 条 / 其他（描述）

【运行在哪】真机 MagicOS 10 / 蓝叠 / 夜神 / 雷电

【设备型号】荣耀 XXX / 其他

【触发方式】手动跑 signin.js / Tasker 定时 / 其他

【最后一次成功】X 天前 / 从来没成功

【通知内容】原样贴出来，比如 "打卡失败：没找到签到按钮"

【关键日志】粘贴 signin.log 最后 10-20 行
（路径：/sdcard/kuaishou-signin-logs/signin.log）

【截图】（附件发最近的 fail_*.png 或异常截图）

【已尝试】（勾选你做过的）
[ ] 检查 6 个白名单
[ ] 重启 Tasker
[ ] 重启 AutoX.js
[ ] 重新跑 explore.js
[ ] 查过 signin.log
[ ] 其他：____________
```

---

## 🆘 实在搞不定时

如果上面 10 条全试了还不行：

1. **打包发我**：
   - `/sdcard/kuaishou-signin-logs/` 整个目录（zip 一下）
   - 最近的 `signin.log` + `explore.log` + 几张关键截图
   - 通知原文

2. **同时确认**：
   - 你的快手账号**现在手动签到还正常**吗？（如果连手动都签不到，那是账号问题不是脚本问题）
   - 今天日期对吗？（晚上跑脚本，第二天才看到结果）

3. **临时保 streak 方案**（脚本完全挂了的应急）：
   - 每天**早上 8 点前手动**打开快手极速版
   - 点"我" → 找"打卡免费拿" → 签到
   - 先保 365 天 streak 不断，脚本后面再修
