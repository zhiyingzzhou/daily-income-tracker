declare global {
  interface Window {
    postMessage: (message: any, targetOrigin: string) => void;
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
    removeEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  }
}

export {};

/**
 * 全局类型定义
 */

// 同步配置接口
export interface SyncConfig {
  provider: 'webdav' | 's3' | 'aliyun-oss' | 'local';
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  username?: string;
  password?: string;
}

// 配置数据接口
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
  updateFrequency?: 'auto' | 'fast' | 'normal' | 'slow' | 'custom' | number;
  customUpdateFrequency?: number;
  blurStatusBarIncome: boolean;
}

// 工作会话接口
export interface WorkSession {
  startTime: Date | string;
  endTime?: Date | string;
  date: string;
}

// 每日数据接口
export interface DailyData {
  date: string;
  sessions: WorkSession[];
  totalWorkedMinutes: number;
  totalIncome: number;
  isWorkday: boolean;
}

// 应用数据接口
export interface AppData {
  config: ConfigData;
  dailyData: DailyData;
  isWorking: boolean;
}

// 消息事件接口
export interface MessageEvent {
  data: {
    type: string;
    data?: any;
    config?: any;
    provider?: string;
  };
}

// 工具函数接口
export interface UtilityFunctions {
  calculateWorkDaysPerMonth: (workDays: number[]) => number;
  getStandardWorkMinutes: (startTime: string, endTime: string) => number;
  formatTime: (minutes: number) => string;
  formatCurrency: (amount: number, precision?: number) => string;
}
