import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  onClick,
  hoverable = false,
}) => {
  const cardClasses = `
        card-modern card-padding-md
        ${hoverable || onClick ? 'hoverable' : ''}
        ${className}
    `
    .trim()
    .replace(/\s+/g, ' ');

  const cardContent = (
    <>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-[var(--vscode-foreground)] mb-1">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--vscode-descriptionForeground)] opacity-80">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="text-[var(--vscode-foreground)]">{children}</div>
    </>
  );

  if (onClick) {
    return (
      <div className={cardClasses} onClick={onClick} role="button" tabIndex={0}>
        {cardContent}
      </div>
    );
  }

  return <div className={cardClasses}>{cardContent}</div>;
};
