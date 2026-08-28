import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  action,
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#121824] border border-[#1f293d] rounded-xl p-5 shadow-lg shadow-black/20 hover:border-slate-700/60 transition-all duration-200 ${className}`}
    >
      {(title || icon || action) && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            {icon && <div className="text-cyan-400 p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">{icon}</div>}
            <div>
              {title && <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
