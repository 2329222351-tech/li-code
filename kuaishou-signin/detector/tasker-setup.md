# Tasker 配置 - 通用 APP 打卡检测器

> 手机端配置：监听解锁事件、跑检测脚本、发通知。

---

## 工具链

- **Tasker**（必需）：定时 + 触发 + 通知
- 不需要 AutoX.js、不需要无障碍、不需要 root

## 权限要求

- ✅ 通知权限
- ✅ 电池优化白名单（防被 MagicOS 10 杀）
- ✅ 自启动权限

---

## PC 端：保存 APP 列表

PC 跑：
```powershell
cd D:\gr\code1\kuaishou-signin\detector
.\MavisReminder.ps1
```

浏览器里选好 APP，点「保存设置并推送到手机」。文件自动推到 `/sdcard/MavisReminder/apps.json`。

> 完整说明见 `README.md`。

---

## 手机端：装 Tasker

- 华为/荣耀应用市场搜 "Tasker" 装
- 或 Google Play 装
- 首次启动给通知权限

---

## 荣耀后台白名单（必做）

> MagicOS 10 后台杀得很凶，Tasker 必须全套白名单

1. **设置 → 电池 → 应用启动管理**
   - 找到 Tasker
   - 三个开关都打开（自动启动 / 关联启动 / 后台活动）
2. **设置 → 通知**
   - 找到 Tasker
   - 全部允许（横幅/锁屏/角标）
3. **最近任务**
   - 找到 Tasker 卡片
   - **下拉锁定**（防止被一键清掉）

---

## Tasker 里建检测任务

1. 打开 Tasker
2. **TASKS** 标签 → 点 **+** → 名字：`App Reminder Detector`
3. 进入任务 → 点 **+** 加 Action
4. 选 **Code** → **JavaScriptlet**
5. 关闭 "Use Root"，关闭 "Auto-close"
6. 把 `D:\gr\code1\kuaishou-signin\detector\app-detector.js` 整个内容**复制粘贴进去**
7. 左上角返回保存

脚本会自动：
- 读 `/sdcard/MavisReminder/apps.json`
- 对每个 APP 查 `dumpsys package <pkg> | grep lastUpdateTime`
- 设置全局变量 `%APP_RESULT` / `%APP_SHOULD_NOTIFY` / `%APP_NOTIFY_LIST`
- 4 小时去重 + 跨天重置

---

## 建通知任务

1. **TASKS** → **+** → 名字：`App Reminder Notify`
2. 加 Action **Alert → Notify**：
   - **Title**: `⏰ 该打卡了`
   - **Text**:
     ```
     今天还没打开过：
     %APP_NOTIFY_LIST
     ```
   - **Priority**: 5（高）
   - **Category**: Reminder
3. 加 Action **App → Launch App**（点通知打开第一个没打开的 APP）：
   - 留空或在脚本里指定
4. 保存

---

## 建 Profile（触发器）

1. **PROFILES** 标签 → **+**
2. 选 **Event → Display → Display Unlocked**
3. 关联到 `App Reminder Detector` 任务
4. **Exit Task** 选 `(none)`

任务链：
```
[Profile: Display Unlocked]
   ↓ 每次解锁屏幕
[Task: App Reminder Detector]
   1. JavaScriptlet (app-detector.js)
        → 读 /sdcard/MavisReminder/apps.json
        → 查每个 APP 今天 lastUpdateTime
        → 设置 %APP_RESULT / %APP_SHOULD_NOTIFY / %APP_NOTIFY_LIST
   2. If %APP_SHOULD_NOTIFY ~ 1
        → Perform Task: App Reminder Notify
```

---

## 加判断和通知

1. 任务编辑器 → 选 `App Reminder Detector`
2. JavaScriptlet 之后 → 点 **+** 加 Action
3. 选 **Task → If**
4. **Condition**: `%APP_SHOULD_NOTIFY ~ 1`
5. If 块**里面**加 Action：
   - **Task → Perform Task** → 选 `App Reminder Notify`

---

## 调试

### 测试 1：跑一次看效果

1. Tasker 主界面 → **TASKS** 标签
2. 找 `App Reminder Detector` → 点右边 ▶️
3. 看右下角 flash 提示：
   - `所有 APP 今天都已打开 ✓` = OK
   - `N 个 APP 今天没打开，需要通知` = OK
   - `N 个 APP 今天没打开，但 4h 内已提醒过` = OK
   - `读不到 /sdcard/MavisReminder/apps.json` = 没推到手机

### 测试 2：看变量

1. Tasker 主界面 → **VARS** 标签
2. 搜 `APP_`，应该看到：
   - `%APP_RESULT` = `all_opened` / `some_not_opened` / `error`
   - `%APP_OPENED_TODAY` = "快手极速版"
   - `%APP_NOT_OPENED_TODAY` = "微信"
   - `%APP_SHOULD_NOTIFY` = 1 / 0
   - `%APP_NOTIFY_LIST` = "微信、钉钉"

### 测试 3：PC 端测通知

PC 端跑 `MavisReminder.ps1`，点「🧪 测试提醒」按钮，手机下拉通知栏应看到「MavisReminder 测试提醒」。这能验证 adb 通知通道 OK。Tasker 通知是不是能发，是另外一回事。

---

## 进阶：Quick Settings Tile

1. Tasker → **TASKS** → 长按 `App Reminder Detector` → **Add to Quick Settings**
2. 通知栏下拉 → 编辑 → 拖出 Tasker 磁贴
3. 点一下 → 主动跑一次检测

---

## 已知限制

| 限制 | 影响 | 解决 |
|------|------|------|
| Tasker 被系统杀 | 不会触发 | 白名单全套 |
| 打开后立刻关掉 | 还是会通知（lastUpdateTime 已更新） | 接受 |
| 一天内多次解锁 | 不会刷屏（4h 去重） | 接受 |
| 跨午夜 | 通知会被重置（last_notify=0） | 已实现 |
| 改了 PC 端 apps.json 没重推 | 手机端还是旧列表 | 改了就重跑 MavisReminder |
