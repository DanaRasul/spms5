'use client';
import React, { useState, useRef } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function LoginPage() {
  const { login } = useSPMS();
  const { t, language, setLanguage, dir } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // Client-side attempt tracking (server also enforces lockout)
  const attemptsRef = useRef(0);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const getRemainingLockTime = () => {
    if (!lockedUntil) return '';
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (remaining <= 0) return '';
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError(t('loginRequired')); return; }
    if (isLocked) return;

    setLoading(true);
    setError('');

    try {
      const result = await login(username, password);

      if (!result.success) {
        attemptsRef.current += 1;

        if (result.message === 'accountLocked' || attemptsRef.current >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          setLockedUntil(until);
          attemptsRef.current = 0;
          setError(t('accountLocked'));

          // Auto-clear lock after 5 minutes
          if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
          lockTimerRef.current = setTimeout(() => {
            setLockedUntil(null);
            setError('');
          }, LOCKOUT_MS);
        } else {
          setError(t('loginError'));
        }
      }
    } catch {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 flex gap-2">
        {SUPPORTED_LANGUAGES.map(lang => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${language === lang.code ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            {lang.name}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('appName')}</h1>
          <p className="text-blue-300 mt-1 text-sm">{t('appShort')} v1.0</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">{t('login')}</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
              {isLocked && (
                <span className="block mt-1 text-xs opacity-80">
                  {getRemainingLockTime()}
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">{t('username')}</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                placeholder={t('username')}
                autoComplete="username"
                disabled={isLocked}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRememberMe(v => !v)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-white/30 bg-transparent'}`}
              >
                {rememberMe && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span
                className="text-sm text-blue-200 cursor-pointer select-none"
                onClick={() => setRememberMe(v => !v)}
              >
                {t('rememberMe')}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors mt-2"
            >
              {loading ? t('loading') : t('loginButton')}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">{t('copyright')}</p>
      </div>
    </div>
  );
}
