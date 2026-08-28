import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  description = 'No matching surveillance events or camera logs were returned.',
  action,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center bg-[#0d121d]/50 rounded-xl border border-dashed border-slate-800">
      <div className="p-3 bg-slate-900 text-slate-400 rounded-full mb-3 border border-slate-800">
        {icon || <Database size={24} />}
      </div>
      <h4 className="text-slate-200 font-medium text-sm mb-1">{title}</h4>
      <p className="text-slate-400 text-xs max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
};
