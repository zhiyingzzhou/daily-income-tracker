import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: string | React.ReactNode;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = 'md',
  className = '',
  icon,
}) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={`toggle-modern ${className}`}>
      <div className="flex items-start gap-4 py-2">
        <div
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          className={`toggle-track ${checked ? 'checked' : 'unchecked'} flex-shrink-0 mt-1`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <div className={`toggle-thumb ${checked ? 'checked' : ''}`} />
        </div>

        {(label || description || icon) && (
          <div className="flex-1 min-w-0">
            {label && (
              <label
                className={`
                                    block text-sm font-medium text-[var(--vscode-foreground)] mb-1
                                    ${disabled ? 'opacity-60' : 'cursor-pointer'}
                                `
                  .trim()
                  .replace(/\s+/g, ' ')}
                onClick={handleClick}
              >
                {icon && <span className="mr-2 inline-flex align-text-bottom">{icon}</span>}
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-[var(--vscode-descriptionForeground)] leading-relaxed opacity-80">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
