import React from 'react';

interface StatusDotProps {
  status?: 'online' | 'offline' | 'warning' | 'active' | boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status = 'online',
  label,
  size = 'md',
  className = '',
}) => {
  const isOnline = status === 'online' || status === 'active' || status === true;
  const isWarning = status === 'warning';

  const dotSize = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  const colorClasses = isOnline
    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
    : isWarning
    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
    : 'bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`relative flex ${dotSize}`}>
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${colorClasses}`}></span>
      </span>
      {label && <span className="text-xs font-medium text-slate-300">{label}</span>}
    </div>
  );
};
