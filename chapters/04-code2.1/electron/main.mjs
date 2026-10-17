// electron/main.mjs
// Electron 主进程（ESM）：学生手册背诵 · 离线版
// - dev: 加载 VITE_DEV_SERVER_URL（nuxt dev 已自动设好）
// - prod: 把 Nitro 当子进程跑，BrowserWindow 加载 http://localhost:3000
//
// 数据目录策略（与 code2 一致，环境变量名换成 CODE21_DATA_DIR）：
//   - dev:       <项目根>/server/data
//   - portable:  <exe 目录>/data
//   - NSIS 用户: %APPDATA%/学生手册背诵/data
// 题库是打包进 Nitro bundle 的（静态 import），所以不需要 seed；
// 只有 progress.json（背诵进度）会落在数据目录。

import { app, BrowserWindow, shell } from 'electron'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import http from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
let mainWindow = null
let nitroProcess = null

/**
 * 决定数据目录（进度文件落这里）
 */
function setupDataDir() {
  let dataDir
  if (isDev) {
    dataDir = join(__dirname, '..', 'server', 'data')
  } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    dataDir = join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
  } else {
    dataDir = join(app.getPath('userData'), 'data')
  }
  mkdirSync(dataDir, { recursive: true })
  process.env.CODE21_DATA_DIR = dataDir
  console.log(`[main] CODE21_DATA_DIR = ${dataDir}`)
  return dataDir
}

/**
 * 轮询本地 HTTP 直到返回任何响应（404 也算服务起来了）
 */
function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`))
        } else {
          setTimeout(tryOnce, 250)
        }
      })
    }
    tryOnce()
  })
}

/**
 * 生产模式：把 .output/server/index.mjs 当作独立 Node 服务跑
 */
async function startNitroInProd() {
  const serverPath = isDev
    ? join(__dirname, '..', '.output', 'server', 'index.mjs')
    : join(process.resourcesPath, 'app.asar.unpacked', '.output', 'server', 'index.mjs')

  const port = Number(process.env.PORT) || 3000
  console.log(`[main] Starting Nitro at ${serverPath} on port ${port}...`)

  nitroProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      // packaged Electron 里 process.execPath 是应用 exe 本身，加这个 env 让它当 Node 解释器
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  nitroProcess.stdout?.on('data', (data) => console.log(`[nitro] ${data.toString().trim()}`))
  nitroProcess.stderr?.on('data', (data) => console.error(`[nitro] ${data.toString().trim()}`))
  nitroProcess.on('exit', (code) => console.log(`[nitro] exited code=${code}`))

  await waitForServer(`http://127.0.0.1:${port}/api/ping`, 15000)
  console.log('[main] Nitro ready')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 720,
    minHeight: 600,
    title: '学生手册背诵',
    backgroundColor: '#f7f8fa',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    autoHideMenuBar: true,
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 外链走系统默认浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 阻止跳转到非应用 origin
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefix = isDev
      ? (process.env.VITE_DEV_SERVER_URL || '')
      : 'http://localhost:3000'
    if (!url.startsWith(allowedPrefix)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadURL('http://localhost:3000')
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  try {
    setupDataDir()

    if (!process.env.VITE_DEV_SERVER_URL) {
      await startNitroInProd()
    } else {
      console.log(`[main] Using external VITE_DEV_SERVER_URL: ${process.env.VITE_DEV_SERVER_URL}`)
    }

    createWindow()
  } catch (err) {
    console.error('[main] 启动失败：', err)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (nitroProcess) {
    try { nitroProcess.kill() } catch { /* noop */ }
    nitroProcess = null
  }
})
