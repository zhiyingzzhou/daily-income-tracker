import React from 'react';
import { Card } from './ui/Card';
import { DailyData } from '../types';

interface StatisticsProps {
  dailyData: DailyData;
}

export const Statistics: React.FC<StatisticsProps> = ({ dailyData }) => {
  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* 今日统计概览 */}
      <Card title="今日统计概览" subtitle="工作数据的详细分析">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">¥{dailyData.totalIncome.toFixed(2)}</div>
            <div className="stat-label">总收入</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⏰</div>
            <div className="stat-value">{(dailyData.totalWorkedMinutes / 60).toFixed(1)}h</div>
            <div className="stat-label">工作时长</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{dailyData.sessions.length}</div>
            <div className="stat-label">工作会话</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-value">
              {dailyData.totalWorkedMinutes > 0
                ? `¥${(dailyData.totalIncome / (dailyData.totalWorkedMinutes / 60)).toFixed(2)}`
                : '¥0.00'}
            </div>
            <div className="stat-label">平均时薪</div>
          </div>
        </div>
      </Card>

      {/* 工作会话详情 */}
      <Card title="工作会话详情" subtitle="今日各个工作时段的详细记录">
        {dailyData.sessions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-[var(--vscode-descriptionForeground)]">今日还没有工作记录</p>
            <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-2 opacity-70">
              开始工作后，这里将显示详细的工作时段信息
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyData.sessions.map((session, index) => {
              const startTime = new Date(session.startTime);
              const endTime = session.endTime ? new Date(session.endTime) : null;
              const duration = endTime
                ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
                : 0;

              return (
                <div key={index} className="session-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="session-number">{index + 1}</div>
                      <div>
                        <div className="font-medium text-[var(--vscode-foreground)]">
                          会话 {index + 1}
                        </div>
                        <div className="text-sm text-[var(--vscode-descriptionForeground)]">
                          {startTime.toLocaleTimeString()} -{' '}
                          {endTime ? endTime.toLocaleTimeString() : '进行中'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-[var(--vscode-foreground)]">
                        {endTime
                          ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
                          : '进行中'}
                      </div>
                      <div className="text-sm text-[var(--vscode-descriptionForeground)]">
                        {endTime ? '已完成' : '工作中'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
