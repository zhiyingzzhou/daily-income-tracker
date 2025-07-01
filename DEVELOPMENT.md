# 开发文档

本文档为开发者提供详细的开发指南和技术说明。

## 🛠️ 开发环境设置

### 系统要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- VSCode >= 1.74.0

### 开发工具

- TypeScript 5.1+
- React 18.2+
- TailwindCSS 3.3+
- Webpack 5.88+

## 📁 项目架构

### 目录结构详解

```
daily-income-tracker/
├── package.json              # 项目配置和依赖
├── tsconfig.json             # TypeScript配置
├── webpack.config.js         # Webpack构建配置
├── webpack.extension.config.js # 扩展专用Webpack配置
├── tailwind.config.js        # TailwindCSS配置
├── postcss.config.js         # PostCSS配置
├── .prettierrc               # Prettier配置
├── .eslintrc.json           # ESLint配置
├── .editorconfig            # 编辑器配置
├── .lintstagedrc            # Lint-staged配置
├── commitlint.config.js     # Commit规范配置
├── README.md                # 用户文档
├── DEVELOPMENT.md            # 开发文档
├── INSTALLATION.md          # 安装指南
├── scripts/                 # 脚本目录
│   ├── build.js             # 构建脚本
│   ├── dev.js               # 开发脚本(Node.js)
│   ├── dev.sh               # 开发脚本(Bash)
│   └── dev.ps1              # 开发脚本(PowerShell)
├── src/                      # 源代码目录
│   ├── extension.ts          # VSCode扩展主入口
│   ├── assets/               # 资源文件
│   │   ├── icon.png          # 扩展图标
│   │   └── icon.svg          # 矢量图标
│   ├── core/                 # 核心业务逻辑
│   │   ├── ConfigManager.ts  # 配置管理类
│   │   ├── constants.ts      # 常量定义
│   │   ├── IncomeCalculator.ts    # 收入计算核心类
│   │   ├── StatusBarManager.ts    # 状态栏管理类
│   │   ├── SyncManager.ts         # 云同步管理类
│   │   └── Utils.ts               # 工具函数类
│   ├── types/                # 类型定义
│   │   └── global.d.ts       # 全局类型声明
│   └── webview/              # 前端界面
│       ├── index.tsx         # React应用入口
│       ├── SettingsWebviewProvider.ts # Webview提供器
│       ├── types.ts          # Webview类型定义
│       ├── helpers.ts        # Webview辅助函数
│       ├── global.d.ts       # Webview全局定义
│       ├── components/       # React组件
│       │   ├── SettingsApp.tsx      # 主应用组件
│       │   ├── Dashboard.tsx        # 仪表盘组件
│       │   ├── BasicSettings.tsx    # 基础设置组件
│       │   ├── SyncSettings.tsx     # 同步设置组件
│       │   ├── Statistics.tsx       # 统计分析组件
│       │   └── ui/                  # UI基础组件
│       │       ├── Card.tsx         # 卡片组件
│       │       ├── Button.tsx       # 按钮组件
│       │       ├── Input.tsx        # 输入框组件
│       │       ├── Toggle.tsx       # 开关组件
│       │       └── FloatingSaveButton.tsx # 悬浮保存按钮
│       └── styles/           # 样式文件
│           └── index.css     # 主样式文件
└── dist/                     # 编译输出目录（自动生成）
    ├── extension.js          # 编译后的扩展文件
    └── webview/              # 编译后的前端文件
        └── bundle.js
```

## 🔧 核心模块说明

### 1. Extension.ts - 扩展主入口

负责扩展的生命周期管理：

```typescript
// 主要功能
-扩展激活和停用 - 组件初始化 - 命令注册 - 配置监听;
```

**关键方法：**

- `activate()`: 扩展激活时调用
- `deactivate()`: 扩展停用时调用

### 2. IncomeCalculator.ts - 实时收入计算器

核心业务逻辑，负责收入计算：

```typescript
// 主要功能
-工作会话管理 - 实时收入计算 - 数据持久化 - 配置更新响应;

// 关键数据结构
interface WorkSession {
  startTime: Date | string;
  endTime?: Date | string;
  date: string;
}

interface DailyData {
  date: string;
  sessions: WorkSession[];
  totalWorkedMinutes: number;
  totalIncome: number;
  isWorkday: boolean;
}
```

**计算逻辑：**

1. 基础收入 = 月收入 / 工作天数 / 标准工时 \* 实际工时
2. 加班收入 = 超时工时 _ 时薪 _ 加班倍率
3. 早退扣费 = 缺少工时 \* 时薪（可选）

**性能优化：**
- 使用增量计算避免重复计算
- 缓存最近的计算结果
- 自适应更新频率（根据用户活动调整）

### 3. StatusBarManager.ts - 状态栏管理

管理VSCode底部状态栏显示：

```typescript
// 显示格式: [图标] ¥[收入] ([工时])
// 示例: 💼 ¥123.45 (2:30)

// 状态图标
- 💼: 工作中
- ⏸️: 休息中

// 隐私模式 (dailyIncome.blurStatusBarIncome = true)
- 显示格式: [图标] 👁️ ([工时])  // 隐藏收入金额
```

**主要功能：**
- 实时显示收入和工作时长
- 支持不同更新频率（快速/正常/慢速/自适应）
- 隐私模式支持（隐藏状态栏中的收入金额）
- 悬停提示详细信息

### 4. ConfigManager.ts - 配置管理

负责扩展配置的读取和管理：

```typescript
// 主要功能
- 加载用户配置
- 监听配置变化
- 提供配置接口
- 配置验证和默认值
```

### 5. SyncManager.ts - 云同步管理

处理数据的云端同步：

```typescript
// 支持的服务商
- WebDAV: 通用WebDAV协议
- Amazon S3: AWS S3存储
- 阿里云OSS: 阿里云对象存储
- Local: 本地存储（无云同步）

// 安全措施
- 敏感信息加密存储
- 定期自动同步
- 连接测试功能
- 同步冷却和重试机制
```

### 6. Utils.ts - 工具函数类

提供各种辅助函数：

```typescript
// 主要功能
- 时间格式化
- 货币格式化
- 工作日计算
- 标准工时计算
- 日期处理工具
```

## 🎨 前端架构

### React组件设计

采用函数式组件 + Hooks设计模式：

```typescript
// 组件层次结构
SettingsApp (根组件)
├── Dashboard (仪表盘)
├── BasicSettings (基础设置)
├── SyncSettings (同步设置)
├── Statistics (统计分析)
└── UI Components (基础UI组件)
    ├── Card
    ├── Button
    ├── Input
    ├── Toggle
    └── FloatingSaveButton
```

### 状态管理

使用React内置状态管理：

- `useState`: 组件内状态
- `useEffect`: 副作用处理
- `useContext`: 跨组件状态共享
- 父子组件通过props传递数据

### 样式系统

使用TailwindCSS + VSCode主题适配：

```css
/* VSCode主题变量 */
--vscode-editor-background
--vscode-editor-foreground
--vscode-button-background
--vscode-input-background
/* ... */

/* 自定义类 */
.vscode-input    /* 适配VSCode输入框样式 */
.vscode-button   /* 适配VSCode按钮样式 */
.vscode-card     /* 适配VSCode卡片样式 */
```

## 🔌 VSCode API 使用

### 扩展配置

在`package.json`中定义配置项：

```json
{
  "contributes": {
    "configuration": {
      "title": "实时收入计算器",
      "properties": {
        "dailyIncome.monthlyIncome": {
          "type": "number",
          "default": 10000,
          "description": "月收入（元）"
        },
        "dailyIncome.workDays": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "default": [1, 2, 3, 4, 5],
          "description": "工作日 (0=周日, 1=周一...)"
        },
        "dailyIncome.updateFrequency": {
          "type": "string",
          "enum": ["auto", "fast", "normal", "slow", "custom"],
          "default": "auto",
          "description": "更新频率"
        }
        // ...其他配置项
      }
    }
  }
}
```

### 命令注册

```typescript
vscode.commands.registerCommand('dailyIncome.openSettings', () => {
  settingsProvider.showSettings();
});

vscode.commands.registerCommand('dailyIncome.startWork', () => {
  incomeCalculator.startWork();
});

vscode.commands.registerCommand('dailyIncome.endWork', () => {
  incomeCalculator.endWork();
});

vscode.commands.registerCommand('dailyIncome.reset', () => {
  incomeCalculator.resetToday();
});
```

### Webview通信

```typescript
// 发送消息到Webview
webview.postMessage({
  type: 'initialData',
  data: { config, dailyData },
});

// 接收来自Webview的消息
webview.onDidReceiveMessage(message => {
  switch (message.type) {
    case 'updateConfig':
      // 处理配置更新
      break;
    case 'startWork':
      incomeCalculator.startWork();
      break;
    case 'endWork':
      incomeCalculator.endWork();
      break;
    case 'resetToday':
      incomeCalculator.resetToday();
      break;
    case 'testSync':
      syncManager.testConnection();
      break;
  }
});
```

## 🏗️ 构建流程

### 开发模式

可以使用一键启动脚本快速开始开发：

```bash
# Node.js 一键启动开发
npm run dev

# Linux/macOS Bash 脚本
npm run dev:sh

# Windows PowerShell 脚本
npm run dev:win
```

或手动启动各个开发进程：

```bash
# 1. 启动TypeScript编译监听
npm run watch

# 2. 启动Webpack前端构建监听（新终端）
npm run dev-webview

# 3. 在VSCode中按F5启动调试
```

### 生产构建

```bash
# 一键构建所有文件
npm run build

# 或分步构建
npm run compile             # 编译TypeScript
npm run build-webview       # 构建React前端

# 打包扩展
npm run package-extension   # 使用webpack打包扩展

# 生成VSIX安装包
npm run package             # 生成.vsix文件

# 输出文件
dist/extension.js           # 后端代码
dist/webview/bundle.js      # 前端代码
```

## 🧪 测试与调试

### 调试扩展

1. 在VSCode中打开项目
2. 按`F5`启动扩展开发主机
3. 在新窗口中测试扩展功能

### 调试Webview

1. 在Webview中右键选择"检查元素"
2. 使用Chrome DevTools调试前端代码
3. 查看控制台日志和网络请求

### 常见问题排查

#### 扩展无法激活

- 检查`package.json`中的`activationEvents`
- 查看VSCode开发者控制台错误信息
- 确认TypeScript编译无错误

#### Webview无法显示

- 检查`webpack.config.js`配置
- 确认前端代码编译成功
- 查看CSP (Content Security Policy) 设置

#### 状态栏不显示

- 检查`StatusBarManager`初始化
- 确认状态栏项目已调用`show()`方法
- 查看扩展是否正确激活

#### 同步功能失败

- 检查网络连接
- 验证云服务凭证是否正确
- 检查服务器路径和权限
- 查看控制台日志中的错误信息

## 📊 性能优化

### 计算优化

- 收入计算采用增量更新
- 缓存最近的计算结果，避免不必要的重复计算
- 自适应更新频率：
  - 用户活跃时: 1秒更新一次
  - 用户空闲时: 5秒更新一次
- 使用配置项控制更新频率

### 内存管理

- 及时清理定时器
- 避免内存泄漏
- 使用合适的数据结构
- 释放不再使用的事件监听器

### 用户体验

- 异步操作使用Loading状态
- 错误处理和用户反馈
- 响应式设计适配不同屏幕
- 隐私模式保护收入信息

## 🔐 安全考虑

### 数据安全

- 敏感信息使用VSCode Secrets API存储
- 云同步数据加密传输
- 不在日志中输出敏感信息
- 访问令牌在传输过程中加密保护

### 输入验证

- 用户输入参数验证
- 防止XSS攻击
- API调用错误处理
- 限制云服务请求频率

## 📦 发布流程

### 打包扩展

```bash
# 安装vsce工具
npm install -g vsce

# 运行完整构建
npm run build

# 打包扩展
npm run package

# 生成的.vsix文件位于dist目录
```

### 发布到市场

```bash
# 登录
vsce login <publisher>

# 发布
vsce publish
```

### 版本管理

遵循语义化版本规范：

- `major.minor.patch`
- 重大更新：major + 1
- 新功能：minor + 1
- 错误修复：patch + 1

## 🤝 贡献指南

### 代码规范

- 使用TypeScript严格模式
- 遵循ESLint规则
- 使用Prettier格式化代码
- 保持一致的代码风格

### 提交规范

```
feat: 新功能
fix: 错误修复
docs: 文档更新
style: 格式调整
refactor: 代码重构
test: 测试相关
chore: 构建配置
```

### Git工作流

- 使用Husky进行Git钩子管理
- commit-lint确保提交消息规范
- lint-staged在提交前运行代码检查
- 自动格式化代码

### Pull Request流程

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request
5. 代码审查
6. 合并到主分支

---

如有开发相关问题，请查看项目Issues或联系维护者。
