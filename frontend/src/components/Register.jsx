import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Bot, CheckCircle2, Loader2, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register = ({ onToggleMode }) => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await register(username, email, password);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => onToggleMode(), 1800);
    } else {
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
            Build Your Autonomous Memory
          </div>

          <div className="mt-8 max-w-2xl">
            <h1 className="type-headline text-3xl font-extrabold leading-tight sm:text-5xl">
              Ervis ağına katıl.
            </h1>
            <p className="mt-4 text-sm text-[var(--text-muted)] sm:text-base">
              Rolünü, hedeflerini ve çalışma stilini öğrenen uzman seviyesinde asistan deneyimi için hesabını oluştur.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="surface-card rounded-2xl p-4">
              <p className="type-headline text-sm font-semibold">Kişisel Bilgi Grafiği</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Süreç, tercih ve rol bilgisini birlikte hatırlar.</p>
            </div>
            <div className="surface-card rounded-2xl p-4">
              <p className="type-headline text-sm font-semibold">Operasyonel Hız</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Görev, karar ve yanıt akışını tek panelden yönetirsin.</p>
            </div>
          </div>
        </section>

        <section className="surface-panel fade-rise stagger-1 rounded-3xl p-6 sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="rounded-2xl bg-[linear-gradient(135deg,var(--accent-1),var(--accent-2))] p-3 text-slate-950">
              <Bot size={24} />
            </div>
            <div>
              <p className="type-headline text-lg font-bold">Create Access</p>
              <p className="text-xs text-[var(--text-muted)]">Yeni kullanıcı kaydı</p>
            </div>
          </div>

          {success ? (
            <div className="surface-card rounded-2xl p-6 text-center">
              <CheckCircle2 size={42} className="mx-auto text-blue-300" />
              <p className="type-headline mt-3 text-xl font-bold">Kayıt tamamlandı</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Giriş ekranına yönlendiriliyorsun...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-sky-300/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
                  <AlertCircle size={15} className="mr-2 inline" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="register-name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Ad Soyad
                </label>
                <input
                  id="register-name"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="surface-card h-12 w-full rounded-xl px-4 text-sm outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[rgba(126,168,255,0.52)]"
                  placeholder="Adınız Soyadınız"
                />
              </div>

              <div>
                <label htmlFor="register-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  E-posta
                </label>
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="surface-card h-12 w-full rounded-xl px-4 text-sm outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[rgba(126,168,255,0.52)]"
                  placeholder="ornek@mail.com"
                />
              </div>

              <div>
                <label htmlFor="register-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Şifre
                </label>
                <input
                  id="register-password"
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
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                Hesap Oluştur
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onToggleMode}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-2)] hover:text-blue-200"
          >
            Zaten hesabın var mı? Giriş yap
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
};

export default Register;
