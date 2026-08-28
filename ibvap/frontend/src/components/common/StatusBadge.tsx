import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'emerald' | 'amber' | 'red' | 'cyan' | 'blue' | 'slate';
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'slate',
  pulse = false,
  size = 'md',
}) => {
  const variantStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 dot-bg-emerald-500',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30 dot-bg-amber-500',
    red: 'bg-red-500/10 text-red-400 border-red-500/30 dot-bg-red-500',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 dot-bg-cyan-500',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30 dot-bg-blue-500',
    slate: 'bg-slate-800 text-slate-300 border-slate-700 dot-bg-slate-400',
  };

  const dotColors = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    cyan: 'bg-cyan-400',
    blue: 'bg-blue-400',
    slate: 'bg-slate-400',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs font-mono',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`} />
      </span>
      <span>{label}</span>
    </span>
  );
};
