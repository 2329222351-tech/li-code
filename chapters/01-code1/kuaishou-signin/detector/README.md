# APP 提醒助手 - 一键搞定

> 每天检测指定 APP（默认含快手极速版）今天是否打开过，没打开就在系统通知栏提醒。
> **一个命令，全套搞定**。用户不需要懂 JSON、不需要懂 adb、不需要移动文件。

---

## 一分钟上手

```powershell
cd D:\gr\code1\kuaishou-signin\detector
.\MavisReminder.ps1
```

然后在浏览器里：
1. 看设备是否连上（顶部状态条）
2. 勾选要监控的 APP
3. 点 **「保存设置并推送到手机」**

想测试通知能不能到手机？点 **「🧪 测试提醒」** 立刻发一条，手机下拉通知栏就能看到。

完成。结束就关掉终端窗口（或 Ctrl+C）。

---

## 完整流程（PC + 手机）

### 一次性配置（5 分钟）

**第 1 步：手机端**
- 装 Tasker（华为/荣耀应用市场 或 Google Play）
- 首次启动给通知权限

**第 2 步：荣耀 MagicOS 10 后台白名单**
- 详见 `setup-guide.md`
- 关键：应用启动管理三开关 + 通知全开 + 最近任务锁定

**第 3 步：PC 端**
- USB 连手机，开 USB 调试，手机上点"允许"
- 跑 `.\MavisReminder.ps1`
- 浏览器自动打开，按界面提示操作

### Tasker 配置（5 分钟）

详见 `tasker-setup.md`，核心是把 `app-detector.js` 粘到 JavaScriptlet + 建 Profile「Display Unlocked」。

### 日常

什么都不用做。Tasker 后台监听，每次解锁手机自动检测，没打开就通知。

想换监控哪些 APP？再跑一次 `.\MavisReminder.ps1`，改勾选，保存。

---

## 文件清单

| 文件 | 用途 |
|------|------|
| `MavisReminder.ps1` | **★ 一键入口**：检测手机、起服务、开浏览器 |
| `MavisReminder.template.html` | UI 模板（不要直接编辑，跑脚本后生成 `app-picker.html` 已废弃） |
| `app-detector.js` | Tasker 跑的核心检测逻辑 |
| `tasker-setup.md` | Tasker 配置详细 |
| `setup-guide.md` | 荣耀后台白名单 |
| `legacy/` | 旧版手动流程脚本（已废弃，但保留以备参考） |
| `_apk_cache/` | APK 缓存（自动管理，可删） |
| `apps.json` | 用户选中的 APP 列表（自动生成，保存到手机） |

---

## 故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| 浏览器一直显示"等连接手机" | USB 没接好 / 调试没开 | 检查 USB 线 + 开发者选项 + USB 调试 + 手机点"允许" |
| 状态条变橙色"需要授权" | 电脑未授权给手机 | 手机下拉通知栏找"USB 调试授权"，点"允许" |
| 状态条变红"未找到手机" | 多个 adb 设备 | 关掉其他模拟器，只留真机；或跑 `adb devices` 看 |
| 点了"测试提醒"手机没反应 | 系统通知权限被禁 | 设置 → 应用 → Tasker → 通知 → 全部允许 |
| 点了"保存"但没反应 | 设备断开 / apk 太大 | 看终端报错；或换根 USB 线 |
| 中文 APP 名显示成 `?` | aapt2 编码问题（已知，自动 `chcp 65001`） | 重启 MavisReminder.ps1 |
| 端口 8765 被占 | 之前的进程没释放 | 用 `-Port 9999` 或别的 |

---

## 技术细节（知道就好）

### 检测端（手机上）
1. Tasker 监听 `Display Unlocked` 事件
2. 触发 `app-detector.js` JavaScriptlet
3. 脚本读 `/sdcard/MavisReminder/apps.json`
4. 对每个 APP 跑 `dumpsys package <pkg> | grep lastUpdateTime`
5. 对比今天 0 点时间戳
6. 设置 Tasker 全局变量：`%APP_RESULT` / `%APP_SHOULD_NOTIFY` / `%APP_NOTIFY_LIST`
7. 4 小时去重 + 跨天重置

### PC 端架构
- `MavisReminder.ps1` 起一个 `HttpListener` 在 localhost:8765
- HTML 通过 fetch() 调用 4 个 API：
  - `GET /api/status` - 设备连接状态
  - `GET /api/apps` - 拉 APP 列表（拉 APK + aapt2 拿中文名）
  - `POST /api/save` - 写本地 + 推到手机
  - `POST /api/test` - 触发 `cmd notification post` 发测试通知

---

## 设计原则

- **一个命令**：用户只跑 `MavisReminder.ps1`
- **零概念**：HTML 里看不到 JSON、adb、push 这些词
- **零文件操作**：用户不接触文件移动、路径
- **自带测试**：测试按钮立刻验证通知能不能到
- **错误友好**：手机没接好、没授权、APK 损坏... 都有明确的中文提示
