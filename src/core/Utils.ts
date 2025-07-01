import dayjs from 'dayjs';

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
 * 判断当前日期是否为工作日
 * @param workDays 工作日数组 (0=周日, 1=周一, ..., 6=周六)
 * @param date 要检查的日期，默认为今天
 * @returns 是否为工作日
 */
export function isWorkday(workDays: number[], date = new Date()): boolean {
  if (!Array.isArray(workDays) || workDays.length === 0) {
    return false;
  }
  const day = dayjs(date).day(); // 0=周日, 1=周一, ..., 6=周六
  return workDays.includes(day);
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
 * 解析时间字符串为分钟数
 * @param timeStr 时间字符串 (HH:MM)
 * @returns 分钟数
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0;
  }

  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error('无效的时间格式');
    }
    return hours * 60 + minutes;
  } catch (error) {
    console.error('时间解析错误:', error);
    return 0;
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
