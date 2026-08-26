# Tasker 调度配置手册

> 目标:把 `signin-smart.js` 挂到 Tasker 上,实现"每天 08:00 自动打卡,失败自动重试,失败彻底再发兜底通知"的三层保险机制。
>
> **前置条件**:你已经按 `setup-guide.md` 配完了 MagicOS 10 后台白名单,AutoX.js 能手动跑通。本文档只讲 Tasker 这边的配置。
>
> **本文件依赖的脚本约定**:`signin-smart.js` 跑完后会向 `/sdcard/kuaishou-signin-logs/state.json` 写入结果(Tasker 通过读这个文件判断成败),字段格式见第 7 节。

---

## 0. 调度总览

我们建 **3 个 Profile + 1 个引导 Profile(开机恢复)**,逻辑如下:

```mermaid
flowchart TD
    A["⏰ 08:00<br/>Profile 1 触发"] --> B["执行 signin-smart.js"]
    B --> C["signin-smart.js 写 state.json"]
    C -->|status=success| D["重置 %attempts=0<br/>📲 通知:签到成功"]
    C -->|status=already_done| D2["📲 通知:今日已签<br/>重置 %attempts=0"]
    C -->|status=failed| E["📲 通知:签到失败<br/>进入等待重试"]
    E --> F["⏰ 08:30 / 09:00 / 09:30 / ...<br/>Profile 2 触发"]
    F --> G{"读 state.json<br/>status=failed<br/>且 %attempts < 3?"}
    G -->|是| H["%attempts + 1<br/>再跑一次 signin-smart.js"]
    H --> C
    G -->|否| I["停止重试<br/>(要么成功,要么已试 3 次)"]
    I --> J["⏰ 20:00<br/>Profile 3 触发"]
    J --> K{"state.status<br/>== success?"}
    K -->|是| L["✅ 静默,不发通知"]
    K -->|否<br/>(failed / 文件不存在 / 状态异常)| M["📲 通知:<br/>今日签到失败,请手动补卡"]
```

### Profile 清单

| 编号 | 名称 | 触发条件 | 任务 |
|------|------|----------|------|
| 0 | `Boot Restore` | 开机事件 `Event → Device Boot` | 恢复 %attempts,确保后面 3 个 Profile 在线 |
| 1 | `08:00 触发打卡` | Time → 08:00 每天 | 执行 `执行打卡` + 重置 %attempts |
| 2 | `失败重试` | Time → 08:30 起每 30 分钟重复(到 18:00) | 读 state.json,失败且 %attempts<3 就再跑 |
| 3 | `20:00 兜底` | Time → 20:00 每天 | 读 state.json,失败发通知 |

---

## 1. 第 1 步:装 Tasker + 基础配置

### 1.1 装 Tasker(简述)

- Google Play 搜 "Tasker"(需要谷歌框架,约 ¥30)
- 或者华为应用市场 / 百度搜 "Tasker 安卓",认准开发者是 **Crafty Apps**
- 装好后**不要急着建 Profile**,先把基础权限开好

### 1.2 必开权限(Tasker 这边补的 3 件)

`setup-guide.md` 已经讲了 AutoX.js 和 Tasker 的 6 件白名单,这里只补 Tasker 单独需要的、容易漏的 3 件:

#### ① 通知权限
```
设置 → 通知 → 应用通知管理 → Tasker
   → 把 "允许通知" / "横幅" / "锁屏" / "响铃" 全部打开
```
> 不开的话,Tasker 跑任务和发通知都会被静音,你以为没触发,其实是没声音。

#### ② 电池 / 后台允许
```
设置 → 电池 → 应用启动管理 → Tasker
   → "自动启动" / "关联启动" / "后台运行" 三个全开
设置 → 电池 → 更多电池设置 → 电池优化
   → 切到"所有应用" → Tasker → 选"不优化"
```

#### ③ 开机自启
```
设置 → 应用 → 应用管理 → Tasker
   → 拉到最底下 → "自启动" 开关打开
```
> Tasker 默认是开的,但 MagicOS 10 会偷偷重置,装完先确认一次。

### 1.3 必开 Tasker 内部开关

打开 Tasker → **右上角三道杠菜单** → **更多** → **设置**:

| 设置项 | 选什么 | 原因 |
|--------|--------|------|
| **前台服务** | 开启(显示常驻通知) | 防止 Tasker 被系统秒掉 |
| **使用情况统计** | 允许(系统会弹窗) | Tasker 用它监听时间事件,没开就不准 |
| **忽略电池优化** | 点击,跳到系统设置选"允许" | 同 setup-guide 3.2 |
| **辅助功能** | 允许(Tasker 高级触发要这个) | 后面如果想加"亮屏触发"才需要,现在不勾也行 |

完成后 Tasker 主界面应该能看到顶栏多了一个 **Tasker 常驻通知**(可以下拉看到)。看到这个 = 基础配置齐了。

---

## 2. 第 2 步:建 Task "执行打卡"

Tasker 的 "Task" 就是一段可执行动作,我们建一个名字叫 **"执行打卡"** 的任务,负责启动 AutoX.js 去跑 `signin-smart.js`。

### 2.1 创建任务

1. 打开 Tasker
2. 底部 Tab 切到 **"任务(TASKS)"**
3. 底部右下角点 **"+"**
4. 输入名字:**执行打卡** → 点对号 ✓
5. 进入任务编辑界面,底部点 **"+"** 加 Action
6. 弹出的 Action 分类选 **"脚本(JavaScript)"** 或 **"代码 / Run Shell"**(下面两种方式任选)

### 2.2 方式 A(推荐):用 AutoX.js deeplink 启动脚本

> AutoX.js 6.x 支持 `autojs://` 协议,可以直接拉起指定脚本。
> **前提**:AutoX.js 必须是 6.0+ 版本(从 GitHub release 装的最新版基本都支持)。

#### 步骤

1. 加 Action → 分类:**代码(Code)** → **Run Shell**
2. **命令(Shell Command)** 框里填:
   ```bash
   am start -a android.intent.action.VIEW \
     -d "autojs://run?path=/sdcard/kuaishou-signin-logs/signin-smart.js" \
     org.autojs.autojs
   ```
3. **勾选 "Use Root"(可选)**:如果你的 AutoX.js 装在 /data/app 下没 root 不影响,intent 不需要 root
4. 点左上角 **返回键 ←** 保存

#### 为什么不传完整路径问题

- `/sdcard/kuaishou-signin-logs/signin-smart.js` 这个路径约定是项目定的,见 setup-guide.md 第 4 步
- 如果你把脚本放别处了(比如 AutoX.js 项目目录 `/sdcard/脚本/kuaishou-signin/`),把路径替换成实际的就行

#### 验证 deeplink 是否通

- 在手机上浏览器地址栏直接输入 `autojs://run?path=/sdcard/kuaishou-signin-logs/signin-smart.js` 回车
- 如果 AutoX.js 弹出来问"是否运行脚本" = 通
- 如果弹出"找不到应用" = 你的 AutoX.js 版本不支持,改用方式 B

### 2.3 方式 B(兜底):用 shell + am start 拉起 AutoX.js 主界面

如果 deeplink 不通(老版本 AutoX.js),用这个:

1. 加 Action → **代码** → **Run Shell**
2. **命令**:
   ```bash
   am start -n org.autojs.autojs/.ui.main.MainActivity
   ```
3. 保存

#### 方式 B 的局限

- 这种方式只能**打开 AutoX.js 主界面**,不会自动跑脚本
- 你需要提前在 AutoX.js 里把 `signin-smart.js` **长按 → 设为"开机自启脚本"** 或加到 **"项目"** 列表的最上面
- 然后再用 AutoX.js 自带的 **"定时任务" / "文件触发"** 来间接执行

> ⚠️ 方式 B 是兜底,日常用方式 A。如果 A 在你机器上不工作,在 README 或群里反馈。

### 2.4 任务里加一个"写日志"步骤(可选但推荐)

为了排查 "到底跑没跑",在 Run Shell 后面**再加一个 Action**:

1. 点任务里 Run Shell 这个 Action 下面空白处 → "+"
2. 选 **"文件"** → **"写文件(Write File)"**
3. 配置:
   - **文件(File)**:`/sdcard/kuaishou-signin-logs/tasker.log`
   - **文本(Text)**:`%DATE %TIME - Tasker triggered 执行打卡\n`
   - **追加模式(Append)**:**勾选**(不勾会覆盖)
4. 保存

这样 Tasker 每次触发都会在 tasker.log 留一行,跟 signin-smart.js 自己的 signin.log 对照看,排查更方便。

### 2.5 测试这个 Task

- 任务编辑界面顶部有个 **▶ 播放按钮**(Play)
- 点一下,如果 AutoX.js 弹出来 = 任务跑通了
- 如果没弹 → 去看 `tasker.log` 有没有写入(没写就是 Tasker 本身没执行,有问题)

---

## 3. 第 3 步:建 Profile 1 — 每天 08:00 触发

> 主力 Profile,负责每天准时拉起签到。

### 3.1 建 Profile

1. 底部 Tab 切到 **"配置文件(PROFILES)"**
2. 右下角点 **"+"**
3. **触发条件选 "时间(Time)"**
4. 配置:
   - **"从(From)"**:点时间,设 **08:00**
   - **"到(To)"**:可以不填(或填 08:01,我们只触发一次)
   - **重复(Repeat)**:**勾选** ✓
5. 点左上角 ← 返回

### 3.2 关联任务

返回后会弹"选择任务":

1. 选 **"新建任务"** 或已有的 **"执行打卡"**(第 2 步建好的)
2. 选完任务会进入任务编辑界面 → 直接点 ← 返回(我们不在这加步骤,用第 2 步定义好的)
3. 此时 Profiles 列表会出现一条 **"08:00 触发打卡"**,后面带绿色闪电 ⚡ 表示已启用

### 3.3 关键设置:任务完成后停

这一步重要,决定 Profile 是不是长亮:

1. **长按** Profile 列表里 **"08:00 触发打卡"** 这条
2. 弹出菜单选 **"属性(Properties)"** 或 **"选项"**
3. 找到 **"任务结束后退出(Enforce Task Order: No / Stop On Task End)"**:
   - 看到 "Stop On Task End" 之类的选项,**勾选** ✓
4. 返回

> 没勾这个的话,Profile 会一直激活(变橙色),虽然不影响功能但容易跟其他 Profile 冲突。

---

## 4. 第 4 步:建 Profile 2 — 失败重试

> 备用 Profile,每 30 分钟检查一次 state.json,失败就再跑,最多 3 次。

### 4.1 关键变量先初始化

在 Profile 1(08:00)执行的任务 **"执行打卡"** 开头,**加一个 Action**:把 `%attempts` 重置成 0。

> 不然上次失败留下的数字会干扰今天。

#### 步骤

1. 打开任务 **"执行打卡"**
2. 在 **最上面**(第 1 个 Action 之前)点 **+** 加 Action
3. 选 **"变量(Variable)"** → **"变量设置(Variable Set)"**
4. 配置:
   - **名称(Name)**:`%attempts`
   - **到(To)**:`0`
5. 保存

这样每次 Profile 1 触发(每天 08:00 一次),都会先把 %attempts 归零,今天就能重试 3 次。

### 4.2 建 Profile 2

1. Profiles → **+** → 触发条件选 **"时间(Time)"**
2. 配置:
   - **"从(From)"**:**08:30**
   - **"到(To)"**:**18:00**(覆盖到下班前,白天都能补)
   - **重复(Repeat)**:**勾选** ✓
   - **每(Every)**:**30 minutes** ← 关键!这里就是"每 30 分钟"
3. ← 返回 → 关联到 **"新建任务"** → 任务名:**"失败重试检查"**

### 4.3 任务 "失败重试检查" 的步骤

进入任务编辑,加下面 4 个 Action(按顺序):

#### Action 1:读 state.json
- 类别:**文件** → **"读文件(Read File)"**
- 文件:`/sdcard/kuaishou-signin-logs/state.json`
- **到变量(To Var)**:`%state_raw`
- 勾 **"继续任务即使出错(Continue Task On Error)"**(文件不存在别让任务挂掉)

#### Action 2:判断 + 重试(用 If 结构)

- 类别:**任务(Task)** → **"如果(If)"**
- 条件(分两步设):
  - 第一个条件:`%state_raw ~R status.*failed` (用正则匹配,说明 state.json 里有 "status":"failed")
  - **并且(AND)**:`%attempts < 3`

  > ⚠️ Tasker 的条件编辑有点绕,实际操作:
  > - 点 **"+"** 加第一个条件
  > - 第一栏选 **"%state_raw"**,第二栏选 **"Matches Regex"**,第三栏填 `status.*failed`
  > - 同一个 If 里点 **"+"** 加第二个条件
  > - 顶部"如果(If)"那里把"AND"勾上(默认就是 AND)
  > - 第二栏选 **"%attempts < 3"**

- 在 **"If" 块里面**(任务编辑界面会自动加一个 End If),点 + 加子 Action:

##### If 里加的子 Action A:执行打卡
- 类别:**任务** → **"执行任务(Perform Task)"**
- 任务(Task):**"执行打卡"**
- 如果你想"如果重试任务正在跑就不重复触发",勾 **"如果任务正在运行则不执行(Stop If Already Running)"**

##### If 里加的子 Action B:%attempts 加 1
- 类别:**变量** → **"变量加(Variable Add)"**
- 名称:`%attempts`
- 值:`1`

#### Action 3:任务结尾 - If 块自动结束

Tasker 自动加 **"End If"**,不用管。

#### 完整任务结构(伪代码)

```
任务: 失败重试检查
  1. 读文件 state.json → %state_raw  [Continue on Error]
  2. If %state_raw ~R status.*failed AND %attempts < 3
       2a. Perform Task "执行打卡"
       2b. Variable Add %attempts 1
  End If
```

### 4.4 测试这个 Profile

手动测试办法:

1. 先手动跑一次 `signin-smart.js` 让它写一个 `status: failed` 的 state.json(临时改一下脚本最后写 state 的部分)
2. 把手机时间调到 08:31(或者临时改 Profile 2 触发时间到 1 分钟后)
3. 等触发,看 AutoX.js 会不会再跑一次
4. 看 `tasker.log` 有没有第二次触发的记录

---

## 5. 第 5 步:建 Profile 3 — 兜底提醒

> 每天 20:00 晚上,如果今天还没签成功,主动推一条通知"今日手动补卡"。

### 5.1 建 Profile

1. Profiles → **+** → **"时间(Time)"**
2. 配置:
   - **"从"**:**20:00**
   - **"到"**:**20:01**(只触发一次)
   - **"重复"**:**勾选** ✓
3. ← 返回 → 关联到 **"新建任务"** → 任务名:**"兜底检查"**

### 5.2 任务 "兜底检查" 的步骤

#### Action 1:读 state.json
- **文件** → **"读文件"**
- 文件:`/sdcard/kuaishou-signin-logs/state.json`
- 到变量:`%state_today`
- **勾 "Continue On Error"**(文件不存在时 tasker 别挂)

#### Action 2:判断今天是否成功

- 类别:**任务** → **"如果"**

**条件组一:文件不存在 或 状态不是 success**

> Tasker 的变量 `%state_today` 在文件读不到时会是空,所以两个条件都加:

- 条件 1:`%state_today !~R status.*success`
  - 第一栏:%state_today
  - 第二栏:**"Matches Regex"**
  - 第三栏:`status.*success` ← 注意前面加 **"!"** 是不匹配

- **或者(OR)**(把条件 1 那个 + 旁边的"AND"切到"OR"):
  - 条件 2:`%state_today ~ <空>` 或者 `%state_today` 是空(Tasker 变量不存在的判断:填 `%state_today ~ %` 或者直接 `%state_today matches` 空)

  > 实操:第二个条件设 `%state_today !Set`(变量未设置)或者 `%state_today` 用 `~` 跟空字符串匹配

  简单粗暴的写法:**只要 "%state_today matches regex status.*success" 不成立,就视为没成功**。

#### If 块里:发通知
- 类别:**通知(Alert)** → **"通知(Notify)"**
- 标题(Title):**⚠️ 今日签到失败**
- 文字(Text):**快手极速版 365 天打卡失败,请手动补卡(打开快手 → 我 → 打卡免费拿)**
- 图标(Icon):可选,选个警告图标
- 优先级(Priority):**高(5)**(让通知能横幅弹)

#### If 块里再加:发到日志
- **文件** → **"写文件(Append)"**
- 文件:`/sdcard/kuaishou-signin-logs/tasker.log`
- 文本:`%DATE %TIME - 兜底通知已发送(今日签到失败)\n`

#### If 块结束(自动)

#### 完整结构

```
任务: 兜底检查
  1. 读文件 state.json → %state_today  [Continue on Error]
  2. If %state_today !~R status.*success
       2a. Notify "⚠️ 今日签到失败" "快手极速版 365 天打卡失败..."
       2b. 写日志 tasker.log
  End If
  (条件不成立 = 已经 success,什么都不做,静默)
```

### 5.3 测试

1. 把手机时间调到 20:01(或临时改 Profile 时间)
2. 先让 state.json 写成 `{"status":"failed"}` → 应该看到通知弹出
3. 再让 state.json 写成 `{"status":"success"}` → 应该没通知

---

## 6. state.json 路径与字段约定

> 这条约定 `signin-smart.js` 必须遵守,Tasker 全部判断都靠读这个文件。

### 6.1 路径

```
/sdcard/kuaishou-signin-logs/state.json
```

> 这是单一文件,每次跑完 `signin-smart.js` **整体覆盖写**(不是追加)。Tasker 永远读最新一次的状态。

### 6.2 字段

```json
{
  "last_signin_date": "2026-08-08",
  "status": "success",
  "ts": 1723084800,
  "error": ""
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `last_signin_date` | string (YYYY-MM-DD) | 是 | 脚本执行当天的日期(本地时区) |
| `status` | enum | 是 | 三个值之一:`success` / `failed` / `already_done` |
| `ts` | number (epoch 秒) | 是 | 脚本完成时的时间戳 |
| `error` | string | 否 | 失败时的错误描述,成功时为空字符串 |

### 6.3 status 取值含义

| status | Tasker 反应 |
|--------|-------------|
| `success` | ✅ Profile 1 任务完成,Profile 2 看到 success 不重试,Profile 3 静默 |
| `already_done` | ✅ 已在快手极速版手动签过了,Profile 1 任务算成功,Profile 2/3 静默 |
| `failed` | ❌ Profile 2 启动重试机制(最多 3 次),Profile 3 兜底发通知 |

### 6.4 字段写入逻辑(给 signin-smart.js 作者参考)

```
脚本开始   → 不写 state.json(或保留上次)
跑成功     → 覆盖写 status: success
检测到已签 → 覆盖写 status: already_done
任何失败   → 覆盖写 status: failed, error: 错误信息
```

### 6.5 字段命名规范提示

- 字段名 **统一用 snake_case**(`last_signin_date`,不要写成 `lastSigninDate`)
- 避免 BOM 头,文件用 UTF-8 无 BOM
- 文件最后**保留一个换行符**,Tasker 读文件用正则匹配会更稳

---

## 7. 第 6 步(实际是 0 号):开机自启 + Profile 恢复

> 手机重启后,Tasker 自带的 Profile 不会自动"激活",需要监听 `Boot Completed` 事件重建。

### 7.1 建 Profile 0 — 开机恢复

1. Profiles → **+** → 触发条件选 **"事件(Event)"**
2. **类别**:**系统(System)**
3. **事件**:**设备启动(Device Boot)** 或 **"User Present"**(亮屏后触发,更稳)
   > 推荐选 **"User Present"**——有些 ROM Boot 事件触发后系统还在初始化,任务直接跑会失败
4. ← 返回 → 关联到 **"新建任务"** → 任务名:**"开机恢复"**

### 7.2 任务 "开机恢复" 的步骤

#### Action 1:初始化 %attempts
- **变量** → **"变量设置"**
- 名称:`%attempts`
- 到:`0`

#### Action 2:Toast 一行提示(便于确认触发)
- **提示(Alert)** → **"Beep / Flash"**
- 文字:`Tasker 开机恢复完成`

#### Action 3:写日志
- **文件** → **"Append"**
- 文件:`/sdcard/kuaishou-signin-logs/tasker.log`
- 文本:`%DATE %TIME - 设备开机,Tasker Profile 已就绪\n`

#### Action 4(可选):发一个"心跳通知"
- **通知** → **"Notify"**
- 标题:**Tasker 已就绪**
- 文字:**快手签到定时任务已激活(08:00 触发)**
- 优先级:**低(1)**(不打扰,但能确认触发)

### 7.3 注意:Profile 1/2/3 不需要重"激活"

- Tasker 重启后,**已经保存的 Profile 会自动重新激活**,不需要在开机任务里再 "Enable"
- 开机任务主要做的是:**变量重置 + 通知确认**,确认你"这次开机 Tasker 真的起来了"

### 7.4 验证开机恢复

1. 长按电源 → **重启**
2. 进系统后下拉通知,看有没有 "Tasker 已就绪"
3. 打开 Tasker → 看 Profile 1/2/3 是不是都带绿色闪电 ⚡

---

## 8. 常见问题

### Q1:定时到了没触发(08:00 没反应)

按这个顺序排查:

1. **看 Tasker 顶栏常驻通知在不在**——不在 = Tasker 被系统杀了,回去配白名单
2. **看 Profile 是不是带绿色闪电 ⚡**——变灰 = Profile 被禁用了,长按启用
3. **看手机的"省电模式"开了没**——MagicOS 10 一开省电,定时直接挂
4. **看 tasker.log 有没有 08:00 的记录**——没有 = Tasker 没触发;有 = Tasker 触发了但 AutoX.js 没拉起来
5. **看 signin.log 有没有 08:00 的记录**——没有 = AutoX.js 没收到拉起指令,deeplink 失败

### Q2:state.json 读不到

症状:`%state_raw` 是空的,或者 If 判断永远不成立。

排查:

1. **路径对不对**:手机文件管理器打开 `/sdcard/kuaishou-signin-logs/`,看 `state.json` 是不是真在那里
2. **权限够不够**:`/sdcard/` 在 Android 11+ 是 scoped storage,部分 ROM 要单独给 Tasker 授权:
   ```
   设置 → 应用 → Tasker → 权限 → 文件和媒体 → 选"所有文件"
   ```
3. **格式对不对**:`state.json` 必须是合法 JSON,不能是空文件、不能有 BOM 头。可以拉下来用 VSCode 打开看
4. **Tasker 读文件默认截断**:如果你读到的内容看起来"少了",把 Read File 的 **"Read To Variable"** 模式打开(勾 "Use Variable" 而不是 "Replace")

### Q3:通知不弹

按这个顺序排查:

1. **Tasker 自己的通知权限**——见 1.2 节
2. **Tasker 任务里 Notify Action 的 "Priority"**——设成 0 会被系统压;设成 5(高)才能横幅
3. **荣耀的通知黑名单**——下拉通知栏 → 长按那条通知 → "更多设置" → 看有没有被"静默"
4. **省电模式开着**——同 Q1
5. **Do Not Disturb 开着**——通知会被压,系统设置里关掉
6. **Tasker 顶栏常驻通知被划掉了**——这条划掉 = Tasker 被系统视为"未使用",后面所有通知都不弹

### Q4:Tasker 自身被 MagicOS 杀了

症状:Tasker 顶栏常驻通知消失,所有 Profile 变灰,定时完全失灵。

**最可能原因**:白名单没配全(回去看 `setup-guide.md` 第 3 步,6 件事全做了吗)。

**临时应急方案**:

- 上滑多任务卡片 → 找到 Tasker → **长按 → 锁定**
- 或者:设置 → 电池 → 应用启动管理 → Tasker → 检查三项是不是还开着(MagicOS 会偷偷重置)

**永久方案**:

- 每周日手动检查一次白名单状态(尤其是"电池优化"那项,MagicOS 经常自己改回去)
- 配合第 7 步的"开机恢复" Profile,即使被杀了重启后也能恢复

### Q5:Profile 2 重试太多次,担心耗电

如果觉得 30 分钟一次太频繁,改成 1 小时一次:

- 打开 Profile 2 → 改 **"Every"** 从 `30 minutes` 改成 `1 hour`
- 同时把重试次数从 3 改成 2(在 If 条件里把 `%attempts < 3` 改成 `< 2`)

### Q6:Profile 3 兜底通知想静默(只在状态异常时响铃)

- Notify Action 里把 Priority 设成 **1**(最低)即可只在通知栏出现,不会响铃
- 标题前缀加个 🔕 之类的 emoji,自己看一眼就行

### Q7:%attempts 变量在手机重启后丢了

正常现象,重启后 Tasker 变量会清空。

但 Profile 1(08:00)触发时会自动重置 %attempts = 0,所以**不需要担心**,重启后第二天还是 3 次机会。

如果想更稳,Profile 0(开机恢复)里也加了 %attempts = 0 的初始化。

---

## 9. 配完确认清单

按这个清单一项项过,全部 ✅ 才算配置完成:

### 脚本和文件

- [ ] `signin-smart.js` 已经放在 `/sdcard/kuaishou-signin-logs/` 下
- [ ] 手动跑过一次,确认它会写 `/sdcard/kuaishou-signin-logs/state.json`
- [ ] state.json 里的字段名是 `last_signin_date / status / ts / error`(拼写一致)

### Tasker 基础

- [ ] Tasker 装好,常驻通知在顶栏
- [ ] 白名单 6 件事配完(参见 setup-guide.md)
- [ ] Tasker 通知 / 电池 / 自启 全部允许

### 4 个 Profile

- [ ] Profile 0 `Boot Restore` — 设备启动 / User Present 触发,任务"开机恢复"
- [ ] Profile 1 `08:00 触发打卡` — Time 08:00 重复,关联任务"执行打卡"
- [ ] Profile 2 `失败重试` — Time 08:30 ~ 18:00 每 30 分钟重复,关联"失败重试检查"
- [ ] Profile 3 `20:00 兜底` — Time 20:00 重复,关联"兜底检查"

### 4 个 Task

- [ ] `执行打卡` — 头部有 `Variable Set %attempts = 0`,后面是 deeplink 拉起 AutoX.js
- [ ] `失败重试检查` — 读 state.json + If 条件 + Perform Task + Variable Add
- [ ] `兜底检查` — 读 state.json + If not success + Notify
- [ ] `开机恢复` — Variable Set + Flash + Append Log + Notify

### 联动测试

- [ ] 手动点 ▶ 跑 `执行打卡`,AutoX.js 弹出来 = OK
- [ ] 临时改 state.json 写成 failed,等 Profile 2 时间到,看会不会自动重试
- [ ] 临时改 state.json 写成 success,看 Profile 3 会不会静默
- [ ] 临时改 state.json 写成 failed,看 Profile 3 会不会发通知

**全部 ✅ 后** → 进 3 天观察期(Phase 5),每天看 `tasker.log` 和 `signin.log` 确认链路通畅。

---

## 附:配置文件之间的关系

```
┌─────────────────┐     拉起     ┌──────────────────┐
│  Tasker         │ ──────────→  │  AutoX.js        │
│  (本文件主角)   │              │  (已配 setup-    │
│                 │ ←──────────  │   guide)         │
│  - 4 个 Profile │   state.json │  - signin-       │
│  - 4 个 Task    │   /signin.log │    smart.js      │
└─────────────────┘              └──────────────────┘
        │                                │
        │ 读                              │ 写
        ↓                                ↓
   /sdcard/kuaishou-signin-logs/
   ├── state.json          ←── 状态(本文件第 6 节定义)
   ├── signin.log          ←── 脚本运行日志
   └── tasker.log          ←── Tasker 触发日志(本文件第 2.4 节配)
```

Tasker 不知道脚本内部怎么实现的,只通过 `state.json` 通信。`signin-smart.js` 不知道 Tasker 存在,只管跑完写文件。**两边解耦,任何一边升级都不影响另一边**。
