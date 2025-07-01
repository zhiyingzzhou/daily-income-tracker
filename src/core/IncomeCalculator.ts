import * as vscode from 'vscode';
import dayjs from 'dayjs';
import * as Utils from './Utils';
import { ConfigManager } from './ConfigManager';
import { ConfigData, WorkSession, DailyData } from '../types/global';
import { STORAGE_KEYS, UPDATE_FREQUENCY, ACTIVITY_DETECTION } from './constants';

export class IncomeCalculator implements vscode.Disposable {
  private context: vscode.ExtensionContext;
  private configManager: ConfigManager;
  private updateTimer?: ReturnType<typeof setInterval>;
  private currentSession?: WorkSession;
  private dailyData: DailyData;
  private cachedConfig: ConfigData | null = null;
  private configChangeListener: vscode.Disposable | undefined;
  private lastUserActivity: number = Date.now();
  private isAutoMode: boolean = true;
  private currentUpdateFrequency: number = UPDATE_FREQUENCY.AUTO_ACTIVE;
  private activityTrackingDisposable?: vscode.Disposable;
  private finalIncome: number | null = null;
  private finalWorkedMinutes: number | null = null;

  // 内部缓存，用于减少计算开销
  private lastCalculation: {
    timestamp: number;
    income: number;
    workedMinutes: number;
  } = { timestamp: 0, income: 0, workedMinutes: 0 };

  constructor(context: vscode.ExtensionContext, configManager: ConfigManager) {
    this.context = context;
    this.configManager = configManager;
    this.dailyData = this.loadTodayData();

    // 订阅配置变更事件
    this.configChangeListener = this.configManager.onConfigChange(config => {
      this.cachedConfig = config;
      this.updateConfiguration();
    });

    // 初始设置更新频率
    this.updateUpdateFrequency();
  }

  start() {
    // 启用活动跟踪
    this.setupActivityTracking();

    // 设置更新计时器
    this.setupUpdateTimer();

    // 检查是否需要自动开始工作
    this.checkInitialAutoStart();

    // 检查是否有未结束的工作会话
    this.checkUnfinishedSession();
  }

  /**
   * 检查并恢复未结束的会话
   */
  private checkUnfinishedSession() {
    // 检查是否已有今天的未结束会话
    const hasUnfinishedSession = this.dailyData.sessions.some(session => !session.endTime);
    if (hasUnfinishedSession) {
      // 找到未结束的会话并设置为当前会话
      for (const session of this.dailyData.sessions) {
        if (!session.endTime) {
          this.currentSession = session;
          console.log('发现并恢复未结束的工作会话', session);
          this.invalidateCache(); // 清除缓存
          this.calculateIncome(); // 立即计算一次
          break;
        }
      }
    }
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

      this.calculateIncome();
    }, this.currentUpdateFrequency);
  }

  /**
   * 更新更新频率设置
   */
  private updateUpdateFrequency() {
    // 强制获取最新配置，不使用缓存
    this.cachedConfig = null;
    const config = this.getConfig();
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
      const customFreq = config.customUpdateFrequency;
      this.currentUpdateFrequency = Math.max(100, customFreq || 3000); // 确保至少100ms
    } else {
      // 默认使用自适应模式
      this.isAutoMode = true;
      this.currentUpdateFrequency = UPDATE_FREQUENCY.AUTO_ACTIVE;
    }

    // 如果模式或频率发生变化，记录详细日志
    if (oldMode !== this.isAutoMode || oldFrequency !== this.currentUpdateFrequency) {
      console.log(
        `更新频率已变更: ${oldMode ? '自适应' : oldFrequency + 'ms'} -> ${this.isAutoMode ? '自适应' : this.currentUpdateFrequency + 'ms'}`
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

    console.log(
      `收入计算更新频率已设置为: ${this.isAutoMode ? '自适应模式' : this.currentUpdateFrequency + 'ms'}`
    );
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

  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    if (this.configChangeListener) {
      this.configChangeListener.dispose();
      this.configChangeListener = undefined;
    }
    this.disposeActivityTracking();
    this.saveData();
  }

  private checkInitialAutoStart() {
    const config = this.getConfig();
    const autoStartWork = config.autoStartWork;
    const isWorkDay = this.isWorkday();
    const workStartTime = config.workStartTime;
    const workEndTime = config.workEndTime;

    // 检查当前时间是否在工作时间范围内
    const now = new Date();
    const today = dayjs().format('YYYY-MM-DD');
    const workStart = dayjs(`${today} ${workStartTime}`, 'YYYY-MM-DD HH:mm').toDate();
    const workEnd = dayjs(`${today} ${workEndTime}`, 'YYYY-MM-DD HH:mm').toDate();
    const isWithinWorkHours = now >= workStart && now <= workEnd;

    if (autoStartWork && !this.isWorking() && isWorkDay && isWithinWorkHours) {
      console.log('✅ 自动开始工作条件满足，立即开始工作');
      this.startWork();
      vscode.window.showInformationMessage('🎯 自动开始工作！');
    }
  }

  public checkAutoStart() {
    const config = this.getConfig();
    const autoStartWork = config.autoStartWork;
    const isWorkDay = this.isWorkday();
    const workStartTime = config.workStartTime;
    const workEndTime = config.workEndTime;

    // 检查当前时间是否在工作时间范围内
    const now = new Date();
    const today = dayjs().format('YYYY-MM-DD');
    const workStart = dayjs(`${today} ${workStartTime}`, 'YYYY-MM-DD HH:mm').toDate();
    const workEnd = dayjs(`${today} ${workEndTime}`, 'YYYY-MM-DD HH:mm').toDate();
    const isWithinWorkHours = now >= workStart && now <= workEnd;

    if (autoStartWork && !this.isWorking() && isWorkDay && isWithinWorkHours) {
      console.log('✅ 配置启用自动开始工作，立即开始');
      this.startWork();
      vscode.window.showInformationMessage('🎯 自动开始工作！');
    }
  }

  startWork() {
    if (this.currentSession) {
      vscode.window.showWarningMessage('已经在工作中了！');
      return;
    }

    // 重置最终收入，允许重新开始计算
    this.finalIncome = null;
    this.finalWorkedMinutes = null;

    // 检查是否已有今天的未结束会话
    const hasUnfinishedSession = this.dailyData.sessions.some(session => !session.endTime);
    if (hasUnfinishedSession) {
      // 找到未结束的会话并设置为当前会话
      for (const session of this.dailyData.sessions) {
        if (!session.endTime) {
          this.currentSession = session;
          break;
        }
      }
      console.log('找到未结束的会话，恢复为当前会话');
      this.invalidateCache(); // 清除缓存
      this.calculateIncome(); // 立即计算一次
      return;
    }

    this.currentSession = {
      startTime: new Date(),
      date: dayjs().format('YYYY-MM-DD'),
    };

    // 确保会话数组存在
    if (!Array.isArray(this.dailyData.sessions)) {
      this.dailyData.sessions = [];
    }

    this.dailyData.sessions.push(this.currentSession);
    this.invalidateCache(); // 清除缓存
    this.calculateIncome(); // 立即计算一次
    this.saveData();
    
    console.log('开始工作，当前会话：', this.currentSession, '工作状态：', this.isWorking());
  }

  endWork() {
    if (!this.currentSession) {
      vscode.window.showWarningMessage('没有正在进行的工作会话！');
      return;
    }

    const endTime = new Date();

    try {
      // 找到并更新sessions数组中对应的会话
      for (const session of this.dailyData.sessions) {
        if (!session.endTime) {
          // 直接比较会话对象，而不是时间戳
          if (session === this.currentSession) {
            session.endTime = endTime;
            break;
          }
        }
      }

      // 设置当前会话的结束时间
      this.currentSession.endTime = endTime;
      
      // 记录日志，帮助调试
      console.log('结束工作，会话信息：', JSON.stringify(this.currentSession));
      
      // 在结束工作时，先计算一次最终收入
      this.calculateIncome();
      
      // 保存最终收入值和工作时间
      this.finalIncome = this.dailyData.totalIncome;
      this.finalWorkedMinutes = this.dailyData.totalWorkedMinutes;
      
      console.log(`结束工作时记录最终值: 收入=${this.finalIncome}, 工作时间=${this.finalWorkedMinutes}分钟`);
      
      // 清除当前会话引用
      this.currentSession = undefined;

      this.invalidateCache(); // 清除缓存
      this.saveData();
    } catch (error: any) {
      console.error('结束工作时出错：', error);
      // 尝试强制结束
      this.currentSession = undefined;
      vscode.window.showErrorMessage(`结束工作时出错: ${error.message}`);
    }
  }

  resetToday() {
    this.currentSession = undefined;
    this.finalIncome = null;  // 重置最终收入
    this.finalWorkedMinutes = null;  // 重置最终工作时间
    this.dailyData = {
      date: dayjs().format('YYYY-MM-DD'),
      sessions: [],
      totalWorkedMinutes: 0,
      totalIncome: 0,
      isWorkday: this.isWorkday(),
    };
    this.invalidateCache(); // 清除缓存
    this.saveData();
  }

  getCurrentIncome(): number {
    // 如果已结束工作且有固定收入，直接返回固定值
    if (!this.isWorking() && this.finalIncome !== null) {
      return this.finalIncome;
    }
    
    // 使用缓存减少计算频率
    const now = Date.now();
    if (now - this.lastCalculation.timestamp < 2000 && !this.isWorking()) {
      return this.lastCalculation.income;
    }

    this.calculateIncome();
    return this.dailyData.totalIncome;
  }

  getTodayWorkedMinutes(): number {
    // 如果已结束工作且有固定工作时间，直接返回固定值
    if (!this.isWorking() && this.finalWorkedMinutes !== null) {
      return this.finalWorkedMinutes;
    }
    
    // 使用缓存减少计算频率
    const now = Date.now();
    if (now - this.lastCalculation.timestamp < 2000 && !this.isWorking()) {
      return this.lastCalculation.workedMinutes;
    }

    return this.dailyData.totalWorkedMinutes;
  }

  isWorking(): boolean {
    return !!this.currentSession;
  }

  updateConfiguration() {
    // 重置缓存
    this.invalidateCache();

    // 强制刷新配置
    this.cachedConfig = null;
    const config = this.getConfig();

    // 更新当前日期是否为工作日
    this.dailyData.isWorkday = this.isWorkday();

    // 更新更新频率设置
    this.updateUpdateFrequency();

    // 记录当前配置状态
    console.log(
      `配置更新: 更新频率=${config.updateFrequency}, 自适应模式=${this.isAutoMode}, 当前频率=${this.currentUpdateFrequency}ms`
    );

    // 重新计算收入
    this.calculateIncome();

    // 检查是否需要自动开始工作
    this.checkAutoStart();
  }

  private calculateIncome() {
    const now = Date.now();
    const config = this.getConfig();
    const isWorking = this.isWorking();

    // 如果不在工作状态且有已记录的最终值，则使用这些值
    if (!isWorking && this.finalIncome !== null && this.finalWorkedMinutes !== null) {
      this.dailyData.totalIncome = this.finalIncome;
      this.dailyData.totalWorkedMinutes = this.finalWorkedMinutes;
      
      // 更新缓存
      this.lastCalculation = {
        timestamp: Date.now(),
        income: this.finalIncome,
        workedMinutes: this.finalWorkedMinutes,
      };
      
      console.log(`使用固定的最终值: 收入=${this.finalIncome}, 工作时间=${this.finalWorkedMinutes}分钟`);
      return;
    }

    // 不是工作日，跳过计算
    if (!this.dailyData.isWorkday) {
      this.lastCalculation = {
        timestamp: now,
        income: 0,
        workedMinutes: 0,
      };
      this.dailyData.totalIncome = 0;
      this.dailyData.totalWorkedMinutes = 0;
      return;
    }

    const {
      monthlyIncome,
      workDays,
      workStartTime,
      workEndTime,
      overtimeEnabled,
      overtimeRate,
      deductForEarlyLeave,
      useScheduledWorkTime,
    } = config;

    // 确保当前dailyData的日期是今天
    this.ensureCurrentDayData();

    // 计算每日基本收入
    const workDaysPerMonth = Utils.calculateWorkDaysPerMonth(workDays);
    const dailyIncome = monthlyIncome / workDaysPerMonth;
    const standardWorkMinutes = Utils.getStandardWorkMinutes(workStartTime, workEndTime);
    const incomePerMinute = dailyIncome / standardWorkMinutes;

    // 获取当前时间和今天的日期
    const currentTime = new Date();
    const today = dayjs().format('YYYY-MM-DD');

    // 解析工作开始和结束时间
    const workStartTimeObj = dayjs(`${today} ${workStartTime}`, 'YYYY-MM-DD HH:mm').toDate();
    const workEndTimeObj = dayjs(`${today} ${workEndTime}`, 'YYYY-MM-DD HH:mm').toDate();

    // 如果结束时间早于开始时间，视为跨天，加上一天
    if (workEndTimeObj < workStartTimeObj) {
      workEndTimeObj.setDate(workEndTimeObj.getDate() + 1);
    }

    // 计算工作分钟数
    let totalMinutes = 0;
    let totalIncome = 0;

    // 如果当前时间在工作时间范围内
    if (currentTime >= workStartTimeObj && currentTime <= workEndTimeObj) {
      // 计算已工作的分钟数
      totalMinutes = (currentTime.getTime() - workStartTimeObj.getTime()) / (1000 * 60);

      // 计算标准工作时间和加班时间
      const workEndTimeMinutes = Utils.parseTimeToMinutes(workEndTime);
      const currentTimeOfDay = currentTime.getHours() * 60 + currentTime.getMinutes();

      // 是否有加班时间
      let overtimeMinutes = 0;
      let regularMinutes = totalMinutes;

      if (overtimeEnabled && currentTimeOfDay > workEndTimeMinutes) {
        // 计算加班时间
        const workStartTimeMinutes = Utils.parseTimeToMinutes(workStartTime);
        const regularEndTime = workEndTimeMinutes - workStartTimeMinutes;

        // 标准工作时间
        regularMinutes = Math.min(totalMinutes, regularEndTime);

        // 加班时间
        overtimeMinutes = Math.max(0, totalMinutes - regularMinutes);
      }

      // 计算早退扣减
      let earlyLeaveDeduction = 0;
      if (deductForEarlyLeave) {
        // 早退逻辑保留但不再应用，因为现在是实时计算
      }

      // 计算收入
      const regularIncome = regularMinutes * incomePerMinute;
      const overtimeIncome = overtimeMinutes * incomePerMinute * overtimeRate;
      totalIncome = regularIncome + overtimeIncome - earlyLeaveDeduction;
    }
    // 如果当前时间已经超过工作结束时间
    else if (currentTime > workEndTimeObj) {
      // 计算整个工作日的分钟数
      totalMinutes = (workEndTimeObj.getTime() - workStartTimeObj.getTime()) / (1000 * 60);

      // 计算标准工作时间和加班时间
      const standardMinutes = standardWorkMinutes;
      const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes);

      // 计算收入
      const regularIncome = standardMinutes * incomePerMinute;
      const overtimeIncome = overtimeEnabled ? overtimeMinutes * incomePerMinute * overtimeRate : 0;
      totalIncome = regularIncome + overtimeIncome;
    }
    // 如果当前时间早于工作开始时间，不计算收入
    else {
      totalMinutes = 0;
      totalIncome = 0;
    }

    // 更新数据
    this.dailyData.totalWorkedMinutes = Math.round(totalMinutes);
    this.dailyData.totalIncome = Math.round(totalIncome * 100) / 100; // 四舍五入到分

    // 更新缓存
    this.lastCalculation = {
      timestamp: Date.now(),
      income: this.dailyData.totalIncome,
      workedMinutes: this.dailyData.totalWorkedMinutes,
    };

    // 记录调试信息
    console.log(`收入计算：工作状态=${this.isWorking()}, 工作时间=${totalMinutes.toFixed(2)}分钟, 收入=${totalIncome.toFixed(2)}元`);
  }

  private ensureCurrentDayData() {
    const today = dayjs().format('YYYY-MM-DD');

    // 如果日期不是今天，保存历史数据并创建新的今天数据
    if (this.dailyData.date !== today) {
      // 保存历史数据
      this.saveHistoricalData(this.dailyData);

      // 创建新的今天数据
      this.dailyData = {
        date: today,
        sessions: [],
        totalWorkedMinutes: 0,
        totalIncome: 0,
        isWorkday: this.isWorkday(),
      };

      // 更新缓存
      this.invalidateCache();

      // 如果有正在进行的会话，结束它
      if (this.currentSession) {
        this.endWork();
      }
    }
  }

  private saveHistoricalData(data: DailyData) {
    const key = STORAGE_KEYS.HISTORY_PREFIX + data.date;
    this.context.globalState.update(key, data).then(
      () => console.log(`历史数据已保存: ${data.date}`),
      err => console.error(`历史数据保存失败: ${data.date}`, err)
    );
  }

  private isWorkday(): boolean {
    const config = this.getConfig();
    return Utils.isWorkday(config.workDays);
  }

  private getConfig(): ConfigData {
    if (this.cachedConfig) return this.cachedConfig;
    this.cachedConfig = this.configManager.getConfig();
    return this.cachedConfig;
  }

  private loadTodayData(): DailyData {
    // 获取今天的日期
    const today = dayjs().format('YYYY-MM-DD');

    // 从存储中加载数据
    const storedData = this.context.globalState.get<any>(STORAGE_KEYS.DAILY_DATA);

    // 如果没有存储数据或者存储的日期不是今天，创建新的数据
    if (!storedData || storedData.date !== today) {
      // 重置最终收入和工作时间
      this.finalIncome = null;
      this.finalWorkedMinutes = null;
      
      return {
        date: today,
        sessions: [],
        totalWorkedMinutes: 0,
        totalIncome: 0,
        isWorkday: this.isWorkday(),
      };
    }

    // 恢复最终收入和工作时间
    if (storedData._finalIncome !== undefined) {
      this.finalIncome = storedData._finalIncome;
    }
    
    if (storedData._finalWorkedMinutes !== undefined) {
      this.finalWorkedMinutes = storedData._finalWorkedMinutes;
    }

    // 确保会话数据中包含必要的属性
    if (storedData.sessions) {
      storedData.sessions = storedData.sessions
        .filter(s => {
          if (!s.date || !s.startTime) return false;
          return true;
        })
        .map(s => {
          // 确保会话对象有正确的日期格式
          return {
            ...s,
            date: s.date || today,
          };
        });
    } else {
      storedData.sessions = [];
    }

    // 确保其他属性存在
    storedData.totalWorkedMinutes = storedData.totalWorkedMinutes || 0;
    storedData.totalIncome = storedData.totalIncome || 0;
    storedData.isWorkday = storedData.isWorkday ?? this.isWorkday();

    // 删除额外字段，确保返回类型符合DailyData接口
    const { _finalIncome, _finalWorkedMinutes, ...dailyData } = storedData;
    
    return dailyData;
  }

  private saveData() {
    // 在保存数据时，一并保存最终收入和工作时间
    const dataToSave = {
      ...this.dailyData,
      // 添加额外字段
      _finalIncome: this.finalIncome,
      _finalWorkedMinutes: this.finalWorkedMinutes
    };
    
    this.context.globalState.update(STORAGE_KEYS.DAILY_DATA, dataToSave).then(
      () => console.log('每日数据已保存，包含最终收入数据'),
      err => console.error('每日数据保存失败', err)
    );
  }

  private invalidateCache() {
    this.lastCalculation = { timestamp: 0, income: 0, workedMinutes: 0 };
  }

  getDailyData(): DailyData {
    this.calculateIncome();
    return { ...this.dailyData }; // 返回副本，避免外部修改
  }

  getHistoryData(date: string): DailyData | null {
    const key = STORAGE_KEYS.HISTORY_PREFIX + date;
    const data = this.context.globalState.get<DailyData>(key);
    return data || null;
  }

  dispose() {
    this.stop();
    this.saveData();

    // 确保释放其他资源
    this.cachedConfig = null;
  }
}
