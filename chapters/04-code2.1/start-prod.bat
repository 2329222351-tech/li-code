@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   学生手册背诵 / 生产模式
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [x] 没找到 Node.js
  echo     请先安装 Node.js 20 或更高版本：https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [x] 还没装依赖，请先双击运行 start-dev.bat（会自动安装）
  pause
  exit /b 1
)

if not exist ".output\server\index.mjs" (
  echo [1/2] 首次运行，正在构建，大约需要 1 分钟...
  call pnpm build
  if errorlevel 1 (
    echo.
    echo [x] 构建失败，请把上面的报错发出来
    pause
    exit /b 1
  )
) else (
  echo [1/2] 已存在构建产物，跳过构建
)

echo [2/2] 启动中... 访问 http://localhost:3000  （按 Ctrl+C 停止）
echo.

if not "%NO_OPEN%"=="1" start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
node ".output\server\index.mjs"

echo.
echo 服务已停止。
pause
