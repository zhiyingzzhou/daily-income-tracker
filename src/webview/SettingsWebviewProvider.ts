import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IncomeCalculator } from '../core/IncomeCalculator';
import { SyncManager } from '../core/SyncManager';
import { ConfigManager } from '../core/ConfigManager';

export class SettingsWebviewProvider {
  private _panel?: vscode.WebviewPanel;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _calculator: IncomeCalculator,
    private readonly _syncManager: SyncManager,
    private readonly _configManager: ConfigManager
  ) {}

  public showSettings() {
    if (this._panel) {
      this._panel.reveal();
    } else {
      this._panel = vscode.window.createWebviewPanel(
        'dailyIncomeSettings',
        '实时收入计算器设置',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [this._context.extensionUri],
          retainContextWhenHidden: true,
        }
      );

      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

      // 面板关闭时清理
      this._panel.onDidDispose(() => {
        this._panel = undefined;
      });

      // 处理来自webview的消息
      this._panel.webview.onDidReceiveMessage(async (message: any) => {
        console.log('WebView消息:', message);

        switch (message.type) {
          case 'updateConfig':
            await this._updateConfiguration(message.config);
            break;
          case 'saveSyncConfig':
            await this._syncManager.saveSyncConfig(message.provider, message.config);
            await this._sendInitialData();
            break;
          case 'testConnection':
            await this._testConnection(message.tempConfig);
            break;
          case 'manualSync':
            await this._manualSync();
            break;
          case 'getInitialData':
            await this._sendInitialData();
            break;
          case 'startWork':
            this._calculator.startWork();
            await this._sendInitialData();
            break;
          case 'endWork':
            this._calculator.endWork();
            await this._sendInitialData();
            break;
          case 'resetToday':
            this._calculator.resetToday();
            await this._sendInitialData();
            break;
        }
      });

      // 发送初始数据
      this._sendInitialData().catch(console.error);
    }
  }

  private async _sendInitialData() {
    if (!this._panel) {
      return;
    }

    // 使用ConfigManager获取配置
    const config = this._configManager.getConfig();

    // 获取最新的每日数据
    const dailyData = this._calculator.getDailyData();

    // 获取保存在secrets中的同步配置
    const syncConfig = await this._getSyncConfigForDisplay();

    try {
      this._panel.webview.postMessage({
        type: 'initialData',
        data: {
          config: {
            ...config,
            syncConfig: syncConfig,
          },
          dailyData,
          isWorking: this._calculator.isWorking(),
        },
      });
    } catch (error) {
      console.error('发送数据到WebView失败:', error);
    }
  }

  private async _getSyncConfigForDisplay() {
    try {
      const config = this._configManager.getConfig();
      const provider = config.syncProvider;
      const secrets = this._context.secrets;

      if (provider === 'local') {
        return {};
      }

      // 从VSCode配置获取非敏感信息
      const nonSensitiveConfig = config.syncConfig || {};

      // 从secrets获取敏感信息
      let sensitiveConfig = {};
      switch (provider) {
        case 'webdav':
          sensitiveConfig = {
            password: (await secrets.get('webdav.password')) || '',
          };
          break;
        case 's3':
          sensitiveConfig = {
            accessKey: (await secrets.get('s3.accessKey')) || '',
            secretKey: (await secrets.get('s3.secretKey')) || '',
          };
          break;
        case 'aliyun-oss':
          sensitiveConfig = {
            accessKey: (await secrets.get('aliyun.accessKey')) || '',
            secretKey: (await secrets.get('aliyun.secretKey')) || '',
          };
          break;
      }

      // 合并配置
      return {
        ...nonSensitiveConfig,
        ...sensitiveConfig,
      };
    } catch (error) {
      console.error('获取同步配置失败:', error);
      return {};
    }
  }

  private async _updateConfiguration(config: any) {
    try {
      console.log('从WebView收到配置更新:', config);

      // 使用ConfigManager更新配置
      const success = await this._configManager.updateConfig(config);

      if (success) {
        // 强制刷新配置管理器的缓存
        this._configManager.refreshConfig();

        // 确保计算器和状态栏管理器应用新配置
        this._calculator.updateConfiguration();

        vscode.window.showInformationMessage('配置已保存！');
      } else {
        vscode.window.showErrorMessage('配置保存失败');
      }

      await this._sendInitialData();
    } catch (error) {
      console.error('配置保存失败:', error);
      vscode.window.showErrorMessage('配置保存失败: ' + error);
    }
  }

  private async _testConnection(tempConfig?: any) {
    const success = await this._syncManager.testConnection(tempConfig);
    if (success) {
      vscode.window.showInformationMessage('连接测试成功！');
    } else {
      vscode.window.showErrorMessage('连接测试失败');
    }
  }

  private async _manualSync() {
    await this._syncManager.manualSync();
  }
  
  /**
   * 辅助方法：清理文件路径，移除可能的'auto/'子目录
   */
  private _cleanPath(filePath: string): string {
    // 移除可能存在的auto/目录
    return filePath.replace(/auto\//, '');
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // 加载资源清单
    let mainScript = 'main.js';
    let vendorScript = '';
    let mainStyles = '';

    try {
      const manifestPath = path.join(this._context.extensionPath, 'dist', 'webview', 'asset-manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        // 清理路径
        mainScript = this._cleanPath(manifest['main.js'] || mainScript);
        vendorScript = manifest['vendor.js'] ? this._cleanPath(manifest['vendor.js']) : '';
        mainStyles = manifest['main.css'] ? this._cleanPath(manifest['main.css']) : '';
        
        console.log('资源路径:', {
          mainScript,
          vendorScript,
          mainStyles
        });
      }
    } catch (error) {
      console.error('加载资源清单失败:', error);
    }

    // 检查文件是否存在
    const checkPath = (filePath: string): boolean => {
      const fullPath = path.join(this._context.extensionPath, 'dist', 'webview', filePath);
      const exists = fs.existsSync(fullPath);
      if (!exists) {
        console.error(`资源文件不存在: ${fullPath}`);
      }
      return exists;
    };

    // 确保脚本文件存在
    if (!checkPath(mainScript)) {
      // 尝试查找可用的脚本文件
      try {
        const webviewDir = path.join(this._context.extensionPath, 'dist', 'webview');
        if (fs.existsSync(webviewDir)) {
          const files = fs.readdirSync(webviewDir);
          const jsFiles = files.filter(file => file.startsWith('main.') && file.endsWith('.js'));
          if (jsFiles.length > 0) {
            mainScript = jsFiles[0];
            console.log(`找到备用主脚本: ${mainScript}`);
          }
        }
      } catch (error) {
        console.error('查找备用脚本失败:', error);
      }
    }

    // 获取资源URI
    const mainScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', mainScript)
    );

    // 生成一个唯一的nonce，确保所有脚本使用同一个nonce
    const nonce = this._getNonce();

    let vendorScriptTag = '';
    if (vendorScript && checkPath(vendorScript)) {
      const vendorScriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', vendorScript)
      );
      vendorScriptTag = `<script nonce="${nonce}" src="${vendorScriptUri}"></script>`;
    }

    let stylesTag = '';
    if (mainStyles && checkPath(mainStyles)) {
      const stylesUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', mainStyles)
      );
      stylesTag = `<link href="${stylesUri}" rel="stylesheet">`;
    }

    return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; img-src ${webview.cspSource} data:;">
            <title>实时收入计算器设置</title>
            ${stylesTag}
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                }
                #root {
                    max-width: 1200px;
                    margin: 0 auto;
                }
            </style>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}">
                // 注入VSCode API
                const vscode = acquireVsCodeApi();
                console.log('VSCode API已加载:', typeof vscode);
            </script>
            ${vendorScriptTag}
            <script nonce="${nonce}" src="${mainScriptUri}"></script>
        </body>
        </html>`;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
