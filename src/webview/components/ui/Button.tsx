import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  const buttonClasses = `
        btn-modern btn-${size} btn-${variant}
        ${fullWidth ? 'w-full' : ''}
        ${className}
    `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <button className={buttonClasses} disabled={disabled || loading} {...props}>
      {loading && (
        <div className="animate-pulse">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="32"
              strokeDashoffset="32"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      {children && <span className={icon || loading ? 'ml-1' : ''}>{children}</span>}
    </button>
  );
};
