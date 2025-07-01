// 导入全局类型定义
import {
  SyncConfig,
  ConfigData,
  WorkSession,
  DailyData,
  AppData,
  MessageEvent,
} from '../types/global.d';

// 重新导出类型，以便在webview组件中使用
export type { SyncConfig, ConfigData, WorkSession, DailyData, AppData, MessageEvent };
