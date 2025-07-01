import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { FloatingSaveButton } from './ui/FloatingSaveButton';
import { ConfigData } from '../types';
import * as helpers from '../helpers';

interface BasicSettingsProps {
  config: ConfigData;
  onSendMessage: (type: string, payload?: any) => void;
}

// 本地存储键
const BASIC_DRAFT_KEY = 'basic-settings-draft';

// 从本地存储加载草稿
const loadBasicDraft = (config: ConfigData): ConfigData => {
  try {
    const draft = localStorage.getItem(BASIC_DRAFT_KEY);
    if (draft) {
      const parsed = JSON.parse(draft);
      // 确保workDays是数组
      if (parsed.workDays && !Array.isArray(parsed.workDays)) {
        parsed.workDays = [1, 2, 3, 4, 5]; // 默认周一到周五
      }

      // 确保布尔值的正确类型
      const parseBoolean = (value: any, defaultValue: boolean): boolean => {
        if (value === true) return true;
        if (value === false) return false;
        return defaultValue;
      };

      // 过滤掉旧的字段，只使用有效配置
      return {
        monthlyIncome: parsed.monthlyIncome ?? config.monthlyIncome,
        workDays: parsed.workDays ?? config.workDays ?? [1, 2, 3, 4, 5],
        autoStartWork: parseBoolean(parsed.autoStartWork, config.autoStartWork ?? false),
        useScheduledWorkTime: parseBoolean(
          parsed.useScheduledWorkTime,
          config.useScheduledWorkTime ?? false
        ),
        workStartTime: parsed.workStartTime ?? config.workStartTime,
        workEndTime: parsed.workEndTime ?? config.workEndTime,
        precisionLevel: parsed.precisionLevel ?? config.precisionLevel,
        overtimeEnabled: parseBoolean(parsed.overtimeEnabled, config.overtimeEnabled ?? false),
        overtimeRate: parsed.overtimeRate ?? config.overtimeRate,
        deductForEarlyLeave: parseBoolean(
          parsed.deductForEarlyLeave,
          config.deductForEarlyLeave ?? false
        ),
        autoSync: parseBoolean(parsed.autoSync, config.autoSync ?? false),
        syncProvider: parsed.syncProvider ?? config.syncProvider,
        syncConfig: parsed.syncConfig ?? config.syncConfig,
        updateFrequency: parsed.updateFrequency ?? config.updateFrequency ?? 'auto',
        blurStatusBarIncome: parseBoolean(
          parsed.blurStatusBarIncome,
          config.blurStatusBarIncome ?? false
        ),
      };
    }
  } catch (error) {
    console.warn('加载设置草稿失败:', error);
  }
  return config;
};

// 保存草稿到本地存储
const saveBasicDraft = (data: ConfigData) => {
  try {
    const jsonData = JSON.stringify(data);
    localStorage.setItem(BASIC_DRAFT_KEY, jsonData);
  } catch (error) {
    console.warn('保存设置草稿失败:', error);
  }
};

// 清除草稿
const clearBasicDraft = () => {
  try {
    localStorage.removeItem(BASIC_DRAFT_KEY);
  } catch (error) {
    console.warn('清除设置草稿失败:', error);
  }
};

export const BasicSettings: React.FC<BasicSettingsProps> = ({ config, onSendMessage }) => {
  // 初始化表单数据：优先使用草稿，然后是传入的配置
  const [formData, setFormData] = useState(() => loadBasicDraft(config));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 记录最后成功保存的配置，用于变更检测
  const [lastSavedConfig, setLastSavedConfig] = useState(config);

  // 实时保存草稿到本地存储（防数据丢失），使用防抖避免频繁保存
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveBasicDraft(formData);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData]);

  // 检测是否有未保存的变更，使用深度比较而非JSON.stringify
  const hasChanges = React.useMemo(() => {
    const relevantFormData = {
      monthlyIncome: formData.monthlyIncome,
      workDays: formData.workDays || [1, 2, 3, 4, 5],
      autoStartWork: formData.autoStartWork || false,
      useScheduledWorkTime: formData.useScheduledWorkTime || false,
      workStartTime: formData.workStartTime,
      workEndTime: formData.workEndTime,
      precisionLevel: formData.precisionLevel,
      overtimeEnabled: formData.overtimeEnabled || false,
      overtimeRate: formData.overtimeRate,
      deductForEarlyLeave: formData.deductForEarlyLeave || false,
      updateFrequency: formData.updateFrequency || 'auto',
      blurStatusBarIncome: formData.blurStatusBarIncome === true,
    };

    const relevantLastSaved = {
      monthlyIncome: lastSavedConfig.monthlyIncome,
      workDays: lastSavedConfig.workDays || [1, 2, 3, 4, 5],
      autoStartWork: lastSavedConfig.autoStartWork || false,
      useScheduledWorkTime: lastSavedConfig.useScheduledWorkTime || false,
      workStartTime: lastSavedConfig.workStartTime,
      workEndTime: lastSavedConfig.workEndTime,
      precisionLevel: lastSavedConfig.precisionLevel,
      overtimeEnabled: lastSavedConfig.overtimeEnabled || false,
      overtimeRate: lastSavedConfig.overtimeRate,
      deductForEarlyLeave: lastSavedConfig.deductForEarlyLeave || false,
      updateFrequency: lastSavedConfig.updateFrequency || 'auto',
      blurStatusBarIncome: lastSavedConfig.blurStatusBarIncome === true,
    };

    const result = !helpers.isEqual(relevantFormData, relevantLastSaved);

    // 添加调试日志
    if (result) {
      console.log('基本设置存在未保存的变更:');
      // 找出哪些字段有变化
      const changedFields = Object.keys(relevantFormData).filter(
        key =>
          !helpers.isEqual(
            relevantFormData[key as keyof typeof relevantFormData],
            relevantLastSaved[key as keyof typeof relevantLastSaved]
          )
      );
      console.log('变更的字段:', changedFields);
      changedFields.forEach(field => {
        console.log(
          `字段 ${field} 变更:`,
          relevantLastSaved[field as keyof typeof relevantLastSaved],
          ' -> ',
          relevantFormData[field as keyof typeof relevantFormData]
        );
      });
    } else {
      console.log('基本设置无变更');
    }

    return result;
  }, [formData, lastSavedConfig]);

  // 处理表单字段变更
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    console.log(`字段${field}更新为:`, value); // 添加日志以便调试
  };

  // 处理保存操作
  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    console.log('准备保存配置:', formData);

    try {
      // 确保只发送有效的配置字段，过滤掉旧的字段
      const validConfig = {
        monthlyIncome: formData.monthlyIncome,
        workDays: formData.workDays || [1, 2, 3, 4, 5],
        autoStartWork: formData.autoStartWork || false,
        useScheduledWorkTime: formData.useScheduledWorkTime || false,
        workStartTime: formData.workStartTime,
        workEndTime: formData.workEndTime,
        precisionLevel: formData.precisionLevel,
        overtimeEnabled: formData.overtimeEnabled,
        overtimeRate: formData.overtimeRate,
        deductForEarlyLeave: formData.deductForEarlyLeave,
        updateFrequency: formData.updateFrequency || 'auto',
        // 确保隐私模式设置值正确，必须是布尔值
        blurStatusBarIncome: formData.blurStatusBarIncome === true,
      };

      console.log('发送有效配置:', validConfig);

      // 发送配置更新消息到扩展后端
      onSendMessage('updateConfig', { config: validConfig });

      // 用于显示UI反馈的延迟
      await new Promise(resolve => setTimeout(resolve, 300));

      // 保存成功：更新基准配置 + 清除草稿
      setLastSavedConfig({ ...formData });
      clearBasicDraft(); // 成功保存后清除草稿

      // 成功反馈
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('保存配置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 计算统计数据
  const stats = React.useMemo(() => {
    // 使用辅助函数计算工作天数
    const workDaysPerMonth = helpers.calculateWorkDaysPerMonth(
      formData.workDays || [1, 2, 3, 4, 5]
    );

    // 计算每日收入
    const dailyIncome = formData.monthlyIncome / workDaysPerMonth;

    // 计算标准工作分钟数
    const workMinutes = helpers.getStandardWorkMinutes(
      formData.workStartTime || '09:00',
      formData.workEndTime || '18:00'
    );

    // 计算小时收入
    const hourlyIncome = workMinutes > 0 ? dailyIncome / (workMinutes / 60) : 0;

    return {
      dailyIncome: helpers.formatCurrency(dailyIncome, formData.precisionLevel || 2),
      hourlyIncome: helpers.formatCurrency(hourlyIncome, formData.precisionLevel || 2),
      workHours: (workMinutes / 60).toFixed(1),
      minuteIncome: helpers.formatCurrency(hourlyIncome / 60, formData.precisionLevel || 2),
    };
  }, [
    formData.monthlyIncome,
    formData.workDays,
    formData.workStartTime,
    formData.workEndTime,
    formData.precisionLevel,
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 收入设置 */}
      <Card
        title="收入设置"
        subtitle="设置你的月收入和工作天数"
        className="transition-all duration-150"
      >
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Input
              label="月收入 (元)"
              type="number"
              value={formData.monthlyIncome.toString()}
              onChange={e =>
                handleInputChange('monthlyIncome', helpers.safeParseNumber(e.target.value, 0))
              }
              placeholder="请输入月收入"
              icon={<span>💰</span>}
              helperText="税前月收入金额"
            />
            {/* 工作日选择器 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--vscode-foreground)]">
                <span className="flex items-center gap-2">
                  <span>📅</span>
                  工作日设置
                </span>
              </label>
              <div className="grid grid-cols-7 gap-2">
                {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => {
                  const isSelected = formData.workDays?.includes(index) ?? false;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const currentWorkDays = formData.workDays || [1, 2, 3, 4, 5];
                        const newWorkDays = isSelected
                          ? currentWorkDays.filter(d => d !== index)
                          : [...currentWorkDays, index].sort();
                        handleInputChange('workDays', newWorkDays);
                      }}
                      className={`h-10 w-full text-sm font-medium rounded border transition-all duration-150 ${
                        isSelected
                          ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-[var(--vscode-button-background)]'
                          : 'bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] border-[var(--vscode-widget-border)] hover:border-[var(--vscode-button-background)]'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                选择您的工作日 (已选择 {formData.workDays?.length || 0} 天)
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Input
              label="工作开始时间"
              type="time"
              value={formData.workStartTime}
              onChange={e => handleInputChange('workStartTime', e.target.value)}
              icon={<span>🕘</span>}
              helperText="标准工作日开始时间"
            />
            <Input
              label="工作结束时间"
              type="time"
              value={formData.workEndTime}
              onChange={e => handleInputChange('workEndTime', e.target.value)}
              icon={<span>🕔</span>}
              helperText="标准工作日结束时间"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card
              title="收入预览"
              className="bg-[var(--vscode-editor-inactiveSelectionBackground)]"
            >
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>每日收入:</span>
                  <span className="font-bold">{stats.dailyIncome}</span>
                </div>
                <div className="flex justify-between">
                  <span>每小时收入:</span>
                  <span className="font-bold">{stats.hourlyIncome}</span>
                </div>
                <div className="flex justify-between">
                  <span>每分钟收入:</span>
                  <span className="font-bold">{stats.minuteIncome}</span>
                </div>
                <div className="flex justify-between">
                  <span>标准工作时长:</span>
                  <span className="font-bold">{stats.workHours}小时</span>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Toggle
                label="自动开始工作"
                checked={formData.autoStartWork || false}
                onChange={checked => handleInputChange('autoStartWork', checked)}
                description="在工作日工作开始时间自动开始计时"
                icon="⚙️"
              />
              <Toggle
                label="使用预定工作时间"
                checked={formData.useScheduledWorkTime || false}
                onChange={checked => handleInputChange('useScheduledWorkTime', checked)}
                description="使用预定开始时间而非实际开始时间"
                icon="🕒"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 高级设置 */}
      <Card
        title="高级设置"
        subtitle="调整加班计算和显示精度"
        className="transition-all duration-150"
      >
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Toggle
                label="启用加班工资"
                checked={formData.overtimeEnabled || false}
                onChange={checked => handleInputChange('overtimeEnabled', checked)}
                description="超过规定工作时间后计算加班工资"
                icon="💪"
              />
              {formData.overtimeEnabled && (
                <Input
                  label="加班工资倍率"
                  type="number"
                  value={formData.overtimeRate?.toString() || '1.5'}
                  onChange={e =>
                    handleInputChange(
                      'overtimeRate',
                      Math.max(1.0, helpers.safeParseNumber(e.target.value, 1.5))
                    )
                  }
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  icon={<span>📈</span>}
                  helperText="加班费 = 正常工资 × 倍率"
                />
              )}
              <Toggle
                label="早退扣钱"
                checked={formData.deductForEarlyLeave || false}
                onChange={checked => handleInputChange('deductForEarlyLeave', checked)}
                description="工作时间不足标准工时时按比例扣减"
                icon="⚖️"
              />
              <Toggle
                label="隐私模式"
                checked={formData.blurStatusBarIncome === true}
                onChange={checked => {
                  console.log(`隐私模式状态切换为: ${checked}`);
                  handleInputChange('blurStatusBarIncome', checked);
                }}
                description="在状态栏中隐藏收入金额，保护隐私"
                icon="👁️"
              />
            </div>
            <div>
              <Input
                label="显示精度"
                type="number"
                value={formData.precisionLevel?.toString() || '2'}
                onChange={e =>
                  handleInputChange(
                    'precisionLevel',
                    helpers.safeParseNumber(e.target.value, 2, true)
                  )
                }
                min="0"
                max="10"
                step="1"
                icon={<span>🔍</span>}
                helperText="收入金额显示的小数位数 (0-10)"
              />
              <div className="mt-4 p-3 bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded">
                <p className="text-sm">
                  <span className="font-bold">精度示例: </span>
                  {helpers.formatCurrency(12345.6789, formData.precisionLevel || 2)}
                </p>
              </div>
            </div>
          </div>

          {/* 更新频率设置 */}
          <div className="space-y-4 border-t border-[var(--vscode-widget-border)] pt-4 mt-2">
            <h3 className="text-md font-medium text-[var(--vscode-foreground)]">
              收入计算更新频率
            </h3>
            <div className="grid gap-3">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="freq-auto"
                  name="frequency"
                  className="mr-2"
                  checked={formData.updateFrequency === 'auto'}
                  onChange={() => handleInputChange('updateFrequency', 'auto')}
                />
                <label
                  htmlFor="freq-auto"
                  className="text-[var(--vscode-foreground)] cursor-pointer"
                >
                  <span className="font-medium">自适应模式</span>
                  <span className="text-sm block text-[var(--vscode-descriptionForeground)] mt-0.5">
                    根据您的活动自动调整更新频率：活跃使用时每秒更新，空闲时每5秒更新
                  </span>
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="radio"
                  id="freq-fast"
                  name="frequency"
                  className="mr-2"
                  checked={formData.updateFrequency === 'fast'}
                  onChange={() => handleInputChange('updateFrequency', 'fast')}
                />
                <label
                  htmlFor="freq-fast"
                  className="text-[var(--vscode-foreground)] cursor-pointer"
                >
                  <span className="font-medium">高频更新</span>
                  <span className="text-sm block text-[var(--vscode-descriptionForeground)] mt-0.5">
                    固定每秒更新一次收入，获得最实时的数据（可能略微增加CPU使用）
                  </span>
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="radio"
                  id="freq-normal"
                  name="frequency"
                  className="mr-2"
                  checked={formData.updateFrequency === 'normal'}
                  onChange={() => handleInputChange('updateFrequency', 'normal')}
                />
                <label
                  htmlFor="freq-normal"
                  className="text-[var(--vscode-foreground)] cursor-pointer"
                >
                  <span className="font-medium">标准更新</span>
                  <span className="text-sm block text-[var(--vscode-descriptionForeground)] mt-0.5">
                    每3秒更新一次，平衡性能与实时性
                  </span>
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="radio"
                  id="freq-slow"
                  name="frequency"
                  className="mr-2"
                  checked={formData.updateFrequency === 'slow'}
                  onChange={() => handleInputChange('updateFrequency', 'slow')}
                />
                <label
                  htmlFor="freq-slow"
                  className="text-[var(--vscode-foreground)] cursor-pointer"
                >
                  <span className="font-medium">低频更新</span>
                  <span className="text-sm block text-[var(--vscode-descriptionForeground)] mt-0.5">
                    每5秒更新一次，最大程度降低资源占用
                  </span>
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="radio"
                  id="freq-custom"
                  name="frequency"
                  className="mr-2"
                  checked={typeof formData.updateFrequency === 'number'}
                  onChange={() => {
                    // 如果之前不是数字，设置一个默认值
                    if (typeof formData.updateFrequency !== 'number') {
                      handleInputChange('updateFrequency', 2000);
                    }
                  }}
                />
                <label
                  htmlFor="freq-custom"
                  className="text-[var(--vscode-foreground)] cursor-pointer flex-1"
                >
                  <span className="font-medium">自定义更新频率</span>
                  <div className="mt-1 flex items-center">
                    <Input
                      type="number"
                      value={
                        typeof formData.updateFrequency === 'number'
                          ? formData.updateFrequency.toString()
                          : '2000'
                      }
                      onChange={e =>
                        handleInputChange(
                          'updateFrequency',
                          helpers.safeParseNumber(e.target.value, 1000)
                        )
                      }
                      disabled={typeof formData.updateFrequency !== 'number'}
                      min="100"
                      max="10000"
                      step="100"
                      className="w-32 inline-block mr-2"
                    />
                    <span className="text-sm text-[var(--vscode-descriptionForeground)]">
                      毫秒 (100-10000ms)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 保存按钮 */}
      <FloatingSaveButton
        hasChanges={hasChanges}
        onSave={handleSave}
        isSaving={isSaving}
        isSaved={saved}
      />
    </div>
  );
};
