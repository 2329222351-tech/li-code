// electron/main.mjs
// Electron 主进程（ESM）：code2 离线版
// - dev: 加载 VITE_DEV_SERVER_URL（nuxt dev 已自动设好）
// - prod: 把 Nitro 当子进程跑，BrowserWindow 加载 http://localhost:3000
//
// 数据目录策略（prod）：
//   - portable:  <exe 目录>/data
//   - NSIS 用户: %APPDATA%/code2/data
//   首次启动从 process.resourcesPath/data/words.json 拷贝种子文件
//   然后在启动 Nitro 之前把路径塞进 CODE2_DATA_DIR，server 端 wordStore 读它

import { app, BrowserWindow, shell } from 'electron'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import http from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
let mainWindow = null
let nitroProcess = null

/**
 * 决定 userData 目录 + 种子数据
 */
function setupDataDir() {
  let dataDir
  if (isDev) {
    dataDir = join(__dirname, '..', 'server', 'data')
  } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    // portable 版：exe 同级 data/
    dataDir = join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
  } else {
    // NSIS 用户安装：%APPDATA%/code2/data
    dataDir = join(app.getPath('userData'), 'data')
  }
  mkdirSync(dataDir, { recursive: true })

  // 首次启动：从打包资源里拷种子
  const userWords = join(dataDir, 'words.json')
  if (!existsSync(userWords)) {
    const seedPath = isDev
      ? join(__dirname, '..', 'server', 'data', 'words.json')
      : join(process.resourcesPath, 'data', 'words.json')
    if (existsSync(seedPath)) {
      copyFileSync(seedPath, userWords)
      console.log(`[main] Seeded data from ${seedPath} -> ${userWords}`)
    } else {
      console.warn(`[main] No seed data at ${seedPath}，用户首次保存会失败`)
    }
  }

  // 设置环境变量给 Nitro 子进程
  process.env.CODE2_DATA_DIR = dataDir
  console.log(`[main] CODE2_DATA_DIR = ${dataDir}`)
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
 *
 * 路径解析：
 * - dev (本机源码跑)：<项目根>/.output/server/index.mjs
 * - packaged (asar.unpacked)：<resourcesPath>/app.asar.unpacked/.output/server/index.mjs
 *   （electron-builder.json 里 asarUnpack 配了 .output/**）
 */
async function startNitroInProd() {
  let serverPath
  if (isDev) {
    serverPath = join(__dirname, '..', '.output', 'server', 'index.mjs')
  } else {
    // asarUnpack 后真实路径在 resources/app.asar.unpacked/
    serverPath = join(process.resourcesPath, 'app.asar.unpacked', '.output', 'server', 'index.mjs')
  }
  const port = Number(process.env.PORT) || 3000
  console.log(`[main] Starting Nitro at ${serverPath} on port ${port}...`)
  nitroProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      // packaged Electron 里 process.execPath 是 code2.exe(Electron),不是 Node
      // 加这个 env 让 Electron 当 Node 解释器跑 Nitro 脚本
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
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'code2',
    backgroundColor: '#1a1a2e',
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
    // 本地未打包：优先用 VITE_DEV_SERVER_URL（外部 Nuxt dev server）
    // 否则用 .output（说明已先跑过 nuxt build，Nitro 会被本进程拉起）
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
    // 总是 setupDataDir（设置 CODE2_DATA_DIR 给子进程 Nitro）
    setupDataDir()

    // 总是 startNitro（让 BrowserWindow 能加载 http://localhost:3000）
    // 唯一例外：用户显式设了 VITE_DEV_SERVER_URL（外部 Nuxt dev 在跑）
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
