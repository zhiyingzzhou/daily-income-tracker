/**
 * Webview助手函数
 * 提供常用的计算和格式化功能，避免组件中重复逻辑
 */
import { ConfigData } from './types';

/**
 * 计算每月工作天数
 * 基于工作日数组计算平均每月工作天数
 * @param workDays 工作日数组 (0=周日, 1=周一, ..., 6=周六)
 * @returns 每月平均工作天数
 */
export function calculateWorkDaysPerMonth(workDays: number[]): number {
  if (!Array.isArray(workDays) || workDays.length === 0) {
    return 22; // 默认每月22个工作日
  }
  // 4.33 = 52周 / 12个月
  return workDays.length * 4.33;
}

/**
 * 获取标准工作分钟数
 * @param startTime 工作开始时间 (HH:MM)
 * @param endTime 工作结束时间 (HH:MM)
 * @returns 标准工作分钟数
 */
export function getStandardWorkMinutes(startTime: string, endTime: string): number {
  // 确保输入格式正确
  if (!startTime || !endTime) {
    return 8 * 60; // 默认8小时
  }

  try {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // 计算分钟差
    const startTotalMinutes = startHour * 60 + startMinute;
    let endTotalMinutes = endHour * 60 + endMinute;

    // 如果结束时间早于开始时间，视为跨天工作
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60;
    }

    return endTotalMinutes - startTotalMinutes;
  } catch (error) {
    console.error('工作时间解析错误:', error);
    return 8 * 60; // 解析失败则返回默认8小时
  }
}

/**
 * 计算每日目标收入
 * @param config 配置对象
 * @returns 每日目标收入
 */
export function calculateDailyTarget(config: ConfigData): number {
  const workDaysPerMonth = calculateWorkDaysPerMonth(config.workDays);
  return config.monthlyIncome / workDaysPerMonth;
}

/**
 * 格式化时间显示
 * @param minutes 分钟数
 * @returns 格式化后的时间字符串 (例如 "8h 30m")
 */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * 格式化时间显示为小时:分钟
 * @param minutes 分钟数
 * @returns 格式化后的时间字符串 (例如 "8:30")
 */
export function formatTimeAsHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

/**
 * 格式化货币显示
 * @param amount 金额
 * @param precision 精度（小数位数）
 * @returns 格式化后的货币字符串 (例如 "¥1,234.56")
 */
export function formatCurrency(amount: number, precision = 2): string {
  // 确保精度是有效的
  const validPrecision = typeof precision === 'number' && precision >= 0 ? precision : 2;

  try {
    // 使用toFixed来保留精度，避免浮点精度问题
    return `¥${amount.toFixed(validPrecision)}`;
  } catch (error) {
    console.error('货币格式化错误:', error);
    return `¥${(0).toFixed(validPrecision)}`;
  }
}

/**
 * 安全地解析数字，避免NaN和无限值
 * @param value 要解析的值
 * @param defaultValue 默认值
 * @param isInteger 是否解析为整数
 * @returns 解析后的数字
 */
export function safeParseNumber(
  value: string | number,
  defaultValue = 0,
  isInteger = false
): number {
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return defaultValue;
    return isInteger ? Math.round(value) : value;
  }

  if (!value || typeof value !== 'string') return defaultValue;
  const trimmed = value.trim();
  if (trimmed === '') return defaultValue;

  const num = isInteger ? parseInt(trimmed) : parseFloat(trimmed);

  if (isNaN(num) || !isFinite(num)) return defaultValue;

  // 限制极值范围
  const MIN_VALUE = -Number.MAX_SAFE_INTEGER;
  const MAX_VALUE = Number.MAX_SAFE_INTEGER;

  if (num < MIN_VALUE) return MIN_VALUE;
  if (num > MAX_VALUE) return MAX_VALUE;

  return num;
}

/**
 * 验证时间格式是否为HH:MM
 * @param timeStr 时间字符串
 * @returns 是否合法
 */
export function isValidTimeFormat(timeStr: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(timeStr);
}

/**
 * 深度比较两个值是否相等
 * @param obj1 第一个要比较的值
 * @param obj2 第二个要比较的值
 * @returns 两个值是否相等
 */
export function isEqual(obj1: any, obj2: any): boolean {
  // 处理基本类型
  if (obj1 === obj2) return true;

  // 处理null或undefined
  if (obj1 == null || obj2 == null) return obj1 === obj2;

  // 处理非对象类型
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

  // 处理数组
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    return obj1.every((val, idx) => isEqual(val, obj2[idx]));
  }

  // 处理日期
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  // 处理普通对象
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every(
    key => Object.prototype.hasOwnProperty.call(obj2, key) && isEqual(obj1[key], obj2[key])
  );
}
