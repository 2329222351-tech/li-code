// electron/preload.mjs
// 在主进程和渲染进程之间架桥（contextBridge）。
// 当前只暴露环境信息；背诵进度走 HTTP API，不需要 IPC。

import { contextBridge, app } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  isDev: !app.isPackaged,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
})
