import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  action,
  children,
  className = '',
  highlight = false,
}) => {
  return (
    <div
      className={`bg-surface border rounded-xl shadow-lg transition-all duration-200 ${
        highlight
          ? 'border-blue-500/40 shadow-blue-500/5'
          : 'border-surface-border hover:border-slate-600/60'
      } ${className}`}
    >
      {(title || icon || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border/60">
          <div className="flex items-center gap-3">
            {icon && <div className="text-slate-400">{icon}</div>}
            <div>
              {title && <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
