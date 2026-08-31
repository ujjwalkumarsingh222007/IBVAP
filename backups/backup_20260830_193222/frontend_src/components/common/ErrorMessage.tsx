import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'System Communication Error',
  message,
  onRetry,
}) => {
  return (
    <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-5 text-red-200">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-red-900/40 border border-red-800/60 rounded-lg text-red-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-red-300">{title}</h4>
          <p className="text-xs text-red-300/80 mt-1 leading-relaxed">{message}</p>
          {onRetry && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-red-800 hover:bg-red-900/50 text-red-200"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry Connection
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
