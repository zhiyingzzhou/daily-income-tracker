import * as vscode from 'vscode';
import { IncomeCalculator } from './core/IncomeCalculator';
import { StatusBarManager } from './core/StatusBarManager';
import { SettingsWebviewProvider } from './webview/SettingsWebviewProvider';
import { SyncManager } from './core/SyncManager';
import { ConfigManager } from './core/ConfigManager';

// 全局实例
let incomeCalculator: IncomeCalculator;
let statusBarManager: StatusBarManager;
let syncManager: SyncManager;
let configManager: ConfigManager;

export function activate(context: vscode.ExtensionContext) {
  console.log('实时收入计算器扩展已激活！');

  // 初始化配置管理器
  configManager = new ConfigManager(context);

  // 初始化核心组件
  incomeCalculator = new IncomeCalculator(context, configManager);
  
  // 启动收入计算 - 先启动计算器以确保工作状态被正确初始化
  incomeCalculator.start();
  
  // 初始化状态栏管理器
  statusBarManager = new StatusBarManager(incomeCalculator, configManager);
  syncManager = new SyncManager(context, configManager);

  // 注册设置面板提供者
  const settingsProvider = new SettingsWebviewProvider(
    context,
    incomeCalculator,
    syncManager,
    configManager
  );

  // 注册命令
  const disposables = [
    // 打开设置
    vscode.commands.registerCommand('dailyIncome.openSettings', () => {
      settingsProvider.showSettings();
    }),

    // 开始工作 - 仅影响UI状态，不影响收入计算
    vscode.commands.registerCommand('dailyIncome.startWork', () => {
      incomeCalculator.startWork();
      statusBarManager.update(true); // 强制更新状态栏
      vscode.window.showInformationMessage('开始工作！💼');
    }),

    // 结束工作 - 仅影响UI状态，不影响收入计算
    vscode.commands.registerCommand('dailyIncome.endWork', () => {
      incomeCalculator.endWork();
      statusBarManager.update(true); // 强制更新状态栏
      vscode.window.showInformationMessage('结束工作！🎉');
    }),

    // 重置今日数据
    vscode.commands.registerCommand('dailyIncome.reset', async () => {
      const result = await vscode.window.showWarningMessage(
        '确定要重置今日收入数据吗？',
        { modal: true },
        '确定',
        '取消'
      );
      if (result === '确定') {
        incomeCalculator.resetToday();
        statusBarManager.update(true); // 强制更新状态栏
        vscode.window.showInformationMessage('已重置今日数据！🔄');
      }
    }),

    // 添加到清理列表
    configManager,
    statusBarManager,
    incomeCalculator,
    syncManager,
  ];

  context.subscriptions.push(...disposables);

  // 启动同步服务
  syncManager.start();
  
  // 额外确保状态栏与计算器状态一致
  setTimeout(() => {
    statusBarManager.update(true);
    console.log('激活完成后额外更新状态栏');
  }, 2000);
}

export function deactivate() {
  console.log('实时收入计算器扩展停用中...');
  
  // 保存当前工作状态以便下次打开时恢复
  // 工作状态仅影响UI显示，收入计算由时间段决定
  
  // 关闭组件
  if (statusBarManager) {
    statusBarManager.dispose();
  }
  
  if (incomeCalculator) {
    // 确保保存最终数据
    incomeCalculator.dispose();
  }
  
  if (syncManager) {
    syncManager.dispose();
  }
  
  if (configManager) {
    configManager.dispose();
  }
  
  console.log('实时收入计算器扩展已停用！');
}
