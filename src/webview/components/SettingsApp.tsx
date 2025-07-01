import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './Dashboard';
import { BasicSettings } from './BasicSettings';
import { SyncSettings } from './SyncSettings';
import { Statistics } from './Statistics';
import { AppData } from '../types';

export const SettingsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    // 监听来自扩展的消息
    const messageHandler = (event: any) => {
      const message = event.data;
      switch (message.type) {
        case 'initialData':
          setData(message.data);
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    // 请求初始数据
    if (typeof vscode !== 'undefined') {
      vscode.postMessage({ type: 'getInitialData' });
    }

    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const sendMessage = (type: string, payload?: any) => {
    if (typeof vscode !== 'undefined') {
      const message = { type, ...payload };
      console.log('发送消息到扩展:', message);
      vscode.postMessage(message);
    } else {
      console.warn('vscode API不可用');
    }
  };

  const handleConfigChange = useCallback((changes: any) => {
    // 使用函数式更新避免依赖data
    setData(prevData => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        config: {
          ...prevData.config,
          ...changes,
        },
      };
    });
  }, []);

  const tabs = [
    { id: 'dashboard', name: '仪表盘', icon: '📊', description: '收入概览和实时状态' },
    { id: 'basic', name: '基础设置', icon: '⚙️', description: '配置收入计算参数' },
    { id: 'sync', name: '云同步', icon: '☁️', description: '数据备份和同步设置' },
    { id: 'statistics', name: '统计分析', icon: '📈', description: '工作效率分析报告' },
  ];

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse w-12 h-12 bg-[var(--vscode-button-background)] rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--vscode-descriptionForeground)]">正在加载...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--vscode-editor-background)] p-6">
      {/* 头部信息 */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl">
            💰
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--vscode-foreground)]">实时收入计算器</h1>
            <p className="text-[var(--vscode-descriptionForeground)] opacity-80">
              精确计算您的实时收入，提升工作效率与价值感知
            </p>
          </div>
        </div>

        {/* 状态指示器 */}
        <div className="flex items-center gap-4 p-3 bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded-lg border border-[var(--vscode-widget-border)]">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              data.isWorking
                ? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
                : 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                data.isWorking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            ></div>
            {data.isWorking ? '工作中' : '休息中'}
          </div>
          <span className="text-[var(--vscode-descriptionForeground)]">
            今日收入:{' '}
            <span className="font-semibold text-[var(--vscode-foreground)]">
              ¥{data.dailyData.totalIncome.toFixed(data.config.precisionLevel || 2)}
            </span>
          </span>
        </div>
      </div>

      {/* 现代化标签页 */}
      <div className="tabs-modern">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">{tab.icon}</span>
              <div className="text-center">
                <div className="font-medium">{tab.name}</div>
                <div className="text-xs opacity-70">{tab.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div className="animate-fadeInUp">
        {activeTab === 'dashboard' && <Dashboard data={data} onSendMessage={sendMessage} />}
        {activeTab === 'basic' && (
          <BasicSettings config={data.config} onSendMessage={sendMessage} />
        )}
        {activeTab === 'sync' && (
          <SyncSettings
            config={data.config}
            onSendMessage={sendMessage}
            onConfigChange={handleConfigChange}
          />
        )}
        {activeTab === 'statistics' && <Statistics dailyData={data.dailyData} />}
      </div>
    </div>
  );
};
