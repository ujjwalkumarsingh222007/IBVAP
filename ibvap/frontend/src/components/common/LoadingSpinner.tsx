import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading surveillance data...',
  size = 28,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-3">
      <Loader2 className="animate-spin text-cyan-400" size={size} />
      <span className="text-xs font-mono tracking-wider">{label}</span>
    </div>
  );
};
