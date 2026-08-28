import React from 'react';

interface SkeletonLoaderProps {
  type?: 'card' | 'table-row' | 'video' | 'metric';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'card',
  count = 3,
}) => {
  const items = Array.from({ length: count });

  if (type === 'metric') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((_, i) => (
          <div key={i} className="bg-[#121824] border border-[#1f293d] rounded-xl p-5 animate-pulse space-y-3">
            <div className="h-4 bg-slate-800 rounded w-2/3" />
            <div className="h-8 bg-slate-800 rounded w-1/2" />
            <div className="h-3 bg-slate-800/60 rounded w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((_, i) => (
          <div key={i} className="bg-[#0d121d] border border-slate-800 rounded-xl overflow-hidden animate-pulse">
            <div className="aspect-video bg-slate-900" />
            <div className="p-3 space-y-2 bg-[#121824]">
              <div className="h-4 bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-800/60 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table-row') {
    return (
      <div className="space-y-3 p-4">
        {items.map((_, i) => (
          <div key={i} className="h-10 bg-slate-900/80 border border-slate-800/60 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {items.map((_, i) => (
        <div key={i} className="bg-[#121824] border border-[#1f293d] rounded-xl p-5 animate-pulse space-y-4">
          <div className="h-5 bg-slate-800 rounded w-1/2" />
          <div className="h-24 bg-slate-900 rounded-lg" />
          <div className="h-4 bg-slate-800 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
};
