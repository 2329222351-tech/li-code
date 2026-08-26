# 快速开始 - 你现在要做的

## 步骤 1：装两个 APP（10 分钟）

- **AutoX.js**：https://github.com/kkevsek/autoX/releases → 下载 arm64 APK 安装
- **Tasker**：Google Play 或国产市场搜"Tasker"装

## 步骤 2：配白名单（15-20 分钟）

打开 `setup-guide.md`，照着做完 6 件事。

## 步骤 3：测试 AutoX.js 能跑

1. 打开 AutoX.js
2. 点 + → 写 `toast("hello");` → 保存 → 运行
3. 应该看到 "hello" 弹出来
4. ✅ = AutoX.js 跑通了

## 步骤 4：跑 explore.js（5 分钟）

1. 把 `explore.js` 复制到手机（微信传文件 / USB 拷贝都行）
2. AutoX.js 打开 `explore.js` → 点运行
3. 脚本会自动：
   - 启动快手极速版
   - 截图 + 记录所有 UI 文本
   - 找打卡入口并尝试点进去
   - 截图 + 记录
   - 结束

## 步骤 5：把结果发给我

1. 打开 AutoX.js → 菜单 → 文件管理
2. 进入 `/sdcard/kuaishou-signin-logs/` 目录
3. 把里面的：
   - 所有 `screen_*.png` 截图
   - `explore.log` 日志文件
4. 通过微信/QQ 传到电脑发给我

## 我收到后会做什么

我会：
1. 看你日常点开"打卡免费拿"的真实路径
2. 精写 `signin.js` 适配你手机的具体 UI
3. 再让你手动跑一次确认能签到
4. 写 `tasker-config.md` 教你怎么挂定时任务

---

## 现在可以开始了

有任何一步卡住，把现象截图给我，我帮你看。
