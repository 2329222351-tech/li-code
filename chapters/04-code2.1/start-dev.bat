@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   学生手册背诵 / 开发模式
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [x] 没找到 Node.js
  echo     请先安装 Node.js 20 或更高版本：https://nodejs.org
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [x] 没找到 pnpm
  echo     执行一次：corepack enable
  echo     或者：npm i -g pnpm
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] 首次运行，正在安装依赖，可能需要几分钟...
  call pnpm install
  if errorlevel 1 (
    echo.
    echo [x] 依赖安装失败。如果是 Electron 下载超时，可以改用：
    echo     set ELECTRON_SKIP_BINARY_DOWNLOAD=1 ^&^& pnpm install
    echo     不打包桌面版的话够用了
    pause
    exit /b 1
  )
) else (
  echo [1/2] 依赖已存在，跳过安装
)

echo [2/2] 启动开发服务器...
echo.
echo     访问地址：http://localhost:3000
echo     停止服务：按 Ctrl+C
echo.

if not "%NO_OPEN%"=="1" start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call pnpm dev

echo.
echo 开发服务器已停止。
pause
