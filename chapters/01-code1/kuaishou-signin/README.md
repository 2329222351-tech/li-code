# 快手 365 天打卡项目

> 检测 + 提醒方案：每天检查快手等 APP 是否打开过，没打开就在通知栏提醒。
> **零风险**：只检测不操作，不会被反作弊。

---

## 🎯 首选方案：APK（自包含，单文件）

**完全摆脱 PC + Tasker + AutoX.js**，装一个 APK 就完事。

📦 **APK 位置**：`D:\gr\MavisReminder.apk` (33 KB)
📖 **详细说明**：[apk-build/README.md](apk-build/README.md)

直接把 APK 传到手机点开安装，开 APP 勾选要监控的 APP，点保存。每天解锁手机时会自动检测，没打开就发通知。

---

## 备选方案：PC 工具 + Tasker（更花哨，能改东西）

> 适合喜欢折腾 / 想加自定义逻辑的人。

### 当前进度

- **目标**：第 52 / 365 天（已坚持 51 天，不能断）
- **方案**：检测 `dumpsys package <pkg> | grep lastUpdateTime`（无 root 无需特殊权限）
- **触发**：Tasker 监听「Display Unlocked」事件
- **通知**：4 小时去重 + 跨天重置

> **为什么不做"自动签到"了**？快手反作弊把号搞了。改成"提醒我手动签"——风险为 0。

---

## 5 分钟上手

### PC 端

```powershell
cd D:\gr\code1\kuaishou-signin\detector
.\MavisReminder.ps1
```

浏览器自动打开。点勾选 → 点保存。结束。

### 手机端（一次性）

1. 装 **Tasker**（华为/荣耀应用市场 或 Google Play）
2. 配荣耀后台白名单（见 `setup-guide.md`）
3. Tasker 里建 1 个 JavaScriptlet + 1 个 Profile（见 `detector/tasker-setup.md`）

---

## 目录

```
kuaishou-signin/
├── README.md                      # 本文件
├── setup-guide.md                 # 荣耀后台白名单
├── troubleshooting.md             # 排错指南
├── detector/                      # ★ 核心：一键启动
│   ├── MavisReminder.ps1          # ★ 一个命令搞定
│   ├── MavisReminder.template.html # UI 模板
│   ├── app-detector.js            # Tasker 跑的核心脚本
│   ├── tasker-setup.md            # Tasker 配置
│   ├── README.md                  # detector 详细文档
│   ├── legacy/                    # 旧版手动脚本（已废弃）
│   └── _apk_cache/                # APK 缓存（可删）
├── explore.js                     # 旧版 UI 探索
├── signin.js                      # 旧版自动签到
├── signin-smart.js                # 旧版智能签到
└── emulator-guide.md              # 模拟器使用（旧）
```

---

## 日常使用

什么都不用做。Tasker 后台监听，每次解锁手机自动检测，没打开就通知。

想换监控哪些 APP？再跑 `.\MavisReminder.ps1`，改勾选，保存。

---

## 故障排查

| 症状 | 解决 |
|------|------|
| 浏览器一直"等连接手机" | 检查 USB 线 + 开发者选项 + USB 调试 + 手机点"允许" |
| 状态条变橙色"需要授权" | 手机下拉通知栏找"USB 调试授权"，点"允许" |
| 点了"测试提醒"手机没通知 | 设置 → 应用 → Tasker → 通知 → 全部允许 |
| Tasker 不触发 | 配荣耀白名单（见 setup-guide.md） |

详见 `troubleshooting.md`。

---

## 设计原则

- **一个命令**：用户只跑 `MavisReminder.ps1`
- **零概念**：HTML 里看不到 JSON、adb、push
- **零文件操作**：用户不接触文件移动、路径
- **自带测试**：测试按钮立刻验证通知能不能到
- **错误友好**：手机没接好、没授权... 都有明确提示
