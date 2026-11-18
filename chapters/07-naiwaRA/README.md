# 07-naiwaRA · 奶蛙：午夜奶厂

> PS1 风格三幕叙事恐怖游戏的可玩 HTML 原型。纯前端，Three.js 经典脚本版，无需构建、无需联网。

## 怎么跑

双击 `index.html` 可直接打开，但 GLB 模型与音频走的是相对路径加载，**建议用本地 HTTP 服务**：

```bash
cd chapters/07-naiwaRA
python -m http.server 8899
# 浏览器打开 http://127.0.0.1:8899/index.html
```

启动页选一幕进入：ACT I 醒奶区 / ACT II 发酵区 / ACT III 主奶泵室。

## 文件

| 文件 | 说明 |
| --- | --- |
| `index.html` | 主场景，单文件承载三幕关卡、HUD、PS1 后处理与剧情判定（约 2900 行） |
| `interaction_lab.html` | 道具交互实验台，单独调试拾取 / 使用 / 反馈 |
| `motion_demo.html` | 角色运动演示，6 个 GLB 切换状态 + 眼睛追踪 |
| `assets/` | 角色与道具 GLB、Blender 源文件、45 个 WAV 音效及清单 |
| `vendor/` | `three.min.js` + `GLTFLoader.js`（本地化，不依赖 CDN） |
| `剧情小说与结局分章.md` | 三幕推进与七个结局的小说化文本 |
| `场景设计与提示词.md` | 场景设定与美术提示词 |
| `角色运动逻辑.md` | 动效层说明：只改 position / rotation / scale，不碰材质与判定 |
| `.build_*.py` / `.render_*.py` / `.probe_*.py` | 模型与音效的构建、渲染、量测脚本（本地工具，非运行时依赖） |

## assets 明细

- `assets/nailong_data.js`：奶龙 GLB 的 base64 内嵌数据（约 1.2MB），页面可直接引用
- `assets/*.glb`：`milkfrog_no13`（主角）、`milkfrog_cast`、`clone_frogs`、`frog_god`、`milking_spider`、`moo_vending`、`pigeon`、`milk_slime`
- `assets/*.blend`：Blender 源文件（主角、奶龙、角色组）
- `assets/char_motion.js`：角色运动模块，导出 `window.CharMotion`
- `assets/interaction.js`：交互层
- `assets/audio/`：45 个 WAV，按 `ambience` / `creatures` / `events` / `objects` / `player` 分类，`manifest.js` 为索引
- `assets/audio/音效试听.html`：音效逐个试听页

## 说明

原型阶段产物，三幕场景与剧情已可跑通，交互与判定仍在迭代。
美术规格与剧情设定以仓库内三份 Markdown 文档为准。
