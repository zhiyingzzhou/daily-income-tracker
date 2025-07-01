# Daily Income 扩展开发启动脚本 (Windows PowerShell)
# 作者: Daily Income Team

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

# 清理函数
function Cleanup {
    Write-ColorOutput "正在停止所有进程..." "Yellow"
    Get-Job | Stop-Job
    Get-Job | Remove-Job -Force
    exit 0
}

# 注册清理事件
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Daily Income 扩展开发环境启动" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查依赖
Write-ColorOutput "检查项目依赖..." "Blue"

if (-not (Test-Path "node_modules")) {
    Write-ColorOutput "node_modules 不存在，请先运行 npm install" "Red"
    exit 1
}

if (-not (Test-Path "package.json")) {
    Write-ColorOutput "package.json 不存在" "Red"
    exit 1
}

Write-ColorOutput "依赖检查通过 ✓" "Green"

# 清理输出目录
Write-ColorOutput "清理输出目录..." "Blue"
if (Test-Path "out") {
    Remove-Item -Recurse -Force "out"
}
Write-ColorOutput "输出目录已清理 ✓" "Green"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动开发服务" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 启动 TypeScript 监听编译
Write-ColorOutput "启动 TypeScript 监听编译..." "Magenta"
$tsJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run watch
} -Name "TypeScript"

Start-Sleep -Seconds 2

# 启动 Webpack 前端监听
Write-ColorOutput "启动 Webpack 前端监听..." "Cyan"
$webpackJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev-webview
} -Name "Webpack"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  🎉 开发环境启动成功！" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 开发指南：" -ForegroundColor Yellow
Write-Host "  1. 按 F5 启动调试 (或运行 'Debug: Start Debugging')" -ForegroundColor Blue
Write-Host "  2. 在新窗口中测试扩展功能" -ForegroundColor Blue
Write-Host "  3. 修改代码后会自动重新编译" -ForegroundColor Blue
Write-Host "  4. 按 Ctrl+C 退出开发模式" -ForegroundColor Blue
Write-Host ""

Write-Host "🔧 监听服务：" -ForegroundColor Green
Write-Host "  • TypeScript 编译 (Job ID: $($tsJob.Id))" -ForegroundColor Magenta
Write-Host "  • React/CSS 构建 (Job ID: $($webpackJob.Id))" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 提示：代码修改会自动编译，刷新调试窗口即可看到效果" -ForegroundColor Yellow
Write-Host ""

Write-ColorOutput "等待文件变化... (按 Ctrl+C 退出)" "Blue"

# 监听作业状态
try {
    while ($true) {
        $jobs = Get-Job
        
        foreach ($job in $jobs) {
            if ($job.State -eq "Failed") {
                Write-ColorOutput "$($job.Name) 作业失败!" "Red"
                Receive-Job $job
            }
        }
        
        Start-Sleep -Seconds 5
    }
}
catch {
    Write-ColorOutput "开发环境被中断" "Yellow"
}
finally {
    Cleanup
} 