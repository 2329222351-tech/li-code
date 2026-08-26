# li-code

> 日常神秘玩意 —— 个人项目代码合集与备份

这里是 `D:/gr/code1/` 目录的快照备份。
每次重要节点手动同步一次，不做自动同步（避免把运行时产物 / 缓存误传）。

## 目录结构

```
li-code/
├── code1/
│   ├── MavisReminder.apk        # Android 定时提醒 APP（已签名）
│   ├── kuaishou-signin/         # 快手自动签到工具（Auto.js + 模拟器）
│   └── termux-tasker-master/    # termux-tasker 上游源码备份
└── README.md
```

## 项目说明

### kuaishou-signin
基于 Auto.js / autojs-v7 的快手自动签到脚本，配合安卓模拟器（雷电/LDPlayer）使用。

- `signin.js` / `signin-smart.js`：核心签到逻辑
- `explore.js`：自动逛视频 / 刷任务
- `detector/`：UI 元素检测辅助
- `install-to-emulator.ps1` / `push-and-run.ps1`：模拟器部署脚本
- 依赖：AutoX.js v7、雷电 9 / LDPlayer 9

### termux-tasker-master
[termux/termux-tasker](https://github.com/termux/termux-tasker) 上游源码本地备份，
用于在 Tasker 里调用 Termux 脚本。Gradle 项目，可独立构建。

### MavisReminder.apk
Mavis 提醒 APP 的已签名 APK，可直接安装到 Android 13+ 设备。

## 同步原则

备份时**不包含**以下内容（已通过 `.gitignore` 排除）：

- `kuaishou-signin/downloads/`：原始 APK 包（autojs、快手 nebula 等，~227MB）
- `kuaishou-signin/detector/_apk_cache/`：UI 元素检测缓存 APK（~229MB）
- `kuaishou-signin/{logs,debug,apk-build}/`：运行时日志、调试截图、中间编译产物
- `__pycache__/`、`node_modules/`、`.gradle/`、`build/` 等构建产物

> 顶层 `MavisReminder.apk`（项目产物）保留。

## 本地源目录

```
D:/gr/code1/
```

## 注意事项

- `termux-tasker-master/` 是上游开源项目源码，保留仅供本地参考，**不修改后回传**。
- 仓库是 **Public**，请勿提交任何含密钥、token、个人隐私的内容。
- 提交前手动 review，**不要**把 `.env`、`*.key` 等文件加进去。
