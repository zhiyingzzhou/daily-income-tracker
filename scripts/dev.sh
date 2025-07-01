#!/bin/bash

# Daily Income 扩展开发启动脚本
# 作者: Daily Income Team

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 输出函数
log() {
    echo -e "${2}[$(date +'%H:%M:%S')] ${1}${NC} ${3}"
}

# 错误处理
error_exit() {
    log "ERROR" "$RED" "$1"
    exit 1
}

# 清理函数
cleanup() {
    log "CLEANUP" "$YELLOW" "正在停止所有进程..."
    jobs -p | xargs kill 2>/dev/null
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}========================================"
echo -e "${WHITE}  Daily Income 扩展开发环境启动${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 检查依赖
log "CHECK" "$BLUE" "检查项目依赖..."

if [ ! -d "node_modules" ]; then
    error_exit "node_modules 不存在，请先运行 npm install"
fi

if [ ! -f "package.json" ]; then
    error_exit "package.json 不存在"
fi

log "CHECK" "$GREEN" "依赖检查通过 ✓"

# 清理输出目录
log "CLEAN" "$BLUE" "清理输出目录..."
rm -rf out
log "CLEAN" "$GREEN" "输出目录已清理 ✓"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${WHITE}  启动开发服务${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 启动 TypeScript 监听编译
log "TS" "$MAGENTA" "启动 TypeScript 监听编译..."
npm run watch 2>&1 | sed "s/^/$(date +'%H:%M:%S') [TS] /" &
TS_PID=$!

sleep 2

# 启动 Webpack 前端监听
log "WEBPACK" "$CYAN" "启动 Webpack 前端监听..."
npm run dev-webview 2>&1 | sed "s/^/$(date +'%H:%M:%S') [WEBPACK] /" &
WEBPACK_PID=$!

sleep 3

echo ""
echo -e "${GREEN}========================================"
echo -e "${WHITE}  🎉 开发环境启动成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${YELLOW}📋 开发指南：${NC}"
echo -e "${BLUE}  1. 按 F5 启动调试 (或运行 \"Debug: Start Debugging\")${NC}"
echo -e "${BLUE}  2. 在新窗口中测试扩展功能${NC}"
echo -e "${BLUE}  3. 修改代码后会自动重新编译${NC}"
echo -e "${BLUE}  4. 按 Ctrl+C 退出开发模式${NC}"
echo ""

echo -e "${GREEN}🔧 监听服务：${NC}"
echo -e "${MAGENTA}  • TypeScript 编译 (PID: $TS_PID)${NC}"
echo -e "${CYAN}  • React/CSS 构建 (PID: $WEBPACK_PID)${NC}"
echo ""

echo -e "${YELLOW}💡 提示：代码修改会自动编译，刷新调试窗口即可看到效果${NC}"
echo ""

log "DEV" "$BLUE" "等待文件变化... (按 Ctrl+C 退出)"

# 等待进程
wait 