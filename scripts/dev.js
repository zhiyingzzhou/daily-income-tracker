#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 启动 Daily Income 扩展开发模式...\n');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 输出工具函数
const log = (color, prefix, message) => {
  console.log(`${color}${colors.bright}[${prefix}]${colors.reset} ${message}`);
};

// 进程管理
const processes = [];

// 优雅退出处理
const cleanup = () => {
  log(colors.yellow, 'CLEANUP', '正在停止所有进程...');
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 启动进程的函数
const startProcess = (command, args, options = {}) => {
  const proc = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    ...options,
  });

  processes.push(proc);
  return proc;
};

// 检查依赖
const checkDependencies = () => {
  log(colors.blue, 'CHECK', '检查项目依赖...');

  if (!fs.existsSync('node_modules')) {
    log(colors.red, 'ERROR', 'node_modules 不存在，请先运行 npm install');
    process.exit(1);
  }

  if (!fs.existsSync('package.json')) {
    log(colors.red, 'ERROR', 'package.json 不存在');
    process.exit(1);
  }

  log(colors.green, 'CHECK', '依赖检查通过 ✓');
};

// 清理输出目录
const cleanOutput = () => {
  log(colors.blue, 'CLEAN', '清理输出目录...');

  if (fs.existsSync('out')) {
    fs.rmSync('out', { recursive: true, force: true });
  }

  log(colors.green, 'CLEAN', '输出目录已清理 ✓');
};

// 主函数
const main = async () => {
  try {
    // 检查依赖
    checkDependencies();

    // 清理输出
    cleanOutput();

    console.log(`\n${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}  Daily Income 扩展开发环境${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // 1. 启动 TypeScript 监听编译
    log(colors.magenta, 'TS', '启动 TypeScript 监听编译...');
    const tsWatch = startProcess('npm', ['run', 'watch']);

    tsWatch.stdout.on('data', data => {
      const output = data.toString().trim();
      if (output) {
        log(colors.magenta, 'TS', output);
      }
    });

    tsWatch.stderr.on('data', data => {
      const output = data.toString().trim();
      if (output && !output.includes('Starting compilation')) {
        log(colors.red, 'TS-ERR', output);
      }
    });

    // 等待一秒让 TypeScript 编译开始
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. 启动 Webpack 前端监听
    log(colors.cyan, 'WEBPACK', '启动 Webpack 前端监听...');
    const webpackWatch = startProcess('npm', ['run', 'dev-webview']);

    webpackWatch.stdout.on('data', data => {
      const output = data.toString().trim();
      if (output) {
        log(colors.cyan, 'WEBPACK', output);
      }
    });

    webpackWatch.stderr.on('data', data => {
      const output = data.toString().trim();
      if (output && !output.includes('webpack is watching')) {
        log(colors.red, 'WP-ERR', output);
      }
    });

    // 等待编译完成
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`\n${colors.green}========================================${colors.reset}`);
    console.log(`${colors.green}${colors.bright}  🎉 开发环境启动成功！${colors.reset}`);
    console.log(`${colors.green}========================================${colors.reset}\n`);

    console.log(`${colors.yellow}📋 开发指南：${colors.reset}`);
    console.log(
      `${colors.blue}  1. 按 F5 启动调试 (或运行 "Debug: Start Debugging")${colors.reset}`
    );
    console.log(`${colors.blue}  2. 在新窗口中测试扩展功能${colors.reset}`);
    console.log(`${colors.blue}  3. 修改代码后会自动重新编译${colors.reset}`);
    console.log(`${colors.blue}  4. 按 Ctrl+C 退出开发模式${colors.reset}\n`);

    console.log(`${colors.green}🔧 监听服务：${colors.reset}`);
    console.log(`${colors.magenta}  • TypeScript 编译: 监听 src/**/*.ts${colors.reset}`);
    console.log(`${colors.cyan}  • React/CSS 构建: 监听 src/webview/**/*${colors.reset}\n`);

    console.log(
      `${colors.yellow}💡 提示：代码修改会自动编译，刷新调试窗口即可看到效果${colors.reset}\n`
    );

    // 保持进程运行
    console.log(`${colors.blue}等待文件变化... (按 Ctrl+C 退出)${colors.reset}`);

    // 监听进程退出
    tsWatch.on('exit', code => {
      if (code !== 0) {
        log(colors.red, 'TS', `TypeScript 监听进程退出，代码: ${code}`);
      }
    });

    webpackWatch.on('exit', code => {
      if (code !== 0) {
        log(colors.red, 'WEBPACK', `Webpack 监听进程退出，代码: ${code}`);
      }
    });
  } catch (error) {
    log(colors.red, 'ERROR', `启动失败: ${error.message}`);
    cleanup();
  }
};

// 启动
main();
