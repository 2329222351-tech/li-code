# 奶娃 Nailoong · Blender 3D 模型

一个用 Blender 做的黄色小龙「奶龙 / Nailoong」模型，附带一份**手把手导入教程**。
面向第一次打开 Blender 的人写，每一步都尽量写细，跟着点就行。

![模型预览](preview.png)

---

## 一、这是什么东西

| 项目 | 说明 |
|------|------|
| 模型文件 | `nailong_colored.blend` |
| 适用软件 | Blender **3.0 以上**（推荐 4.x / 5.x，作者用 5.2.1 制作） |
| 物体数量 | 1 个网格物体，名字叫 **`球体`** |
| 面数 | 34,021 顶点 / 33,980 面 |
| 材质 | 4 个：`yellow`、`材质`、`材质.001`、`材质.002` |
| UV | 1 个，名字叫 `UV贴图` |
| 贴图图片 | 无（颜色直接做在材质里，不需要额外的图片文件，不会出现"贴图丢失"） |
| 骨骼 / 动画 | 无（是静态模型，不能直接做动作） |

> **为什么物体的名字叫「球体」？**
> 因为作者建模时是从一个球体开始捏的，捏完没改名。
> 所以你在 Blender 里看到 `球体` 就是奶龙的模型本体，别被名字误导，也别以为选错了。

---

## 二、先把文件下载下来

1. 打开本仓库页面。
2. 点右上角绿色的 **`Code`** 按钮 → **`Download ZIP`**。
3. 解压到桌面，你会看到 `nailong_colored.blend`。
4. 建议就放在**桌面**或**下载**文件夹里 —— 因为 Blender 的"追加"窗口需要你自己去找这个文件，放在好找的地方能省很多事。

> 只想下载单个文件的话：点进 `nailong_colored.blend` → 点右上角的下载图标（⬇）。

---

## 三、只是想看看模型长什么样（最简单）

1. 双击 `nailong_colored.blend`，Blender 会自动打开它。
2. 如果没反应，就先打开 Blender，点左上角 **`文件` → `打开`**（英文界面 `File → Open`），再选这个文件。
3. 打开后如果没看到模型，把鼠标放到 3D 视图里，按一下键盘的 **`Home`** 键，视图会自动缩放到能看见所有东西。

看到黄色小龙就成功了。想改它、保存它，都可以，这是你自己的文件了。

---

## 四、重点：把奶龙「追加」到你自己的场景里

**什么叫「追加」（Append）？**
就是把别的 `.blend` 文件里的物体，**复制一份**到你当前正在做的文件里。复制过来之后随便你改，不会影响原文件。
（Blender 里还有一个「链接 / Link」，那个只是引用、不能改，我们先不用它。）

下面的步骤以**中文界面**为准，括号里是对应的英文界面名字。

### 第 0 步：打开 Blender，删掉默认的方块

新建的场景里会有一个立方体、一盏灯、一个摄像机。

1. 用鼠标**左键**点一下中间那个方块，它会变成橙色描边（表示被选中了）。
2. 按键盘 **`X`** 键 → 弹出菜单 → 选 **`删除`**（`Delete`）。
3. 现在场景就空了。

> 为什么要删？因为不删的话，那个方块会挡在奶龙旁边，新手容易搞不清哪个是哪个。删掉更清爽。
> 删错了不要紧，`Ctrl + Z` 可以撤销。

### 第 1 步：打开「追加」窗口

点左上角 **`文件`** 菜单（英文是 `File`），在菜单里找到并点击 **`追加…`**（`Append…`）。

> 注意是 **`追加`**，不是 `导入`，也不是 `打开`。这三个长得像，别点错。
> 如果菜单里没看到，说明版本比较老，可以按 `F3` 搜索 `Append` 来打开。

### 第 2 步：找到你下载的 .blend 文件

弹出来的是一个文件浏览器窗口：

1. 在窗口左侧那一列里，点 **`桌面`** 或 **`下载`**（`Desktop` / `Downloads`），快速跳到对应位置。
2. 找到并**双击** `nailong_colored.blend`。
   - 如果双击没反应，就**单击**选中它，再点窗口右下角的 **`追加`** 按钮。

### 第 3 步：选到物体本身

双击 `.blend` 之后，窗口里会显示这个文件内部的"零件清单"：

1. 你会看到一个叫 **`Collection`** 的东西（这是一个集合），**双击**进去。
2. 进去后能看到一个名字叫 **`球体`** 的东西 —— 这就是奶龙。
3. **左键单击**选中 `球体`（选中后会高亮）。
4. 点窗口右下角的 **`追加`** 按钮（`Append`）。

> 到这一步，模型就已经进来了。窗口会自动关掉。

### 第 4 步：让模型出现在眼前

追加进来的东西可能不在你当前看的位置，看不到是正常的。

1. 鼠标移到 3D 视图中间，按键盘 **`Home`** 键 —— 视图会缩放到显示全部物体。
2. 还是没有？看右上角的 **`大纲视图`**（`Outliner`）面板里有没有一个叫 `球体` 的条目。有，就说明它确实进来了，只是跑到视野外面了；鼠标放到 3D 视图里，滚轮往前滚放大、按住中键拖动平移，就能找到它。

### 第 5 步：让模型显示颜色

追加进来的模型默认可能是灰色的（那只是"显示模式"的问题，不是模型坏了）。

按键盘 **`Z`** 键 → 会弹出一个圆饼菜单 → 选 **`材质预览`**（`Material Preview`）。
模型立刻就会变成黄色的奶龙。想看更好看的效果，就选 **`渲染`**（`Rendered`）。

> `Z` 键那个圆饼菜单里，`实体` 就是纯灰色显示，`材质预览` 才带颜色。这是新手最常困惑的一点。

### 第 6 步：保存你自己的文件

按 **`Ctrl + S`** → 会弹出"保存"窗口 → 给你的文件起个名字 → 点保存。

> 一定要单独保存一个**新文件**，不要覆盖 `nailong_colored.blend`，不然原始模型就被你改掉了。
> 第一次保存叫"另存为"，之后按 `Ctrl + S` 就是直接保存。

### 第 7 步（可选）：让模型回到正中间、站在地面上

作者建模的时候，模型没有放在世界正中心：它整体偏在一边，而且脚是**踩在地面网格下面**的。这不是错误，是原文件的状态。想让它在正中间站稳：

1. 选中模型（左键点它）。
2. 按 **`G`** 键可以移动它（移动鼠标，点左键确认）。
3. 想精确移动的话，按 `N` 打开右侧面板，在 **`位置`**（`Location`）里直接改数字。

---

## 五、常见问题

| 问题 | 原因 / 解决 |
|------|------|
| 找不到「追加」菜单 | 别找「打开」「导入」；英文界面是 `File → Append…`。也可以按 `F3` 搜 `Append`。 |
| 追加之后看不到模型 | 正常的，按 **`Home`** 键缩放视图；再检查右上角`大纲视图`里有没有 `球体`。 |
| 模型是灰色的 | 按 **`Z`** 键 → 选 **`材质预览`**。这是显示模式，不是模型坏了。 |
| 找不到 `球体` 这个东西 | 第 3 步里要**双击** `Collection` 进去，物体在集合**里面**，不是在外面。 |
| 模型一半在地面下面 | 原文件就是这样（脚底在地面网格下方），用 `G` 键自己挪一下即可。 |
| 模型跑到很偏的地方 | 原文件整体偏移在一边，属正常，`G` 键或按 `N` 改「位置」数值。 |
| 界面是英文，想要中文 | `编辑` → `偏好设置` → `界面` → `翻译` → 语言选 **`简体中文`**。 |
| 笔记本没有小键盘 | `编辑` → `偏好设置` → `输入` → 勾选 **`模拟数字小键盘`**。 |
| 能改吗？能商用吗？ | 可以随便改着玩、练手。但**角色本身的版权不属于本仓库**，商用请自行确认授权，见下方「版权说明」。 |
| 为什么不直接导入 .obj？ | 颜色是靠复杂材质做出来的，导出成 `.obj` **会丢掉配色**，所以请直接用 `.blend`。 |

---

## 六、English (for non-Chinese readers)

**What is this?** A Blender model of the yellow dragon character **Nailoong** (奶龙), made and shared for practice. The `.blend` file also carries a beginner-friendly import tutorial in Chinese above.

**Files**
- `nailong_colored.blend` — the model. Single mesh object named `球体` ("sphere"), 33,980 faces, 4 materials, 1 UV map, no textures, no armature/animation.
- `preview.png` — preview render.

**Requirements:** Blender 3.0+ (4.x / 5.x recommended; made with 5.2.1).

**Just want to look at it?** Double-click the `.blend`, then press `Home` in the 3D viewport to frame everything.

**How to append the model into your own scene (step by step)**

1. Open Blender. Click the default cube → press `X` → `Delete`.
2. Top-left menu: **`File` → `Append…`**
3. In the file browser, go to the folder where you saved `nailong_colored.blend`, then **double-click** the file.
4. Inside it you will see a collection named `Collection` — **double-click** it.
5. Select the object named `球体` (that's the character) → click **`Append`** (bottom-right).
6. The model may be off-screen: hover the 3D viewport and press **`Home`**.
7. Default shading looks grey: press **`Z`** → choose **`Material Preview`** to see the real colors.
8. Save your own file with `Ctrl + S` — don't overwrite the original.

**Notes**
- The object is literally named `球体` ("sphere") because the author started modelling from a sphere and never renamed it.
- The model is not centered in world space: it sits offset to one side, with its feet slightly below the ground grid. That is the original state, not a bug — press `G` to move it.
- `.obj` export will lose the colours, because they come from a complex material node setup, not from image textures.

**License / credit:** see the section below. The character IP is not covered by this repository.

---

## 七、版权说明

- 本仓库中的 **Blender 模型文件**由作者制作并分享，供学习、练习使用。
- 角色「奶龙 / Nailoong」的**形象版权归其原作者 / 版权方所有**，本仓库不声称拥有该角色版权。
- 请勿将本模型用于商业用途；如需商用，请自行联系版权方获得授权。
- 转载 / 二次分享时，希望能保留本仓库链接和作者署名。

> 作者：`WeDai`
> 如果这个模型帮到你，欢迎点个 ⭐ Star。
