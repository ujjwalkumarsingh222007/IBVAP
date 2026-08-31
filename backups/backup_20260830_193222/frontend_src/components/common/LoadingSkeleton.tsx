import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-surface-border rounded-xl p-5 animate-pulse"
        >
          <div className="flex justify-between items-center mb-3">
            <div className="h-4 bg-slate-800 rounded w-24"></div>
            <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
          </div>
          <div className="h-8 bg-slate-800 rounded w-16 mb-2"></div>
          <div className="h-3 bg-slate-800/60 rounded w-32"></div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => {
  return (
    <div className="bg-surface border border-surface-border rounded-xl overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-900 border-b border-surface-border px-6 flex items-center">
        <div className="h-4 bg-slate-800 rounded w-full"></div>
      </div>
      <div className="divide-y divide-surface-border/50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-6 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-800/80 rounded"
                style={{ width: `${100 / cols}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 animate-pulse h-80 flex flex-col justify-between">
      <div className="h-5 bg-slate-800 rounded w-48 mb-4"></div>
      <div className="flex-1 bg-slate-900/60 rounded-lg flex items-end p-4 gap-4">
        <div className="w-1/6 bg-slate-800 rounded-t h-1/3"></div>
        <div className="w-1/6 bg-slate-800 rounded-t h-2/3"></div>
        <div className="w-1/6 bg-slate-800 rounded-t h-1/2"></div>
        <div className="w-1/6 bg-slate-800 rounded-t h-5/6"></div>
        <div className="w-1/6 bg-slate-800 rounded-t h-3/4"></div>
        <div className="w-1/6 bg-slate-800 rounded-t h-1/4"></div>
      </div>
    </div>
  );
};
