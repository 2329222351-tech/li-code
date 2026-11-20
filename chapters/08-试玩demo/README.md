# 第八章 · 试玩demo

《奶蛙：午夜奶厂》的可玩 Demo 自包含发布包，纯前端、无需构建、无需联网。

## 运行

```bash
cd chapters/08-试玩demo
python -m http.server 8899
# 浏览器打开 http://127.0.0.1:8899/index.html
```

## 内容

| 路径 | 说明 |
| --- | --- |
| `index.html` | 主场景（三幕关卡 + HUD + PS1 后处理 + 剧情判定，约 270KB） |
| `assets/` | 角色数据 JS、纸片人序列帧与贴图、70+ 音效（`manifest.js` 索引）及音效试听页 |
| `vendor/` | three.js + GLTFLoader（本地化，不依赖 CDN） |

相比 `07-naiwaRA`（完整源码存档），本章只保留运行时必需文件，去掉 Blender 源文件、
构建脚本与开发过程产物。两章内容同源，按需取用。
