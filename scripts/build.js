#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');

console.log('🚀 开始 Daily Income 扩展生产构建...\n');

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

  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // 确保dist目录存在
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync('dist/webview', { recursive: true });

  log(colors.green, 'CLEAN', '输出目录已清理并重新创建 ✓');
};

// 执行命令并记录输出
const runCommand = (name, color, command, args) => {
  log(color, name, `执行 ${command} ${args.join(' ')}...`);
  
  const result = spawnSync(command, args, { 
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    shell: true
  });
  
  if (result.status !== 0) {
    log(colors.red, `${name}-ERR`, `命令执行失败，退出码: ${result.status}`);
    log(colors.red, `${name}-ERR`, result.stderr || result.stdout || '未知错误');
    process.exit(1);
  }

  const output = result.stdout.trim();
  if (output) {
    output.split('\n').forEach(line => {
      if (line.trim()) {
        log(color, name, line.trim());
      }
    });
  }
  
  log(colors.green, name, '完成 ✓');
  return result;
};

// 主函数
const main = () => {
  try {
    // 检查依赖
    checkDependencies();

    // 清理输出
    cleanOutput();

    console.log(`\n${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}  Daily Income 扩展生产构建${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // 执行打包扩展
    log(colors.magenta, 'BUNDLE', '开始打包扩展...');
    runCommand('BUNDLE', colors.magenta, 'npm', ['run', 'package-extension']);

    console.log(`\n${colors.green}========================================${colors.reset}`);
    console.log(`${colors.green}${colors.bright}  🎉 构建成功！${colors.reset}`);
    console.log(`${colors.green}========================================${colors.reset}\n`);

    console.log(`${colors.yellow}📦 构建输出：${colors.reset}`);
    console.log(`${colors.blue}  • 扩展输出: ./dist/extension.js${colors.reset}`);
    console.log(`${colors.blue}  • React/CSS 输出: ./dist/webview${colors.reset}\n`);

    console.log(`${colors.green}🚀 构建完成，可以使用以下命令进行测试:${colors.reset}`);
    console.log(`${colors.magenta}  • 按 F5 启动调试${colors.reset}`);
    console.log(`${colors.magenta}  • 使用 "npm run package" 打包.vsix到dist目录${colors.reset}\n`);

  } catch (error) {
    log(colors.red, 'ERROR', `构建失败: ${error.message}`);
    process.exit(1);
  }
};

// 启动
main(); 