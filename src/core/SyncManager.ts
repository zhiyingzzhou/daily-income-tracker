import * as vscode from 'vscode';
import axios from 'axios';
import { ConfigManager, SyncConfig } from './ConfigManager';

// 同步间隔常量
const SYNC_COOLDOWN = 5000; // 5秒冷却时间
const SYNC_RETRY_INTERVAL = 60000; // 同步失败后1分钟重试

export class SyncManager implements vscode.Disposable {
  private context: vscode.ExtensionContext;
  private configManager: ConfigManager;
  private lastSyncTime: number = 0;
  private configChangeListener?: vscode.Disposable;
  private syncInProgress: boolean = false;
  private syncRetryTimer?: NodeJS.Timeout;
  private syncQueue: (() => Promise<void | boolean>)[] = [];
  private processingQueue: boolean = false;

  constructor(context: vscode.ExtensionContext, configManager: ConfigManager) {
    this.context = context;
    this.configManager = configManager;
  }

  start() {
    // 监听配置变更
    this.configChangeListener = this.configManager.onConfigChange(async () => {
      await this.queueSync();
    });

    // 启动时同步一次（如果启用了云同步）
    this.initialSync();
  }

  stop() {
    if (this.configChangeListener) {
      this.configChangeListener.dispose();
      this.configChangeListener = undefined;
    }

    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
      this.syncRetryTimer = undefined;
    }
  }

  /**
   * 将同步请求加入队列
   */
  private queueSync(): Promise<void> {
    // 如果距离上次同步时间少于冷却时间，加入队列等待
    const now = Date.now();
    if (now - this.lastSyncTime < SYNC_COOLDOWN) {
      // 使用Promise包装同步请求，并加入队列
      return new Promise<void>(resolve => {
        // 不返回syncData的结果，使类型一致
        const task = async () => {
          try {
            await this.syncData();
          } catch (error) {
            console.error(error);
          }
          resolve();
        };

        this.syncQueue.push(task);

        // 如果队列未在处理，开始处理
        if (!this.processingQueue) {
          this.processQueue();
        }
      });
    }

    // 直接同步，忽略返回值以保持类型一致
    this.lastSyncTime = now;
    const syncPromise = this.syncData().catch(console.error);
    // 包装成void返回类型
    return Promise.resolve(syncPromise).then(() => {});
  }

  /**
   * 处理同步队列
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.syncQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.syncQueue.length > 0) {
        // 等待冷却时间
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        if (timeSinceLastSync < SYNC_COOLDOWN) {
          await new Promise(resolve => setTimeout(resolve, SYNC_COOLDOWN - timeSinceLastSync));
        }

        // 取出并执行队列中的第一个任务
        const syncTask = this.syncQueue.shift();
        if (syncTask) {
          this.lastSyncTime = Date.now();
          await syncTask(); // 执行任务，不需要返回值
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private async initialSync() {
    const config = this.configManager.getConfig();
    const autoSync = config.autoSync;

    if (autoSync) {
      // 延迟1秒后进行初始同步，避免启动时阻塞
      setTimeout(() => {
        this.syncData().catch(err => {
          console.error('初始同步失败:', err);
          this.scheduleSyncRetry();
        });
      }, 1000);
    }
  }

  /**
   * 安排同步重试
   */
  private scheduleSyncRetry() {
    // 清除已有的重试定时器
    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
    }

    // 设置新的重试定时器
    this.syncRetryTimer = setTimeout(() => {
      console.log('尝试重新同步...');
      this.syncData().catch(err => {
        console.error('同步重试失败:', err);
        // 继续安排重试
        this.scheduleSyncRetry();
      });
    }, SYNC_RETRY_INTERVAL);
  }

  async syncData(): Promise<boolean> {
    if (this.syncInProgress) {
      console.log('已有同步任务在进行中，跳过此次同步');
      return false;
    }

    this.syncInProgress = true;

    try {
      const config = this.configManager.getConfig();
      const provider = config.syncProvider;
      const autoSync = config.autoSync;

      if (!autoSync || provider === 'local') {
        return true; // 未启用云同步或使用本地存储
      }

      const syncConfig = await this.getSyncConfig();
      if (!syncConfig) {
        console.warn('同步配置不完整，跳过同步');
        return false;
      }

      // 只同步配置数据，不同步工作记录
      const configData = this.getConfigData();

      let success = false;
      switch (provider) {
        case 'webdav':
          success = await this.syncToWebDAV(syncConfig, configData);
          break;
        case 's3':
          success = await this.syncToS3(syncConfig, configData);
          break;
        case 'aliyun-oss':
          success = await this.syncToAliyunOSS(syncConfig, configData);
          break;
        default:
          console.warn(`未知的同步提供商: ${provider}`);
          return false;
      }

      if (success) {
        // 同步成功，清除重试定时器
        if (this.syncRetryTimer) {
          clearTimeout(this.syncRetryTimer);
          this.syncRetryTimer = undefined;
        }
      } else {
        // 同步失败，安排重试
        this.scheduleSyncRetry();
      }

      return success;
    } catch (error) {
      console.error('同步失败:', error);
      // 同步异常，安排重试
      this.scheduleSyncRetry();
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  async manualSync(): Promise<boolean> {
    if (this.syncInProgress) {
      vscode.window.showWarningMessage('已有同步任务在进行中，请稍后再试');
      return false;
    }

    this.syncInProgress = true;

    try {
      const config = this.configManager.getConfig();
      const provider = config.syncProvider;

      if (provider === 'local') {
        vscode.window.showInformationMessage('当前使用本地存储，无需同步');
        return true;
      }

      vscode.window.showInformationMessage('开始同步配置...', { modal: false });

      const syncConfig = await this.getSyncConfig();
      if (!syncConfig) {
        vscode.window.showErrorMessage('同步配置不完整，请检查云同步设置');
        return false;
      }

      const configData = this.getConfigData();
      let success = false;

      switch (provider) {
        case 'webdav':
          success = await this.syncToWebDAV(syncConfig, configData);
          break;
        case 's3':
          success = await this.syncToS3(syncConfig, configData);
          break;
        case 'aliyun-oss':
          success = await this.syncToAliyunOSS(syncConfig, configData);
          break;
        default:
          vscode.window.showErrorMessage(`未知的同步提供商: ${provider}`);
          return false;
      }

      if (success) {
        vscode.window.showInformationMessage('✅ 配置同步成功');

        // 同步成功，清除重试定时器
        if (this.syncRetryTimer) {
          clearTimeout(this.syncRetryTimer);
          this.syncRetryTimer = undefined;
        }
      } else {
        vscode.window.showErrorMessage('❌ 配置同步失败');
      }

      return success;
    } catch (error) {
      console.error('手动同步失败:', error);
      vscode.window.showErrorMessage(
        `同步失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async getSyncConfig(): Promise<SyncConfig | null> {
    const secrets = this.context.secrets;

    try {
      const config = this.configManager.getConfig();
      const provider = config.syncProvider as SyncConfig['provider'];

      if (provider === 'local') {
        return null;
      }

      // 从VSCode配置获取非敏感信息
      const nonSensitiveConfig = config.syncConfig || {};

      const syncConfig: SyncConfig = { provider };

      switch (provider) {
        case 'webdav':
          // 合并非敏感和敏感配置
          syncConfig.endpoint = nonSensitiveConfig.endpoint || '';
          syncConfig.username = nonSensitiveConfig.username || '';
          syncConfig.password = (await secrets.get('webdav.password')) || '';

          if (!syncConfig.endpoint || !syncConfig.username || !syncConfig.password) {
            return null;
          }
          break;

        case 's3':
          syncConfig.endpoint = nonSensitiveConfig.endpoint || '';
          syncConfig.bucket = nonSensitiveConfig.bucket || '';
          syncConfig.accessKey = (await secrets.get('s3.accessKey')) || '';
          syncConfig.secretKey = (await secrets.get('s3.secretKey')) || '';

          if (
            !syncConfig.endpoint ||
            !syncConfig.accessKey ||
            !syncConfig.secretKey ||
            !syncConfig.bucket
          ) {
            return null;
          }
          break;

        case 'aliyun-oss':
          syncConfig.endpoint = nonSensitiveConfig.endpoint || '';
          syncConfig.bucket = nonSensitiveConfig.bucket || '';
          syncConfig.accessKey = (await secrets.get('aliyun.accessKey')) || '';
          syncConfig.secretKey = (await secrets.get('aliyun.secretKey')) || '';

          if (
            !syncConfig.endpoint ||
            !syncConfig.accessKey ||
            !syncConfig.secretKey ||
            !syncConfig.bucket
          ) {
            return null;
          }
          break;
      }

      return syncConfig;
    } catch (error) {
      console.error('获取同步配置失败:', error);
      return null;
    }
  }

  private getConfigData(): any {
    // 只获取业务配置数据，不包含工作记录和敏感的同步配置
    const config = this.configManager.getConfig();

    return {
      monthlyIncome: config.monthlyIncome,
      workDays: config.workDays,
      autoStartWork: config.autoStartWork,
      useScheduledWorkTime: config.useScheduledWorkTime,
      precisionLevel: config.precisionLevel,
      workStartTime: config.workStartTime,
      workEndTime: config.workEndTime,
      overtimeEnabled: config.overtimeEnabled,
      overtimeRate: config.overtimeRate,
      deductForEarlyLeave: config.deductForEarlyLeave,
      lastUpdated: new Date().toISOString(),
    };
  }

  private async syncToWebDAV(config: SyncConfig, data: any): Promise<boolean> {
    if (!config.endpoint || !config.username || !config.password) {
      throw new Error('WebDAV配置不完整');
    }

    try {
      // 构建终结点URL
      const url = new URL('/daily-income-config.json', config.endpoint).toString();

      // 创建认证头
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

      // PUT请求发送配置数据
      const response = await axios.put(url, JSON.stringify(data), {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
        timeout: 10000, // 10秒超时
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('WebDAV同步失败:', error);
      return false;
    }
  }

  private async syncToS3(config: SyncConfig, data: any): Promise<boolean> {
    // S3同步的具体实现
    console.log('S3同步功能尚未实现');
    return false;
  }

  private async syncToAliyunOSS(config: SyncConfig, data: any): Promise<boolean> {
    // 阿里云OSS同步的具体实现
    console.log('阿里云OSS同步功能尚未实现');
    return false;
  }

  async saveSyncConfig(provider: string, config: any): Promise<boolean> {
    try {
      // 保存非敏感信息到VSCode配置
      const nonSensitiveConfig: any = {};

      switch (provider) {
        case 'webdav':
          nonSensitiveConfig.endpoint = config.endpoint || '';
          nonSensitiveConfig.username = config.username || '';

          // 保存密码到密钥存储
          if (config.password) {
            await this.context.secrets.store('webdav.password', config.password);
          }
          break;

        case 's3':
          nonSensitiveConfig.endpoint = config.endpoint || '';
          nonSensitiveConfig.bucket = config.bucket || '';

          // 保存密钥到密钥存储
          if (config.accessKey) {
            await this.context.secrets.store('s3.accessKey', config.accessKey);
          }
          if (config.secretKey) {
            await this.context.secrets.store('s3.secretKey', config.secretKey);
          }
          break;

        case 'aliyun-oss':
          nonSensitiveConfig.endpoint = config.endpoint || '';
          nonSensitiveConfig.bucket = config.bucket || '';

          // 保存密钥到密钥存储
          if (config.accessKey) {
            await this.context.secrets.store('aliyun.accessKey', config.accessKey);
          }
          if (config.secretKey) {
            await this.context.secrets.store('aliyun.secretKey', config.secretKey);
          }
          break;

        case 'local':
          // 本地存储不需要保存额外配置
          break;

        default:
          throw new Error(`未知的同步提供商: ${provider}`);
      }

      // 更新配置
      await this.configManager.updateConfig({
        syncProvider: provider,
        syncConfig: nonSensitiveConfig,
        autoSync: config.autoSync,
      });

      return true;
    } catch (error) {
      console.error('保存同步配置失败:', error);
      return false;
    }
  }

  async testConnection(tempConfig?: SyncConfig): Promise<boolean> {
    try {
      // 使用临时配置或获取当前配置
      const config = tempConfig || (await this.getSyncConfig());

      if (!config) {
        return false;
      }

      switch (config.provider) {
        case 'webdav':
          return await this.testWebDAVConnection(config);
        case 's3':
          // TODO: 实现S3连接测试
          console.log('S3连接测试尚未实现');
          return false;
        case 'aliyun-oss':
          // TODO: 实现阿里云OSS连接测试
          console.log('阿里云OSS连接测试尚未实现');
          return false;
        case 'local':
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      return false;
    }
  }

  private async testWebDAVConnection(config: SyncConfig): Promise<boolean> {
    if (!config.endpoint || !config.username || !config.password) {
      throw new Error('WebDAV配置不完整');
    }

    try {
      // 创建认证头
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

      // 发送OPTIONS请求测试连接
      const response = await axios.options(config.endpoint, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: 10000, // 10秒超时
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('WebDAV连接测试失败:', error);
      return false;
    }
  }

  dispose() {
    this.stop();

    // 清除队列
    this.syncQueue = [];
    this.processingQueue = false;
    this.syncInProgress = false;
  }
}
