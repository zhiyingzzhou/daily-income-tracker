import React, { useState, useEffect } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  containerClassName?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  suffix,
  containerClassName = '',
  helperText,
  className = '',
  type,
  value,
  onChange,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState(value?.toString() || '');
  const [rangeError, setRangeError] = useState('');
  const isNumberInput = type === 'number';

  // 同步外部value到displayValue
  useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value.toString());
      setRangeError(''); // 外部值变化时清除范围错误
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (isNumberInput) {
      // 对于数字输入，只允许数字、小数点、负号和空字符串
      if (inputValue === '' || /^-?\d*\.?\d*$/.test(inputValue)) {
        // 检查数字范围 (-200000000000000000000 到 100000000000000000000)
        if (inputValue !== '' && inputValue !== '-') {
          const numValue = parseFloat(inputValue);
          if (!isNaN(numValue)) {
            const MIN_VALUE = -200000000000000000000;
            const MAX_VALUE = 100000000000000000000;

            if (numValue < MIN_VALUE || numValue > MAX_VALUE) {
              // 如果超出范围，显示错误信息但不阻止输入
              setRangeError(
                `数字范围应在 ${MIN_VALUE.toLocaleString()} 到 ${MAX_VALUE.toLocaleString()} 之间`
              );
              setTimeout(() => setRangeError(''), 3000); // 3秒后清除错误信息
              return;
            } else {
              setRangeError(''); // 清除错误信息
            }
          }
        }

        setDisplayValue(inputValue);

        // 创建新的事件对象，但保持原始字符串值
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: inputValue,
          },
        };

        if (onChange) {
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }
      }
    } else {
      setDisplayValue(inputValue);
      if (onChange) {
        onChange(e);
      }
    }
  };

  const inputClasses = `
        input-modern
        ${icon ? 'has-icon' : ''}
        ${className}
    `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-[var(--vscode-foreground)]">
          {label}
          {props.required && <span className="text-[var(--vscode-errorForeground)] ml-1">*</span>}
        </label>
      )}

      <div className="input-container">
        {icon && <div className="input-icon">{icon}</div>}

        <input
          {...props}
          type={isNumberInput ? 'text' : type}
          value={displayValue}
          onChange={handleChange}
          className={inputClasses}
          inputMode={isNumberInput ? 'decimal' : undefined}
          pattern={isNumberInput ? '[0-9]*' : undefined}
        />

        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <span className="text-[var(--vscode-descriptionForeground)] text-sm">{suffix}</span>
          </div>
        )}
      </div>

      {(error || rangeError || helperText) && (
        <div className="text-xs mt-2">
          {error || rangeError ? (
            <span className="text-[var(--vscode-errorForeground)]">{error || rangeError}</span>
          ) : (
            <span className="text-[var(--vscode-descriptionForeground)] opacity-70">
              {helperText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
