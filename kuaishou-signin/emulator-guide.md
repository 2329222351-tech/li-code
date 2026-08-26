# 模拟器测试手册

> 目的：在 Windows 电脑上用安卓模拟器先跑通脚本逻辑，**避免直接在真机上乱搞**导致 52 天 streak 断掉。

---

## 模拟器 vs 真机：测什么不测什么

| 测什么 | 测什么 |
|--------|--------|
| ✅ 脚本找签到按钮准不准 | ❌ MagicOS 10 杀后台机制（模拟器没这个） |
| ✅ 点击流程是否跑通 | ❌ 通知能不能正常弹（模拟器通知跟真机不同） |
| ✅ 已签到检测逻辑 | ❌ Tasker 定时能否触发（模拟器一般不会被杀） |
| ✅ 失败/重试逻辑 | ❌ 自启动、电池白名单的实际效果 |

**结论**：模拟器只能验脚本逻辑，**真机白名单是另一道关，必须再过一遍**。

---

## 第 1 步：选模拟器

### 🏆 推荐：蓝叠（BlueStacks）

- 下载：https://www.bluestacks.com/download.html
- 优点：
  - 装国产 APP 兼容好（快手极速版能跑）
  - 一键装，开箱即用
  - 性能不错
  - 国外主流模拟器，社区资料多
- 缺点：
  - 默认有广告（设置里能关）
  - 占用资源中

### 备选 1：夜神（NoxPlayer）

- 下载：https://www.yeshen.com/
- 优点：国内老牌，资料多
- 缺点：UI 略乱

### 备选 2：雷电模拟器

- 下载：https://www.ldplayer.net/
- 优点：游戏性能强
- 缺点：自动化场景配置稍麻烦

### ❌ 不推荐：Android Studio 模拟器

虽然开发者首选，但：
- 默认 x86 镜像装不上快手极速版（快手只有 arm64 native）
- ARM 镜像性能极差
- 配置复杂，**不必要**

---

## 第 2 步：装蓝叠

1. 下载蓝叠 5（最新版）
2. 双击安装
3. 安装过程会自动：
   - 启用 Hyper-V（需要重启）
   - 装安卓 9/11/12 镜像
4. 重启电脑（如果提示）
5. 打开蓝叠

**注意**：蓝叠默认装在 `C:\ProgramData\BlueStacks_nxt`，如果 C 盘不够可以装到 D 盘。

---

## 第 3 步：模拟器内配置

### 3.1 系统设置

1. 打开蓝叠 → 右上角"设置"或齿轮
2. 推荐配置：
   - **性能** → 分配 **4 核 CPU + 4GB 内存**（脚本调试不吃资源，4G 够）
   - **显示** → 分辨率 **1080×1920**（模拟主流手机）
   - **其他** → 开启"ADB 调试"

### 3.2 安装必要 APP

1. **装快手极速版**
   - 蓝叠自带应用中心 → 搜"快手极速版" → 装
   - 或者：浏览器下载快手极速版 APK → 双击装（蓝叠会自动接管）
   - **登录你自己的快手账号**（用手机号验证码登录）

2. **装 AutoX.js**
   - 浏览器打开 https://github.com/yuezy3/AutoX/releases
   - 下载 `app-universal-release.apk`（最大兼容）
   - 用 adb install 安装（雷电/夜神 拖 APK 经常不响应，**用 adb 最稳**）：
     ```powershell
     # 假设雷电装在 D:\leidian\LDPlayer9
     $adb = "D:\leidian\LDPlayer9\adb.exe"
     & $adb connect 127.0.0.1:5555
     & $adb install -r "D:\gr\code1\kuaishou-signin\app-universal-release.apk"
     ```
   - 打开 AutoX.js

3. **打开无障碍服务**
   - 蓝叠里打开 AutoX.js → 弹权限
   - 蓝叠的"无障碍"开启：
     - 蓝叠桌面 → 设置 → 辅助功能 → AutoX.js → 打开
     - 或者：直接装个"无障碍开启"小工具

---

## 第 4 步：把脚本传到模拟器

### 方式 1：共享文件夹（推荐）

蓝叠默认有"共享文件夹"功能：
- Windows 路径：`C:\Users\<你的用户名>\Documents\BlueStacks_nxt\`
- 在模拟器里：文件管理器 → "/sdcard/windows" 或 "BstSharedFolder"
- 把 `explore.js` 和 `signin.js` 拖到这个文件夹
- 在 AutoX.js 里就能直接打开

### 方式 2：ADB push

```powershell
# 假设 adb 已加入 PATH
adb devices  # 看蓝叠是否连上
adb push "D:\gr\code1\kuaishou-signin\explore.js" /sdcard/Download/
```

### 方式 3：直接复制到模拟器粘贴板

- 蓝叠右侧工具栏有"复制粘贴到手机"
- 复制脚本内容 → 粘贴到 AutoX.js 的代码编辑区

---

## 第 5 步：跑 explore.js

1. 蓝叠里打开快手极速版 → **先登录** → 关闭
2. 打开 AutoX.js → 打开 `explore.js`
3. 点 ▶️ 运行
4. 观察：
   - 蓝叠里能看到快手极速版被启动
   - 页面会被脚本自动点击
   - 截图会保存到 `/sdcard/kuaishou-signin-logs/`
5. 跑完会弹通知"UI 探索完成"

---

## 第 6 步：把结果取出来

### 方式 1：蓝叠文件管理器

1. 蓝叠 → 桌面"文件"或"ES 文件浏览器"
2. 路径：`/sdcard/kuaishou-signin-logs/`
3. 选中文件 → 分享/复制到共享文件夹
4. 在 Windows 的 `Documents\BlueStacks_nxt\windows` 里能看到

### 方式 2：截图快捷键

- 蓝叠默认截图快捷键：`Ctrl + Shift + S`（或 F12，看版本）
- 截图直接存到 Windows 剪贴板，粘贴到聊天框发我

### 方式 3：AD pull

```powershell
adb pull /sdcard/kuaishou-signin-logs "D:\gr\code1\kuaishou-signin\emulator-output\"
```

---

## 第 7 步：跑通 signin.js

1. 把 `explore.js` 的输出（截图 + 日志）发给我
2. 我根据 UI 精写 `signin.js`
3. 在模拟器里跑 `signin.js`
4. 观察是否能完成签到
5. **如果模拟器里能跑通** → 你就有信心上真机了

---

## 🚀 现在开始

1. 装蓝叠（10 分钟）
2. 装快手极速版 + 登录你自己的号
3. 装 AutoX.js
4. 把 `explore.js` 传到模拟器
5. 跑起来
6. 把日志/截图发我

**遇到问题随时截图**。模拟器里出问题比真机好解决，至少 52 天的 streak 不会断。
