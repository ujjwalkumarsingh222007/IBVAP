import React from 'react';
import { getStatusTheme } from '../../utils/formatters';

interface BadgeProps {
  status?: string | null;
  children?: React.ReactNode;
  variant?: 'status' | 'default' | 'outline' | 'severity';
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  children,
  variant = 'status',
  severity,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px] tracking-wider' : 'px-2.5 py-1 text-xs';

  if (severity) {
    let colors = 'bg-slate-800 text-slate-300 border-slate-700';
    if (severity === 'CRITICAL') {
      colors = 'bg-red-500/15 border-red-500/40 text-red-400 font-semibold';
    } else if (severity === 'HIGH') {
      colors = 'bg-orange-500/15 border-orange-500/40 text-orange-400 font-semibold';
    } else if (severity === 'MEDIUM') {
      colors = 'bg-amber-500/15 border-amber-500/40 text-amber-400';
    } else {
      colors = 'bg-blue-500/15 border-blue-500/40 text-blue-400';
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border font-mono uppercase ${sizeClasses} ${colors} ${className}`}
      >
        {children || severity}
      </span>
    );
  }

  if (variant === 'status') {
    const theme = getStatusTheme(status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border font-mono font-medium uppercase ${sizeClasses} ${theme.badgeBg} ${className}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status === 'KNOWN'
              ? 'bg-emerald-400'
              : status === 'FLAGGED' || status === 'CRITICAL'
              ? 'bg-red-400 animate-pulse'
              : 'bg-amber-400'
          }`}
        />
        {children || theme.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 text-slate-300 ${sizeClasses} ${className}`}
    >
      {children}
    </span>
  );
};
