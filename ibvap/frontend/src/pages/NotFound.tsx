import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-4 text-amber-400">
        <AlertTriangle className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold text-slate-100 mb-2 font-mono">404 — Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6 font-mono">
        The requested surveillance dashboard route does not exist or has been relocated.
      </p>
      <Link to="/">
        <Button variant="primary" icon={<Home className="w-4 h-4" />}>
          Return to Command Center
        </Button>
      </Link>
    </div>
  );
};
