import * as vscode from 'vscode';

/**
 * 同步配置接口
 */
export interface SyncConfig {
  provider: 'webdav' | 's3' | 'aliyun-oss' | 'local';
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  username?: string;
  password?: string;
}

/**
 * 配置数据接口
 */
export interface ConfigData {
  monthlyIncome: number;
  workDays: number[];
  autoStartWork: boolean;
  useScheduledWorkTime: boolean;
  workStartTime: string;
  workEndTime: string;
  precisionLevel: number;
  overtimeEnabled: boolean;
  overtimeRate: number;
  deductForEarlyLeave: boolean;
  autoSync: boolean;
  syncProvider: string;
  syncConfig?: Partial<SyncConfig>;
  // auto=自适应，fast=1秒，normal=3秒，slow=5秒，或自定义毫秒数
  updateFrequency?: 'auto' | 'fast' | 'normal' | 'slow' | 'custom' | number;
  customUpdateFrequency: number;
  blurStatusBarIncome: boolean; // 是否模糊显示状态栏收入
}

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG: ConfigData = {
  monthlyIncome: 10000,
  workDays: [1, 2, 3, 4, 5],
  autoStartWork: false,
  useScheduledWorkTime: false,
  workStartTime: '09:00',
  workEndTime: '18:00',
  precisionLevel: 2,
  overtimeEnabled: true,
  overtimeRate: 1.5,
  deductForEarlyLeave: false,
  autoSync: false,
  syncProvider: 'local',
  updateFrequency: 'auto',
  customUpdateFrequency: 3000,
  blurStatusBarIncome: false,
};

/**
 * 配置变更事件处理器类型
 */
export type ConfigChangeHandler = (config: ConfigData) => void;

/**
 * 配置管理器类
 * 负责集中管理所有配置参数、默认值和配置更新
 */
export class ConfigManager {
  private configChangeHandlers: ConfigChangeHandler[] = [];
  private cachedConfig: ConfigData | null = null;
  private configWatcher: vscode.Disposable | undefined;

  constructor(private context: vscode.ExtensionContext) {
    // 监听配置变更
    this.configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('dailyIncome')) {
        this.cachedConfig = null; // 清除缓存
        const newConfig = this.getConfig();
        this.notifyConfigChange(newConfig);
      }
    });
  }

  /**
   * 获取完整配置
   * 从VSCode配置中读取并应用默认值
   */
  public getConfig(): ConfigData {
    // 如果有缓存且非强制刷新，直接返回缓存
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const config = vscode.workspace.getConfiguration('dailyIncome');
    const result: ConfigData = {
      monthlyIncome: config.get('monthlyIncome', DEFAULT_CONFIG.monthlyIncome),
      workDays: config.get('workDays', DEFAULT_CONFIG.workDays),
      autoStartWork: config.get('autoStartWork', DEFAULT_CONFIG.autoStartWork),
      useScheduledWorkTime: config.get('useScheduledWorkTime', DEFAULT_CONFIG.useScheduledWorkTime),
      workStartTime: config.get('workStartTime', DEFAULT_CONFIG.workStartTime),
      workEndTime: config.get('workEndTime', DEFAULT_CONFIG.workEndTime),
      precisionLevel: config.get('precisionLevel', DEFAULT_CONFIG.precisionLevel),
      overtimeEnabled: config.get('overtimeEnabled', DEFAULT_CONFIG.overtimeEnabled),
      overtimeRate: config.get('overtimeRate', DEFAULT_CONFIG.overtimeRate),
      deductForEarlyLeave: config.get('deductForEarlyLeave', DEFAULT_CONFIG.deductForEarlyLeave),
      autoSync: config.get('autoSync', DEFAULT_CONFIG.autoSync),
      syncProvider: config.get('syncProvider', DEFAULT_CONFIG.syncProvider),
      syncConfig: config.get('syncConfig', {}),
      customUpdateFrequency: config.get('customUpdateFrequency', 3000),
      blurStatusBarIncome: config.get('blurStatusBarIncome', DEFAULT_CONFIG.blurStatusBarIncome),
    };

    // 特殊处理更新频率，支持自定义值
    const updateFrequencyType = config.get<string>('updateFrequency', 'auto');
    if (updateFrequencyType === 'custom') {
      result.updateFrequency = 'custom';
    } else if (
      updateFrequencyType === 'auto' ||
      updateFrequencyType === 'fast' ||
      updateFrequencyType === 'normal' ||
      updateFrequencyType === 'slow'
    ) {
      result.updateFrequency = updateFrequencyType;
    } else {
      // 默认使用自适应
      result.updateFrequency = 'auto';
    }

    // 验证并修复配置
    this.validateConfig(result);

    // 缓存结果
    this.cachedConfig = result;

    return result;
  }

  /**
   * 刷新配置缓存
   */
  public refreshConfig(): ConfigData {
    this.cachedConfig = null;
    return this.getConfig();
  }

  /**
   * 更新配置
   * @param updates 要更新的配置
   * @param target 配置目标（全局或工作区）
   */
  public async updateConfig(
    updates: Partial<ConfigData>,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<boolean> {
    try {
      console.log('准备更新配置:', updates);
      const config = vscode.workspace.getConfiguration('dailyIncome');

      // 定义有效的配置项列表
      const validConfigKeys: (keyof ConfigData)[] = [
        'monthlyIncome',
        'workDays',
        'autoStartWork',
        'useScheduledWorkTime',
        'workStartTime',
        'workEndTime',
        'precisionLevel',
        'overtimeEnabled',
        'overtimeRate',
        'deductForEarlyLeave',
        'autoSync',
        'syncProvider',
        'updateFrequency',
        'customUpdateFrequency',
        'blurStatusBarIncome',
      ];

      // 逐个更新配置项
      for (const key of validConfigKeys) {
        if (key in updates) {
          console.log(`更新配置项: ${key} =`, updates[key]);
          await config.update(key, updates[key], target);
        }
      }

      // 更新同步配置（特殊处理）
      if ('syncConfig' in updates && updates.syncConfig) {
        // 只保存非敏感信息到VSCode配置
        const nonSensitiveConfig = {
          endpoint: updates.syncConfig.endpoint || '',
          username: updates.syncConfig.username || '',
          bucket: updates.syncConfig.bucket || '',
        };
        await config.update('syncConfig', nonSensitiveConfig, target);
      }

      // 刷新缓存并通知变更
      this.refreshConfig();

      return true;
    } catch (error) {
      console.error('配置更新失败:', error);
      return false;
    }
  }

  /**
   * 注册配置变更处理器
   * @param handler 配置变更处理函数
   */
  public onConfigChange(handler: ConfigChangeHandler): vscode.Disposable {
    this.configChangeHandlers.push(handler);

    // 返回处理器注销函数
    return {
      dispose: () => {
        const index = this.configChangeHandlers.indexOf(handler);
        if (index !== -1) {
          this.configChangeHandlers.splice(index, 1);
        }
      },
    };
  }

  /**
   * 通知所有配置变更处理器
   * @param config 最新配置
   */
  private notifyConfigChange(config: ConfigData): void {
    for (const handler of this.configChangeHandlers) {
      try {
        handler(config);
      } catch (error) {
        console.error('配置变更处理器执行失败:', error);
      }
    }
  }

  /**
   * 验证并修复配置值
   * @param config 配置对象
   */
  private validateConfig(config: ConfigData): void {
    // 确保月收入是合理的数字
    if (
      typeof config.monthlyIncome !== 'number' ||
      isNaN(config.monthlyIncome) ||
      !isFinite(config.monthlyIncome)
    ) {
      config.monthlyIncome = DEFAULT_CONFIG.monthlyIncome;
    }

    // 确保工作日是有效数组
    if (!Array.isArray(config.workDays) || config.workDays.length === 0) {
      config.workDays = [...DEFAULT_CONFIG.workDays];
    } else {
      // 过滤无效的工作日值（只保留0-6之间的数字）
      config.workDays = config.workDays
        .filter(day => typeof day === 'number' && day >= 0 && day <= 6)
        .sort();

      // 如果过滤后为空，使用默认值
      if (config.workDays.length === 0) {
        config.workDays = [...DEFAULT_CONFIG.workDays];
      }
    }

    // 验证工作时间格式
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(config.workStartTime)) {
      config.workStartTime = DEFAULT_CONFIG.workStartTime;
    }
    if (!timeRegex.test(config.workEndTime)) {
      config.workEndTime = DEFAULT_CONFIG.workEndTime;
    }

    // 验证精度等级（0-10之间）
    if (
      typeof config.precisionLevel !== 'number' ||
      config.precisionLevel < 0 ||
      config.precisionLevel > 10
    ) {
      config.precisionLevel = DEFAULT_CONFIG.precisionLevel;
    }

    // 验证加班倍率（最低1.0）
    if (typeof config.overtimeRate !== 'number' || config.overtimeRate < 1.0) {
      config.overtimeRate = DEFAULT_CONFIG.overtimeRate;
    }

    // 验证自定义更新频率（最低100ms，最高60000ms）
    if (
      typeof config.customUpdateFrequency !== 'number' ||
      config.customUpdateFrequency < 100 ||
      config.customUpdateFrequency > 60000
    ) {
      config.customUpdateFrequency = DEFAULT_CONFIG.customUpdateFrequency;
    }
  }

  /**
   * 释放资源
   */
  dispose() {
    if (this.configWatcher) {
      this.configWatcher.dispose();
      this.configWatcher = undefined;
    }

    // 清空所有处理器
    this.configChangeHandlers = [];

    // 清除缓存
    this.cachedConfig = null;
  }
}
