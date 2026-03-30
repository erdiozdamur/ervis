import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Bot, Loader2, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = ({ onToggleMode }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(email, password);
    if (!result.success) {
      setError(result.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell relative min-h-[100dvh] overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-panel fade-rise rounded-3xl p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(107,212,255,0.16)] px-3 py-1 text-xs text-[var(--accent-2)]">
            <Sparkles size={14} />
            Autonomous Memory Engine
          </div>

          <div className="mt-8 max-w-2xl">
            <h1 className="type-headline text-3xl font-extrabold leading-tight sm:text-5xl">
              Komuta merkezine geri dön.
            </h1>
            <p className="mt-4 text-sm text-[var(--text-muted)] sm:text-base">
              Ervis, bağlamı unutmayan ve kararları hızlandıran uzman asistan deneyimini yeniden başlatmaya hazır.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="surface-card rounded-2xl p-4">
              <p className="type-headline text-sm font-semibold">Hafıza Öncelikli</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Konuşmalarını ilişkilendirir, tutarlı yanıt verir.</p>
            </div>
            <div className="surface-card rounded-2xl p-4">
              <p className="type-headline text-sm font-semibold">Gerçek Zamanlı</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Gerektiğinde canlı web bağlamıyla kararını günceller.</p>
            </div>
          </div>
        </section>

        <section className="surface-panel fade-rise stagger-1 rounded-3xl p-6 sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="rounded-2xl bg-[linear-gradient(135deg,var(--accent-1),var(--accent-2))] p-3 text-slate-950">
              <Bot size={24} />
            </div>
            <div>
              <p className="type-headline text-lg font-bold">Ervis Access</p>
              <p className="text-xs text-[var(--text-muted)]">Güvenli giriş</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-sky-300/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
                <AlertCircle size={15} className="mr-2 inline" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                E-posta
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="surface-card h-12 w-full rounded-xl px-4 text-sm outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[rgba(126,168,255,0.52)]"
                placeholder="ornek@mail.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Şifre
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="surface-card h-12 w-full rounded-xl px-4 text-sm outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[rgba(126,168,255,0.52)]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-accent flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              Giriş Yap
            </button>
          </form>

          <button
            type="button"
            onClick={onToggleMode}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-2)] hover:text-blue-200"
          >
            Hesabın yok mu? Kayıt ol
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
};

export default Login;
