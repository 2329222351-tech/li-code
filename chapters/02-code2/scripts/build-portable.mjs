// scripts/build-portable.mjs
// 单次 build electron-builder,接受"失败"(winCodeSign 失败不影响 code2.exe)。
// 之前失败原因: EnsureEmptyDir 在 retry 时被前次 build 残留的 app.asar 锁住。
// 解决: 只 build 一次,立刻拿产物。

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, readdirSync, copyFileSync, statSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = resolve(import.meta.dirname, '..')
const CACHE_BASE = join(tmpdir(), 'electron-builder', 'Cache', 'winCodeSign')
const SEVENZA = join(ROOT, 'node_modules', '.pnpm', '7zip-bin@5.2.0', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
const WINCSIGN_URL = 'https://npmmirror.com/mirrors/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z'
const STAGE_DIR = join(ROOT, '.trash', '_wcs_stage')
const STAGE_ZIP = join(STAGE_DIR, 'winCodeSign.7z')
const STAGE_EXTRACTED = join(STAGE_DIR, 'extracted')
const PORTABLE_DIR = join(ROOT, 'dist-v3', 'win-unpacked')
const PORTABLE_ZIP = join(ROOT, 'release', 'code2-portable-x64.zip')

function log(...args) { console.log('[build-portable]', ...args) }

function exec(cmd, opts = {}) {
  log('$', cmd)
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

function ensureWinCodeSign() {
  if (existsSync(join(STAGE_EXTRACTED, 'rcedit-x64.exe'))) return
  mkdirSync(STAGE_DIR, { recursive: true })
  if (!existsSync(STAGE_ZIP)) {
    log('Downloading winCodeSign ...')
    exec(`powershell -NoProfile -Command "Invoke-WebRequest -Uri '${WINCSIGN_URL}' -OutFile '${STAGE_ZIP}' -UseBasicParsing"`)
  }
  log('Extracting with -snl- ...')
  exec(`"${SEVENZA}" x -snl- -bd -o"${STAGE_EXTRACTED}" "${STAGE_ZIP}"`)
  const darwin = join(STAGE_EXTRACTED, 'darwin')
  if (existsSync(darwin)) rmSync(darwin, { recursive: true, force: true })
}

function findCacheSubdirs() {
  if (!existsSync(CACHE_BASE)) return []
  return readdirSync(CACHE_BASE).filter(n => /^\d+$/.test(n))
}

function prefillAll() {
  for (const s of findCacheSubdirs()) {
    const target = join(CACHE_BASE, s)
    rmSync(target, { recursive: true, force: true })
    mkdirSync(target, { recursive: true })
    for (const f of readdirSync(STAGE_EXTRACTED)) {
      copyFileSync(join(STAGE_EXTRACTED, f), join(target, f))
    }
    log(`Pre-filled ${s}`)
  }
}

function build() {
  log('Running electron-builder --dir ...')
  const r = spawnSync('pnpm', ['exec', 'electron-builder', '--dir', '--config', 'electron-builder.json'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })
  return r.status === 0
}

function zipPortable() {
  if (!existsSync(join(PORTABLE_DIR, 'code2.exe'))) {
    log('No code2.exe to zip')
    return null
  }
  if (existsSync(PORTABLE_ZIP)) rmSync(PORTABLE_ZIP, { force: true })
  mkdirSync(dirname(PORTABLE_ZIP), { recursive: true })
  log('Zipping to', PORTABLE_ZIP, '...')
  // 用 PowerShell Compress-Archive (比 archiver 简单,无 ESM 兼容问题)
  exec(`powershell -NoProfile -Command "Compress-Archive -Path '${PORTABLE_DIR}\\*' -DestinationPath '${PORTABLE_ZIP}' -Force"`)
  return PORTABLE_ZIP
}

async function main() {
  ensureWinCodeSign()
  prefillAll()  // 预填已有的(已建过的)cache subdir
  
  // Build 一次, 接受失败 (winCodeSign 在 code2.exe 之后才跑)
  log('--- Building (single attempt, ignore exit code) ---')
  const ok = build()
  log('Build exit code:', ok ? '0 (success)' : '1 (failed at winCodeSign, but code2.exe should exist)')
  
  const exe = join(PORTABLE_DIR, 'code2.exe')
  if (!existsSync(exe)) {
    log('❌ code2.exe NOT found at', exe)
    log('Cache subdirs now:', findCacheSubdirs())
    return
  }
  const size = statSync(exe).size
  log('✅ code2.exe:', exe, `(${(size / 1024 / 1024).toFixed(1)} MB)`)
  
  // 打 zip
  const zip = zipPortable()
  if (zip) {
    const zsize = statSync(zip).size
    log('✅ Portable zip:', zip, `(${(zsize / 1024 / 1024).toFixed(1)} MB)`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
