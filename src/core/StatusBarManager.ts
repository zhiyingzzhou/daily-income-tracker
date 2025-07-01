import * as vscode from 'vscode';
import { IncomeCalculator } from './IncomeCalculator';
import { ConfigManager } from './ConfigManager';
import * as Utils from './Utils';
import { UPDATE_FREQUENCY, ACTIVITY_DETECTION } from './constants';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private calculator: IncomeCalculator;
  private configManager: ConfigManager;
  private updateTimer?: ReturnType<typeof setInterval>;
  private lastUpdate: number = 0;
  private lastUserActivity: number = Date.now();
  private isAutoMode: boolean = true;
  private currentUpdateFrequency: number = UPDATE_FREQUENCY.AUTO_ACTIVE;
  private activityTrackingDisposable?: vscode.Disposable;
  private lastValues: { income: number; workedMinutes: number; isWorking: boolean } = {
    income: 0,
    workedMinutes: 0,
    isWorking: false,
  };
  private configChangeListener?: vscode.Disposable;

  constructor(calculator: IncomeCalculator, configManager: ConfigManager) {
    this.calculator = calculator;
    this.configManager = configManager;

    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    this.statusBarItem.command = 'dailyIncome.openSettings';
    this.statusBarItem.show();

    // 监听配置变更
    this.configChangeListener = this.configManager.onConfigChange(() => {
      console.log('StatusBarManager: 检测到配置变更，正在更新...');
      this.updateConfiguration();
      this.update(true); // 配置变更时强制更新
    });

    // 先更新配置，确保使用最新配置
    this.updateConfiguration();

    // 启用活动跟踪
    this.setupActivityTracking();

    // 设置更新计时器
    this.setupUpdateTimer();

    // 立即进行首次更新
    this.update(true);
    
    // 额外添加延迟更新，确保初始化完成后再次更新
    setTimeout(() => {
      this.update(true);
      console.log('StatusBarManager: 延迟更新状态');
    }, 3000);
  }

  /**
   * 设置更新计时器
   */
  private setupUpdateTimer() {
    // 清除现有计时器
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    // 创建新计时器
    this.updateTimer = setInterval(() => {
      // 自适应模式：根据最近活动时间调整更新频率
      if (this.isAutoMode) {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastUserActivity;
        const shouldBeActive = timeSinceLastActivity < ACTIVITY_DETECTION.IDLE_TIMEOUT; // 短时间内有活动则为活跃状态

        const targetFrequency = shouldBeActive
          ? UPDATE_FREQUENCY.AUTO_ACTIVE
          : UPDATE_FREQUENCY.AUTO_IDLE;

        // 如果频率需要变化
        if (this.currentUpdateFrequency !== targetFrequency) {
          this.currentUpdateFrequency = targetFrequency;
          this.setupUpdateTimer(); // 重建计时器
          return;
        }
      }

      this.update();
    }, this.currentUpdateFrequency);
  }

  /**
   * 更新配置设置
   */
  private updateConfiguration() {
    // 强制获取最新配置，不使用缓存
    const config = this.configManager.refreshConfig();
    const updateFreq = config.updateFrequency;

    const oldMode = this.isAutoMode;
    const oldFrequency = this.currentUpdateFrequency;

    if (updateFreq === 'auto') {
      this.isAutoMode = true;
      this.currentUpdateFrequency = UPDATE_FREQUENCY.AUTO_ACTIVE; // 初始为活跃状态
    } else if (updateFreq === 'fast') {
      this.isAutoMode = false;
      this.currentUpdateFrequency = UPDATE_FREQUENCY.FAST;
    } else if (updateFreq === 'normal') {
      this.isAutoMode = false;
      this.currentUpdateFrequency = UPDATE_FREQUENCY.NORMAL;
    } else if (updateFreq === 'slow') {
      this.isAutoMode = false;
      this.currentUpdateFrequency = UPDATE_FREQUENCY.SLOW;
    } else if (updateFreq === 'custom') {
      // 处理自定义频率
      this.isAutoMode = false;
      this.currentUpdateFrequency = Math.max(100, config.customUpdateFrequency); // 确保至少100ms
    } else {
      // 默认使用自适应模式
      this.isAutoMode = true;
      this.currentUpdateFrequency = UPDATE_FREQUENCY.AUTO_ACTIVE;
    }

    // 如果模式或频率发生变化，记录详细日志
    if (oldMode !== this.isAutoMode || oldFrequency !== this.currentUpdateFrequency) {
      console.log(
        `[StatusBar] 更新频率已变更: ${oldMode ? '自适应' : oldFrequency + 'ms'} -> ${this.isAutoMode ? '自适应' : this.currentUpdateFrequency + 'ms'}`
      );
    }

    // 如果自适应模式已启用，设置活动跟踪
    if (this.isAutoMode) {
      this.setupActivityTracking();
    } else {
      this.disposeActivityTracking();
    }

    // 更新计时器使用新频率
    if (this.updateTimer) {
      this.setupUpdateTimer();
    }

    // 立即更新状态栏显示
    this.update(true);
  }

  /**
   * 设置用户活动跟踪
   */
  private setupActivityTracking() {
    // 如果不是自适应模式，不需要跟踪
    if (!this.isAutoMode) {
      return;
    }

    // 清除现有的订阅
    this.disposeActivityTracking();

    // 创建事件组合订阅
    const subscriptions: vscode.Disposable[] = [];

    // 监听编辑器事件
    subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => this.recordActivity()));
    subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => this.recordActivity()));
    subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => this.recordActivity()));

    // 合并为一个可释放对象
    this.activityTrackingDisposable = {
      dispose: () => {
        for (const sub of subscriptions) {
          sub.dispose();
        }
        subscriptions.length = 0;
      },
    };
  }

  /**
   * 记录用户活动
   */
  private recordActivity() {
    this.lastUserActivity = Date.now();
  }

  /**
   * 释放活动跟踪资源
   */
  private disposeActivityTracking() {
    if (this.activityTrackingDisposable) {
      this.activityTrackingDisposable.dispose();
      this.activityTrackingDisposable = undefined;
    }
  }

  update(force: boolean = false) {
    const now = Date.now();
    // 获取工作状态 - 工作状态只影响UI显示
    const isWorking = this.calculator.isWorking();

    // 限制更新频率：自适应模式下会自动调整，这里主要防止过于频繁的手动调用
    if (!force && now - this.lastUpdate < 100) {
      return;
    }

    // 获取当前值 - 收入和工作时间由时间段决定，而非工作状态
    const income = this.calculator.getCurrentIncome();
    const workedMinutes = this.calculator.getTodayWorkedMinutes();

    // 调试输出
    console.log(`StatusBarManager: 状态更新 - 工作状态=${isWorking}, 收入=${income}, 工作时间=${workedMinutes}分钟`);

    // 如果值没有变化且非强制更新，跳过更新
    if (
      !force &&
      income === this.lastValues.income &&
      workedMinutes === this.lastValues.workedMinutes &&
      isWorking === this.lastValues.isWorking
    ) {
      return;
    }

    // 更新缓存的值和最后更新时间
    this.lastValues = { income, workedMinutes, isWorking };
    this.lastUpdate = now;

    // 记录用户活动（状态更新可能是由用户操作触发的）
    this.recordActivity();

    const config = this.configManager.refreshConfig();
    const precision = config.precisionLevel;

    // 使用工具函数格式化数据
    const formattedIncome = Utils.formatCurrency(income, precision);
    const formattedTime = Utils.formatTimeAsHHMM(workedMinutes);

    // 状态图标 - 根据isWorking状态显示图标，但不影响收入计算
    const statusIcon = isWorking ? '💼' : '⏸️';
    const statusText = isWorking ? '工作中' : '休息中';

    // 更新状态栏文本
    if (config.blurStatusBarIncome) {
      // 如果启用了隐私模式，隐藏收入金额
      this.statusBarItem.text = `${statusIcon} $(eye-closed) ${formattedTime}`;
      // 使用警告背景色标识隐私模式
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.tooltip = `当前状态: ${statusText}\n${this.buildTooltip(income, workedMinutes, isWorking)}\n\n隐私模式已开启`;
    } else {
      // 正常显示
      this.statusBarItem.text = `${statusIcon} ${formattedIncome} (${formattedTime})`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = `当前状态: ${statusText}\n${this.buildTooltip(income, workedMinutes, isWorking)}`;
    }
  }

  private buildTooltip(income: number, workedMinutes: number, isWorking: boolean): string {
    const config = this.configManager.getConfig();
    const { monthlyIncome, workDays, workStartTime, workEndTime, precisionLevel } = config;

    // 使用工具函数计算每月工作天数
    const workDaysPerMonth = Utils.calculateWorkDaysPerMonth(workDays);
    const dailyTarget = monthlyIncome / workDaysPerMonth;
    const progress = ((income / dailyTarget) * 100).toFixed(1);

    // 使用工具函数格式化时间
    const formattedTime = Utils.formatTime(workedMinutes);

    // 工作日名称映射
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const workDayNames = workDays.map(day => dayNames[day]).join(', ');

    // 获取当前更新模式文本
    let updateModeText = '自适应';
    if (config.updateFrequency === 'fast') {
      updateModeText = '快速 (1秒)';
    } else if (config.updateFrequency === 'normal') {
      updateModeText = '标准 (3秒)';
    } else if (config.updateFrequency === 'slow') {
      updateModeText = '慢速 (5秒)';
    } else if (config.updateFrequency === 'custom') {
      updateModeText = `自定义 (${config.customUpdateFrequency}ms)`;
    }

    // 组装tooltip文本
    let tooltip = `💰 今日收入: ${Utils.formatCurrency(income, precisionLevel)}\n`;
    tooltip += `🎯 目标收入: ${Utils.formatCurrency(dailyTarget, precisionLevel)} (${progress}%)\n`;
    tooltip += `⏰ 工作时间: ${formattedTime}\n`;
    tooltip += `📅 标准工时: ${workStartTime} - ${workEndTime}\n`;
    tooltip += `📋 工作日: ${workDayNames}\n`;
    tooltip += `📊 状态: ${isWorking ? '工作中' : '休息中'}\n`;
    tooltip += `🔄 更新模式: ${updateModeText}\n\n`;
    tooltip += `点击打开设置面板`;

    return tooltip;
  }

  dispose() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }

    if (this.configChangeListener) {
      this.configChangeListener.dispose();
      this.configChangeListener = undefined;
    }

    this.disposeActivityTracking();
    this.statusBarItem.dispose();
  }
}
