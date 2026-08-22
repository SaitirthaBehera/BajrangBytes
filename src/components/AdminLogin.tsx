import React, { useState } from 'react';
import { ShieldAlert, Lock, KeyRound, Eye, EyeOff, AlertTriangle, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { signInAdminWithSupabase } from '../lib/supabase';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
  requestedTabName?: string;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onCancel,
  requestedTabName = 'Admin Dashboard'
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setLoginError('Please enter your Administrator Email.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your Password.');
      return;
    }

    setIsSubmitting(true);
    setLoginError('');
    setSuccessMsg('');

    try {
      const result = await signInAdminWithSupabase(email.trim(), password);
      if (result.success) {
        setSuccessMsg('Authenticated successfully!');
        setTimeout(() => {
          onLoginSuccess();
        }, 400);
      } else {
        setLoginError(result.error || 'Invalid administrator credentials. Please check your email and password.');
      }
    } catch {
      setLoginError('Authentication service unreachable. Please verify network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="section-admin-login" className="max-w-md mx-auto py-10 px-4 space-y-6">
      <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
        {/* Return to public website button */}
        <div className="flex justify-start items-center">
          <button
            type="button"
            id="btn-login-back-public"
            onClick={onCancel}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Campus Portal</span>
          </button>
        </div>

        {/* Lock Icon */}
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        {/* Header Heading */}
        <div className="space-y-2">
          <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider inline-flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            Restricted Portal
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Administrator Sign In
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Access to {requestedTabName} is restricted to authorized campus administrators.
          </p>
        </div>

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div>
            <label htmlFor="admin-email-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <input
                id="admin-email-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLoginError('');
                  setSuccessMsg('');
                }}
                placeholder="Enter admin email"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pl-10"
                disabled={isSubmitting}
                required
                autoFocus
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError('');
                  setSuccessMsg('');
                }}
                placeholder="Enter admin password"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-10"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {loginError && (
            <p className="text-rose-600 text-xs mt-2 font-semibold flex items-center space-x-1 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </p>
          )}

          {successMsg && (
            <p className="text-emerald-700 text-xs mt-2 font-semibold flex items-center space-x-1 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </p>
          )}

          <button
            type="submit"
            id="btn-unlock-admin-submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
