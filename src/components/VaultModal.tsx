import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  Download,
  User,
  Lock,
  AtSign,
  Loader2,
  Check,
} from 'lucide-react';
import { downloadStandaloneApp } from '../utils/downloadApp';
import { APP_VERSION } from '../utils/version';
import { BrandLogo } from './BrandLogo';

export const VaultModal: React.FC = () => {
  const {
    isLocked,
    isAuthenticated,
    accent,
    accountSession,
    loginAccount,
    registerAccount,
  } = useVault();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState(accountSession?.username || '');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isLocked && isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = usernameInput.trim();
    const cleanDisplayName = displayNameInput.trim();

    if (cleanUsername.length < 2) {
      setErrorMessage('Please enter a valid Username or Email (at least 2 characters).');
      return;
    }

    if (authMode === 'register' && !cleanDisplayName) {
      setErrorMessage('Please enter your Display Name.');
      return;
    }

    if (passwordInput.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'register') {
        const res = await registerAccount(cleanUsername, cleanDisplayName, passwordInput);
        if (!res.ok) {
          setErrorMessage(res.message);
        } else {
          setPasswordInput('');
        }
      } else {
        const res = await loginAccount(cleanUsername, passwordInput);
        if (!res.ok) {
          setErrorMessage(res.message);
        } else {
          setPasswordInput('');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="account-auth-portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000] overflow-y-auto"
    >
      <div
        data-testid="vault-lock-modal"
        className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden"
      >
        {/* Brand Emblem & Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-[#000000] border border-[#1E222B] overflow-hidden shrink-0"
            style={{ backgroundColor: '#000000', color: accent.hex }}
          >
            <BrandLogo resolution={128} className="w-full h-full" accentColor={accent.hex} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Axiom Aegis <span className="font-mono text-sm text-amber-400">(AA)</span>
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-0.5 select-none">
              <span className="text-emerald-400 font-semibold">{APP_VERSION}</span>
              <span className="text-zinc-600">•</span>
              <span>Account Portal</span>
            </div>
          </div>
        </div>

        {/* Mode Switcher Tabs: Log In vs Create Account */}
        <div className="grid grid-cols-2 gap-1.5 p-1 mb-5 rounded-xl bg-[#08090C] border border-[#1E222B]">
          <button
            type="button"
            data-testid="auth-mode-login-tab"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'login'
                ? 'bg-[#141720] text-white border border-[#2A2F3D] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={authMode === 'login' ? { color: accent.hex } : undefined}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            data-testid="auth-mode-register-tab"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'register'
                ? 'bg-[#141720] text-white border border-[#2A2F3D] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={authMode === 'register' ? { color: accent.hex } : undefined}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {errorMessage && (
          <div
            data-testid="vault-modal-error"
            className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username or Email */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Username (or Email)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                data-testid="auth-username-input"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="username or email@domain.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#08090C] border border-[#1E222B] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          {/* Display Name (Create Account mode only) */}
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  data-testid="auth-displayname-input"
                  type="text"
                  required
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Commander Name"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#08090C] border border-[#1E222B] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                data-testid="auth-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={4}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-[#08090C] border border-[#1E222B] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
              <button
                type="button"
                data-testid="auth-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            data-testid="auth-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 mt-2 shadow-lg cursor-pointer ${accent.primaryBg} ${
              isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting
              ? authMode === 'register'
                ? 'Creating Account...'
                : 'Signing In & Syncing...'
              : authMode === 'register'
              ? 'Create Account & Enter Workspace'
              : 'Log In to Axiom Aegis'}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-[#1E222B] flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="auth-switch-mode-btn"
            onClick={() => {
              setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
              setErrorMessage(null);
            }}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
          >
            {authMode === 'login' ? 'Need an account? Create one' : 'Already have an account? Log In'}
          </button>

          <button
            type="button"
            data-testid="auth-download-standalone-btn"
            disabled={isDownloadingHtml}
            onClick={async () => {
              if (isDownloadingHtml) return;
              setIsDownloadingHtml(true);
              setErrorMessage(null);
              try {
                const ok = await downloadStandaloneApp(false);
                if (ok) {
                  setDownloadSuccess(true);
                  setTimeout(() => setDownloadSuccess(false), 3000);
                } else {
                  setErrorMessage('Clean HTML download could not complete. Please retry.');
                }
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to download clean HTML.';
                setErrorMessage(msg);
              } finally {
                setIsDownloadingHtml(false);
              }
            }}
            title="Download clean, 100% self-contained index.html copy of Axiom Aegis"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              downloadSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#08090C] text-emerald-400 border-[#1E222B] hover:border-emerald-500/40 hover:bg-[#12151D]'
            } ${isDownloadingHtml ? 'opacity-60 cursor-wait' : ''}`}
          >
            {isDownloadingHtml ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : downloadSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>
              {isDownloadingHtml
                ? 'Downloading...'
                : downloadSuccess
                ? 'Downloaded index.html!'
                : 'Download Clean HTML (index.html)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
