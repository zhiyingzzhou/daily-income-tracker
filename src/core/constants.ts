/**
 * 更新频率常量（毫秒）
 */
export const UPDATE_FREQUENCY = {
  FAST: 1000,
  NORMAL: 3000,
  SLOW: 5000,
  AUTO_ACTIVE: 1000, // 自适应模式：活跃状态
  AUTO_IDLE: 5000, // 自适应模式：空闲状态
};

/**
 * 存储键常量
 */
export const STORAGE_KEYS = {
  DAILY_DATA: 'dailyIncome.dailyData',
  HISTORY_PREFIX: 'dailyIncome.history.',
  SETTINGS_DRAFT: 'basic-settings-draft',
};

/**
 * 用户活动检测常量
 */
export const ACTIVITY_DETECTION = {
  IDLE_TIMEOUT: 30000, // 30秒无活动视为空闲
};
