import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks';
import { Button } from '../components/common/Button';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login({ username: username.trim(), password });
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (userVal: string, passVal: string) => {
    setUsername(userVal);
    setPassword(passVal);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-4 font-mono relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface border border-surface-border rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Command Center Logo Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3.5 bg-blue-950/80 border border-blue-800 rounded-2xl text-blue-400 shadow-inner">
            <Shield className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-wider uppercase">
              IBVAP Command Center
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Intelligent Border Video Analytics Platform — Authentication Gateway
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block text-red-200">Authentication Failed</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold uppercase tracking-wider text-[11px] block">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter operator username"
                required
                className="w-full bg-slate-900/90 border border-surface-border rounded-xl pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold uppercase tracking-wider text-[11px] block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full bg-slate-900/90 border border-surface-border rounded-xl pl-9 pr-10 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full justify-center py-2.5 text-sm font-bold mt-2"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Authenticate & Access Grid
          </Button>
        </form>

        {/* Role Presets */}
        <div className="pt-4 border-t border-surface-border space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Role Credentials:</span>
            <span className="text-slate-500 text-[10px]">Quick Select</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin', 'admin123')}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-700 text-slate-200 transition-colors text-left font-mono group"
            >
              <div className="flex items-center justify-between text-[10px] text-red-400 font-bold uppercase">
                <span>ADMIN</span>
                <CheckCircle2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 block truncate">admin / admin123</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('operator', 'operator123')}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-700 text-slate-200 transition-colors text-left font-mono group"
            >
              <div className="flex items-center justify-between text-[10px] text-blue-400 font-bold uppercase">
                <span>OPERATOR</span>
                <CheckCircle2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 block truncate">operator / op123</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('viewer', 'viewer123')}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-700 text-slate-200 transition-colors text-left font-mono group"
            >
              <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase">
                <span>VIEWER</span>
                <CheckCircle2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 block truncate">viewer / view123</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-600 font-mono mt-6">
        Protected by SHA-256 PBKDF2 Hashing & JWT Bearer Session Security
      </p>
    </div>
  );
};

export default Login;
