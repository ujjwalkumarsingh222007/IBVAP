import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="p-4 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
        <ShieldAlert size={36} />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">404 — Route Not Found</h1>
      <p className="text-xs text-slate-400 max-w-md">
        The surveillance endpoint or view path you requested is not recognized by the IBVAP frontend router.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-lg transition-colors shadow-md shadow-cyan-500/20"
      >
        <ArrowLeft size={16} /> Return to Operations Dashboard
      </Link>
    </div>
  );
};
