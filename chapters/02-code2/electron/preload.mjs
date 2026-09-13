// electron/preload.mjs
// 在主进程和渲染进程之间架桥（contextBridge）
// 当前只暴露环境信息；auto-update / 通知 / 文件 IO 等会逐步加。

import { contextBridge, app } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  isDev: !app.isPackaged,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  // Auto-update API 预留，下一迭代接入 electron-updater
  onUpdateAvailable: () => { /* noop */ },
  onUpdateDownloaded: () => { /* noop */ },
  installUpdate: () => Promise.resolve(false),
})
