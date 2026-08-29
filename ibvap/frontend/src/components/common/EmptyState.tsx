import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Inbox className="w-12 h-12 text-slate-500 stroke-[1.5]" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-surface/50 border border-surface-border/60 rounded-xl">
      <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 mb-4">{icon}</div>
      <h4 className="text-base font-semibold text-slate-200 mb-1">{title}</h4>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
