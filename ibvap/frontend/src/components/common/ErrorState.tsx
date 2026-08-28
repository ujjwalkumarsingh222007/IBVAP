import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'API Connection Notice',
  message = 'Unable to reach the IBVAP FastAPI backend server. Ensure backend services are running on http://localhost:8000.',
  onRetry,
}) => {
  return (
    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-5 text-amber-200 flex flex-col sm:flex-row items-start gap-4">
      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 shrink-0">
        <AlertTriangle size={22} />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-sm text-amber-300 mb-1">{title}</h4>
        <p className="text-xs text-amber-200/80 leading-relaxed mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium rounded-lg border border-amber-500/40 transition-colors"
          >
            <RefreshCw size={14} />
            <span>Retry Request</span>
          </button>
        )}
      </div>
    </div>
  );
};
