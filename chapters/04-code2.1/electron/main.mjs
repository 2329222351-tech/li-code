// electron/main.mjs
// Electron 主进程（ESM）：学生手册背诵 · 离线版
// - dev: 加载 VITE_DEV_SERVER_URL（nuxt dev 已自动设好）
// - prod: 把 Nitro 当子进程跑，BrowserWindow 加载 http://localhost:3000
//
// 数据目录策略：
//   - dev:       <项目根>/server/data
//   - portable:  <exe 目录>/data
//   - 安装/解压版: %APPDATA%/学生手册背诵/data
//
// 产物位置：Nitro 的 .output 通过 extraResources 拷到 <resources>/nitro，
// 不走 asar —— .output/server/node_modules 里是 SSR 运行时依赖，
// 打进 asar 会被 electron-builder 的 node_modules 规则过滤掉（表现为页面 500）。
// 目录名不能叫 app：Electron 会把 resources/app 当成未打包的应用目录，
// 抢在 resources/app.asar 之前被加载，导致主进程根本没启动。

import { app, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendFileSync, mkdirSync } from 'node:fs'
import http from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow = null
let nitroProcess = null
let logFile = join(process.env.TEMP || '/tmp', 'code21-main.log')

/**
 * 主进程日志写文件。
 * GUI 进程没有控制台，出问题时只能靠这个文件定位；开发时同时打到控制台。
 */
function log(level, ...args) {
  const text = args
    .map(a => (typeof a === 'string' ? a : (a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a))))
    .join(' ')
  const line = `[${new Date().toISOString()}] ${level} ${text}\n`
  try {
    mkdirSync(dirname(logFile), { recursive: true })
    appendFileSync(logFile, line, 'utf-8')
  } catch { /* 日志写不进去也不能影响启动 */ }
  if (!app.isPackaged) {
    if (level === 'ERROR') console.error(text)
    else console.log(text)
  }
}

log('INFO', '=== main.mjs loaded ===', {
  isDev,
  resourcesPath: process.resourcesPath,
  argv: process.argv.slice(0, 4)
})

process.on('uncaughtException', (e) => log('ERROR', 'uncaughtException', e))
process.on('unhandledRejection', (e) => log('ERROR', 'unhandledRejection', e))

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

  // 数据目录就绪后，日志从临时目录挪到这里，方便用户直接发给我们
  logFile = join(dataDir, 'main.log')
  process.env.CODE21_DATA_DIR = dataDir
  log('INFO', 'CODE21_DATA_DIR =', dataDir)
  return dataDir
}

/**
 * 轮询本地 HTTP 直到返回任何响应（404 也算服务起来了）
 */
function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume()
        log('INFO', 'server responded', res.statusCode)
        resolve()
      })
      req.on('error', (e) => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms (last: ${e?.message})`))
        } else {
          setTimeout(tryOnce, 300)
        }
      })
    }
    tryOnce()
  })
}

/**
 * 生产模式：把 Nitro 产物当作独立 Node 服务跑
 */
async function startNitroInProd() {
  const serverPath = isDev
    ? join(__dirname, '..', '.output', 'server', 'index.mjs')
    : join(process.resourcesPath, 'nitro', 'server', 'index.mjs')

  const port = Number(process.env.PORT) || 3000
  log('INFO', 'starting Nitro', { serverPath, port })

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

  nitroProcess.stdout?.on('data', (d) => log('NITRO', String(d).trim()))
  nitroProcess.stderr?.on('data', (d) => log('NITRO-ERR', String(d).trim()))
  nitroProcess.on('error', (e) => log('ERROR', 'nitro spawn failed', e))
  nitroProcess.on('exit', (code, signal) => log('INFO', `nitro exited code=${code} signal=${signal}`))

  await waitForServer(`http://127.0.0.1:${port}/api/ping`)
  log('INFO', 'Nitro ready')
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

  // ready-to-show 在页面加载失败时可能永远不触发，兜一个定时器保证窗口一定会出现
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      log('ERROR', 'ready-to-show 超时，强制显示窗口')
      mainWindow.show()
    }
  }, 8000)

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback)
    mainWindow?.show()
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('ERROR', `页面加载失败 code=${code} desc=${desc} url=${url}`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log('ERROR', 'render process gone', details)
  })

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
    log('INFO', 'loading dev url', url)
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    log('INFO', 'loading prod url http://localhost:3000')
    mainWindow.loadURL('http://localhost:3000')
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  try {
    log('INFO', 'app ready')
    setupDataDir()

    if (!process.env.VITE_DEV_SERVER_URL) {
      await startNitroInProd()
    } else {
      log('INFO', 'using external VITE_DEV_SERVER_URL', process.env.VITE_DEV_SERVER_URL)
    }

    createWindow()
  } catch (err) {
    // 打包后没有控制台，静默退出等于「双击没反应」，这里必须弹个框把原因说清楚
    log('ERROR', '启动失败', err)
    dialog.showErrorBox(
      '学生手册背诵 · 启动失败',
      `本地服务没能启动。\n\n${err instanceof Error ? err.message : String(err)}\n\n` +
      `如果 3000 端口被别的程序占用，关掉它再打开本程序。\n日志：${logFile}`
    )
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((e) => {
  log('ERROR', 'whenReady rejected', e)
  app.quit()
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
