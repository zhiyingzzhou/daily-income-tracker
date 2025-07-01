import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { AppData } from '../types';
import * as helpers from '../helpers';

interface DashboardProps {
  data: AppData;
  onSendMessage: (type: string, payload?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onSendMessage }) => {
  // 保存最新数据的本地状态
  const [currentData, setCurrentData] = useState(data);

  // 使用useCallback优化事件处理函数
  const handleStartWork = useCallback(() => {
    onSendMessage('startWork');
  }, [onSendMessage]);

  const handleEndWork = useCallback(() => {
    onSendMessage('endWork');
  }, [onSendMessage]);

  const handleResetToday = useCallback(() => {
    onSendMessage('resetToday');
  }, [onSendMessage]);

  // 降低更新频率：从每秒改为每3秒
  useEffect(() => {
    // 立即使用传入的数据
    setCurrentData(data);

    // 创建定时器每3秒请求一次最新数据
    const timer = setInterval(() => {
      onSendMessage('getInitialData');
    }, 3000);

    // 组件卸载时清理定时器
    return () => clearInterval(timer);
  }, [data, onSendMessage]);

  // 当props更新时，更新本地状态
  useEffect(() => {
    setCurrentData(data);
  }, [data]);

  const { config, dailyData, isWorking } = currentData;

  // 使用useMemo缓存计算结果，避免不必要的重复计算
  const calculatedValues = useMemo(() => {
    // 使用辅助函数计算每日目标收入
    const dailyTarget = helpers.calculateDailyTarget(config);
    const progress = Math.min(100, (dailyData.totalIncome / dailyTarget) * 100);
    const remainingTarget = Math.max(0, dailyTarget - dailyData.totalIncome);

    // 计算工作时长的目标（使用配置中的工作时间范围）
    const dailyTargetMinutes = helpers.getStandardWorkMinutes(config.workStartTime, config.workEndTime);
    const timeProgress = Math.min(100, (dailyData.totalWorkedMinutes / dailyTargetMinutes) * 100);

    return {
      dailyTarget,
      progress,
      remainingTarget,
      dailyTargetMinutes,
      timeProgress,
      formattedIncome: helpers.formatCurrency(dailyData.totalIncome, config.precisionLevel),
      formattedTarget: helpers.formatCurrency(dailyTarget, config.precisionLevel),
      formattedRemaining: helpers.formatCurrency(remainingTarget, config.precisionLevel),
      formattedTime: helpers.formatTimeAsHHMM(dailyData.totalWorkedMinutes),
      formattedTimeHM: helpers.formatTime(dailyData.totalWorkedMinutes),
      formattedTargetTime: helpers.formatTime(dailyTargetMinutes),
    };
  }, [config, dailyData]);

  // 缓存统计卡片组件，避免不必要的渲染
  const statCards = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 今日收入卡片 */}
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{calculatedValues.formattedIncome}</div>
          <div className="stat-label">今日收入</div>
        </div>

        {/* 工作时间卡片 */}
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-value">{calculatedValues.formattedTime}</div>
          <div className="stat-label">工作时间</div>
        </div>

        {/* 工作状态卡片 */}
        <div className="stat-card">
          <div className="stat-icon">{isWorking ? '🟢' : '🔴'}</div>
          <div className="stat-value">{isWorking ? '工作中' : '休息中'}</div>
          <div className="stat-label">当前状态</div>
        </div>
      </div>
    ),
    [calculatedValues.formattedIncome, calculatedValues.formattedTime, isWorking]
  );

  // 缓存操作按钮组件
  const actionButtons = useMemo(
    () => (
      <Card title="快速操作" subtitle="快速控制工作状态" className="border-gradient">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={handleStartWork}
            disabled={isWorking}
            icon={<span>🚀</span>}
            className="h-14 text-base"
            fullWidth
          >
            开始工作
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={handleEndWork}
            disabled={!isWorking}
            icon={<span>🛑</span>}
            className="h-14 text-base"
            fullWidth
          >
            结束工作
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={handleResetToday}
            icon={<span>🔄</span>}
            className="h-14 text-base"
            fullWidth
          >
            重置今日
          </Button>
        </div>
      </Card>
    ),
    [isWorking, handleStartWork, handleEndWork, handleResetToday]
  );

  // 缓存详细统计组件
  const detailedStats = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 今日收入卡片 */}
        <div className="stat-card text-center">
          <div
            className="stat-icon mx-auto"
            style={{ background: 'linear-gradient(135deg, #10b981, #22c55e)' }}
          >
            <span className="emoji-icon">💰</span>
          </div>
          <div className="stat-value text-gradient">{calculatedValues.formattedIncome}</div>
          <div className="stat-label">今日收入</div>
          <div className="stat-meta">
            目标: {calculatedValues.formattedTarget} ({calculatedValues.progress.toFixed(1)}%)
          </div>
          <div className="progress-modern">
            <div className="progress-bar" style={{ width: `${calculatedValues.progress}%` }} />
          </div>
        </div>

        {/* 工作时长卡片 */}
        <div className="stat-card text-center">
          <div
            className="stat-icon mx-auto"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            <span className="emoji-icon">⏱️</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--vscode-charts-blue)' }}>
            {calculatedValues.formattedTimeHM}
          </div>
          <div className="stat-label">工作时长</div>
          <div className="stat-meta">
            目标: {calculatedValues.formattedTargetTime} ({calculatedValues.timeProgress.toFixed(1)}
            %)
          </div>
          <div className="progress-modern">
            <div className="progress-bar" style={{ width: `${calculatedValues.timeProgress}%` }} />
          </div>
        </div>

        {/* 工作状态卡片 */}
        <div className="stat-card text-center">
          <div
            className="stat-icon mx-auto"
            style={{
              background: isWorking
                ? 'linear-gradient(135deg, #10b981, #22c55e)'
                : 'linear-gradient(135deg, #6b7280, #9ca3af)',
            }}
          >
            <span className="emoji-icon">{isWorking ? '🟢' : '⭕'}</span>
          </div>
          <div
            className="stat-value"
            style={{
              color: isWorking
                ? 'var(--vscode-charts-green)'
                : 'var(--vscode-descriptionForeground)',
            }}
          >
            {isWorking ? '工作中' : '休息中'}
          </div>
          <div className="stat-label">当前状态</div>
          <div className="stat-meta">{isWorking ? '持续计算收入中' : '点击开始工作'}</div>
          {isWorking && (
            <div className="mt-4">
              <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
            </div>
          )}
        </div>
      </div>
    ),
    [calculatedValues, isWorking]
  );

  // 缓存目标面板组件
  const goalPanel = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="今日目标" subtitle="跟踪收入目标完成情况" hoverable className="card-gradient">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[var(--vscode-descriptionForeground)] font-medium">
                目标收入
              </span>
              <span className="font-bold text-[var(--vscode-foreground)]">
                {calculatedValues.formattedTarget}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--vscode-descriptionForeground)] font-medium">
                剩余目标
              </span>
              <span
                className={`font-bold ${
                  calculatedValues.remainingTarget > 0
                    ? 'text-[var(--vscode-charts-orange)]'
                    : 'text-[var(--vscode-charts-green)]'
                }`}
              >
                {calculatedValues.remainingTarget > 0
                  ? calculatedValues.formattedRemaining
                  : '已完成 ✅'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--vscode-descriptionForeground)] font-medium">完成度</span>
              <span
                className={`font-bold text-xl ${
                  calculatedValues.progress >= 100
                    ? 'text-[var(--vscode-charts-green)]'
                    : 'text-[var(--vscode-charts-orange)]'
                }`}
              >
                {calculatedValues.progress.toFixed(1)}%
              </span>
            </div>

            {calculatedValues.progress >= 100 && (
              <div className="mt-6 p-4 bg-[var(--vscode-textCodeBlock-background)] border border-[var(--vscode-widget-border)] rounded-lg animate-fadeInUp">
                <p className="text-[var(--vscode-foreground)] text-sm text-center font-medium">
                  🎉 恭喜！今日收入目标已达成！
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card title="工作统计" subtitle="查看今日工作时间分析" hoverable className="card-gradient">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[var(--vscode-descriptionForeground)] font-medium">
                工作时长
              </span>
              <span className="font-bold text-[var(--vscode-foreground)]">
                {calculatedValues.formattedTimeHM}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--vscode-descriptionForeground)] font-medium">
                标准工时
              </span>
              <span className="font-bold text-[var(--vscode-foreground)]">
                {calculatedValues.formattedTargetTime}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--vscode-descriptionForeground)] font-medium">完成度</span>
              <span
                className={`font-bold text-xl ${
                  calculatedValues.timeProgress >= 100
                    ? 'text-[var(--vscode-charts-green)]'
                    : 'text-[var(--vscode-charts-blue)]'
                }`}
              >
                {calculatedValues.timeProgress.toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    ),
    [calculatedValues]
  );

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* 核心统计卡片 */}
      {statCards}

      {/* 快速操作面板 */}
      {actionButtons}

      {/* 今日收入概览 */}
      {detailedStats}

      {/* 目标与统计面板 */}
      {goalPanel}

      {/* 工作会话历史 */}
      {dailyData.sessions.length > 0 && (
        <Card
          title="今日工作记录"
          subtitle={`共 ${dailyData.sessions.length} 个工作会话`}
          className="glass-effect"
        >
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {dailyData.sessions
              .slice(-5)
              .reverse()
              .map((session, index) => {
                // 计算工作时长（分钟）
                const sessionStart = new Date(session.startTime);
                const sessionEnd = session.endTime ? new Date(session.endTime) : new Date();
                const durationMinutes = Math.floor(
                  (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60)
                );

                const duration = helpers.formatTime(durationMinutes);
                const startTime = new Date(session.startTime).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const endTime = session.endTime
                  ? new Date(session.endTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '进行中';

                return (
                  <div key={index} className="session-card animate-slideInRight">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="session-number">{dailyData.sessions.length - index}</div>
                        <div>
                          <div className="font-medium text-[var(--vscode-foreground)]">
                            {startTime} - {endTime}
                          </div>
                          <div className="text-sm text-[var(--vscode-descriptionForeground)]">
                            工作时长: {duration}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--vscode-charts-blue)]">
                          {session.endTime ? '已结束' : '进行中'}
                        </div>
                        <div className="text-xs text-[var(--vscode-descriptionForeground)] opacity-70">
                          状态
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {dailyData.sessions.length > 5 && (
            <div className="mt-4 text-center">
              <span className="text-sm text-[var(--vscode-descriptionForeground)] opacity-70">
                显示最近 5 个会话，共 {dailyData.sessions.length} 个
              </span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
