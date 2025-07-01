import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Toggle } from './ui/Toggle';
import { FloatingSaveButton } from './ui/FloatingSaveButton';
import { ConfigData } from '../types';
import * as helpers from '../helpers';

interface SyncSettingsProps {
  config: ConfigData;
  onSendMessage: (type: string, payload?: any) => void;
  onConfigChange?: (changes: Partial<ConfigData>) => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({
  config,
  onSendMessage,
  onConfigChange,
}) => {
  // 从配置初始化状态
  const [syncEnabled, setSyncEnabled] = useState(config.autoSync || false);
  const [provider, setProvider] = useState(config.syncProvider || 'local');
  const [syncConfig, setSyncConfig] = useState(() => ({
    endpoint: config.syncConfig?.endpoint || '',
    username: config.syncConfig?.username || '',
    password: config.syncConfig?.password || '',
    accessKey: config.syncConfig?.accessKey || '',
    secretKey: config.syncConfig?.secretKey || '',
    bucket: config.syncConfig?.bucket || '',
  }));

  // 保存状态管理
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedState, setLastSavedState] = useState({
    syncEnabled,
    provider,
    syncConfig: { ...syncConfig },
  });

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 检查是否有未保存的更改，使用深度比较
  const hasChanges = React.useMemo(() => {
    // 仅比较实际需要发送到后端的值
    const currentState = {
      syncEnabled,
      provider,
      syncConfig: {
        endpoint: syncConfig.endpoint || '',
        username: syncConfig.username || '',
        password: syncConfig.password || '',
        accessKey: syncConfig.accessKey || '',
        secretKey: syncConfig.secretKey || '',
        bucket: syncConfig.bucket || '',
      },
    };

    const savedState = {
      syncEnabled: lastSavedState.syncEnabled,
      provider: lastSavedState.provider,
      syncConfig: {
        endpoint: lastSavedState.syncConfig.endpoint || '',
        username: lastSavedState.syncConfig.username || '',
        password: lastSavedState.syncConfig.password || '',
        accessKey: lastSavedState.syncConfig.accessKey || '',
        secretKey: lastSavedState.syncConfig.secretKey || '',
        bucket: lastSavedState.syncConfig.bucket || '',
      },
    };

    const result = !helpers.isEqual(currentState, savedState);

    // 添加调试日志
    if (result) {
      console.log('同步设置存在未保存的变更:');

      // 检查顶层字段
      if (currentState.syncEnabled !== savedState.syncEnabled) {
        console.log('同步开关变更:', savedState.syncEnabled, ' -> ', currentState.syncEnabled);
      }

      if (currentState.provider !== savedState.provider) {
        console.log('存储提供商变更:', savedState.provider, ' -> ', currentState.provider);
      }

      // 检查同步配置字段
      const configFields = ['endpoint', 'username', 'password', 'accessKey', 'secretKey', 'bucket'];
      configFields.forEach(field => {
        const key = field as keyof typeof currentState.syncConfig;
        if (currentState.syncConfig[key] !== savedState.syncConfig[key]) {
          // 对于密码字段，不显示实际值，只显示是否变更
          if (field === 'password' || field === 'secretKey') {
            console.log(`同步配置字段 ${field} 已变更`);
          } else {
            console.log(
              `同步配置字段 ${field} 变更:`,
              savedState.syncConfig[key],
              ' -> ',
              currentState.syncConfig[key]
            );
          }
        }
      });
    } else {
      console.log('同步设置无变更');
    }

    return result;
  }, [syncEnabled, provider, syncConfig, lastSavedState]);

  const providers = [
    {
      id: 'local',
      name: '本地存储',
      icon: '💾',
      description: '数据仅存储在本地',
    },
    {
      id: 'webdav',
      name: 'WebDAV',
      icon: '☁️',
      description: '通过WebDAV协议同步到云端',
    },
    {
      id: 's3',
      name: 'Amazon S3',
      icon: '🪣',
      description: 'AWS S3对象存储（开发中）',
    },
    {
      id: 'aliyun-oss',
      name: '阿里云OSS',
      icon: '☁️',
      description: '阿里云对象存储（开发中）',
    },
  ];

  const handleToggleSync = (enabled: boolean) => {
    setSyncEnabled(enabled);
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
  };

  const handleSyncConfigChange = (key: string, value: string) => {
    const newSyncConfig = { ...syncConfig, [key]: value };
    setSyncConfig(newSyncConfig);
  };

  // 保存所有设置到扩展
  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);

    try {
      // 更新同步开关设置
      if (onConfigChange) {
        onConfigChange({
          autoSync: syncEnabled,
          syncProvider: provider,
        });
      }

      // 发送同步配置保存消息到扩展
      onSendMessage('saveSyncConfig', {
        provider: provider,
        config: syncConfig,
      });

      // 延迟显示保存成功反馈
      await new Promise(resolve => setTimeout(resolve, 500));

      // 更新最后保存的状态
      setLastSavedState({
        syncEnabled,
        provider,
        syncConfig: { ...syncConfig },
      });

      // 显示成功状态
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('保存云同步配置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // 构建当前表单的临时配置
      const tempConfig = {
        provider: provider as any,
        endpoint: syncConfig.endpoint,
        username: syncConfig.username,
        password: syncConfig.password,
        accessKey: syncConfig.accessKey,
        secretKey: syncConfig.secretKey,
        bucket: syncConfig.bucket,
      };
      onSendMessage('testConnection', { tempConfig });
    } finally {
      setTimeout(() => setTesting(false), 2000);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      onSendMessage('manualSync');
    } finally {
      setTimeout(() => setSyncing(false), 3000);
    }
  };

  const renderProviderConfig = () => {
    switch (provider) {
      case 'webdav':
        return (
          <div className="space-y-6">
            <Input
              label="WebDAV服务器地址"
              type="text"
              value={syncConfig.endpoint}
              onChange={e => handleSyncConfigChange('endpoint', e.target.value)}
              placeholder="https://your-webdav-server.com"
              icon={<span>🌐</span>}
            />
            <Input
              label="用户名"
              type="text"
              value={syncConfig.username}
              onChange={e => handleSyncConfigChange('username', e.target.value)}
              placeholder="用户名"
              icon={<span>👤</span>}
            />
            <Input
              label="密码"
              type="password"
              value={syncConfig.password}
              onChange={e => handleSyncConfigChange('password', e.target.value)}
              placeholder="密码"
              icon={<span>🔒</span>}
            />
          </div>
        );
      case 's3':
        return (
          <div className="space-y-6">
            <Input
              label="S3端点"
              type="text"
              value={syncConfig.endpoint}
              onChange={e => handleSyncConfigChange('endpoint', e.target.value)}
              placeholder="s3.amazonaws.com"
              icon={<span>🌐</span>}
            />
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Access Key"
                type="text"
                value={syncConfig.accessKey}
                onChange={e => handleSyncConfigChange('accessKey', e.target.value)}
                placeholder="Access Key"
                icon={<span>🔑</span>}
              />
              <Input
                label="Secret Key"
                type="password"
                value={syncConfig.secretKey}
                onChange={e => handleSyncConfigChange('secretKey', e.target.value)}
                placeholder="Secret Key"
                icon={<span>🔐</span>}
              />
            </div>
            <Input
              label="存储桶名称"
              type="text"
              value={syncConfig.bucket}
              onChange={e => handleSyncConfigChange('bucket', e.target.value)}
              placeholder="bucket-name"
              icon={<span>🪣</span>}
            />
          </div>
        );
      case 'aliyun-oss':
        return (
          <div className="space-y-6">
            <Input
              label="OSS端点"
              type="text"
              value={syncConfig.endpoint}
              onChange={e => handleSyncConfigChange('endpoint', e.target.value)}
              placeholder="oss-cn-hangzhou.aliyuncs.com"
              icon={<span>🌐</span>}
            />
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="AccessKey ID"
                type="text"
                value={syncConfig.accessKey}
                onChange={e => handleSyncConfigChange('accessKey', e.target.value)}
                placeholder="AccessKey ID"
                icon={<span>🔑</span>}
              />
              <Input
                label="AccessKey Secret"
                type="password"
                value={syncConfig.secretKey}
                onChange={e => handleSyncConfigChange('secretKey', e.target.value)}
                placeholder="AccessKey Secret"
                icon={<span>🔐</span>}
              />
            </div>
            <Input
              label="存储桶名称"
              type="text"
              value={syncConfig.bucket}
              onChange={e => handleSyncConfigChange('bucket', e.target.value)}
              placeholder="bucket-name"
              icon={<span>🪣</span>}
            />
          </div>
        );
      default:
        return (
          <div className="text-center py-8">
            <div className="mb-4 text-4xl">💾</div>
            <p className="text-[var(--vscode-descriptionForeground)]">本地存储无需额外配置</p>
            <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-2 opacity-70">
              数据将安全地存储在VSCode的工作区中
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* 同步开关 */}
      <Card title="云同步设置" subtitle="启用云同步以在多设备间同步配置">
        <Toggle
          checked={syncEnabled}
          onChange={handleToggleSync}
          label="启用云同步"
          description="配置变更时自动同步到云端，确保多设备配置一致"
          size="md"
        />

        {syncEnabled && (
          <div className="mt-4 p-3 bg-[var(--vscode-editor-inactiveSelectionBackground)] border border-[var(--vscode-widget-border)] rounded-md">
            <div className="flex items-center gap-2 text-sm text-[var(--vscode-descriptionForeground)]">
              <span>ℹ️</span>
              <span>仅同步配置数据，不包含工作记录。配置变更时自动同步。</span>
            </div>
          </div>
        )}
      </Card>

      {/* 存储提供商选择 */}
      <Card title="存储提供商" subtitle="选择配置同步的存储方式">
        <div className="grid md:grid-cols-2 gap-3">
          {providers.map(p => (
            <div
              key={p.id}
              className={`
                                p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                                ${
                                  provider === p.id
                                    ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-editor-selectionBackground)]'
                                    : 'border-[var(--vscode-widget-border)] hover:border-[var(--vscode-focusBorder)]'
                                }
                            `
                .trim()
                .replace(/\s+/g, ' ')}
              onClick={() => handleProviderChange(p.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--vscode-foreground)]">{p.name}</h4>
                  <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">
                    {p.description}
                  </p>
                </div>
                {provider === p.id && <span className="text-[var(--vscode-focusBorder)]">✓</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 配置表单 */}
      <Card
        title={`${providers.find(p => p.id === provider)?.name || '存储'} 配置`}
        subtitle="配置云存储连接参数"
      >
        {renderProviderConfig()}

        {provider !== 'local' && (
          <div className="mt-6 flex gap-3">
            <Button
              variant="ghost"
              onClick={handleTestConnection}
              loading={testing}
              icon={testing ? undefined : <span>🔍</span>}
            >
              {testing ? '测试中...' : '测试连接'}
            </Button>
          </div>
        )}
      </Card>

      {/* 手动同步 */}
      {syncEnabled && provider !== 'local' && (
        <Card title="手动同步" subtitle="立即同步配置到云端">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--vscode-descriptionForeground)]">
                手动触发一次配置同步，确保云端数据为最新
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleManualSync}
              loading={syncing}
              icon={syncing ? undefined : <span>☁️</span>}
            >
              {syncing ? '同步中...' : '立即同步'}
            </Button>
          </div>
        </Card>
      )}

      {/* 浮动保存按钮 */}
      <FloatingSaveButton
        hasChanges={hasChanges}
        onSave={handleSave}
        isSaving={isSaving}
        isSaved={isSaved}
      />
    </div>
  );
};
