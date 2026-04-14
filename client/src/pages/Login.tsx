import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Login() {
  const { user, login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha usuário e senha.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username, password);
      toast({
        title: 'Login realizado!',
        description: 'Bem-vindo ao Makira Sales.',
      });
      setLocation('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Usuário ou senha incorretos.';
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer login',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && !isLoading) {
    setLocation('/');
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25" />
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero — gradiente, orbs, ondas em camadas */}
      <header className="relative flex-[0_0_auto] min-h-[min(46vh,360px)] overflow-hidden rounded-b-[2rem] sm:min-h-[min(48vh,380px)] sm:rounded-b-[2.75rem] shadow-[0_24px_60px_-28px_rgba(90,110,170,0.38)]">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 70% at 50% -10%, rgba(255, 255, 255, 0.55) 0%, transparent 55%),
              radial-gradient(ellipse 90% 60% at 15% 40%, rgba(255, 255, 255, 0.22) 0%, transparent 50%),
              radial-gradient(ellipse 70% 50% at 95% 25%, rgba(186, 230, 253, 0.5) 0%, transparent 45%),
              radial-gradient(ellipse 55% 45% at 70% 85%, rgba(167, 243, 208, 0.4) 0%, transparent 50%),
              linear-gradient(155deg, #b8cef5 0%, #a8e0d8 38%, #9eb8ef 72%, #c5d4f8 100%)
            `,
          }}
        />

        {/* Orbs difusos animados */}
        <div
          className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[#8ec5ff]/35 blur-[80px] animate-[login-glow_8s_ease-in-out_infinite]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-[#7dd3c0]/40 blur-[72px] animate-[login-glow_8s_ease-in-out_2s_infinite]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/3 bottom-1/4 h-48 w-48 -translate-x-1/2 rounded-full bg-white/50 blur-[56px] animate-[login-shimmer_12s_ease-in-out_infinite]"
          aria-hidden
        />

        {/* Brilho / partículas */}
        <div
          className="pointer-events-none absolute inset-0 animate-[login-shimmer_14s_ease-in-out_infinite]"
          style={{
            backgroundImage: `radial-gradient(2px 2px at 10% 20%, rgba(255,255,255,0.95) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 25% 55%, rgba(255,255,255,0.9) 50%, transparent 50%),
              radial-gradient(1px 1px at 42% 30%, rgba(255,255,255,0.85) 50%, transparent 50%),
              radial-gradient(2px 2px at 68% 15%, rgba(255,255,255,0.95) 50%, transparent 50%),
              radial-gradient(1px 1px at 82% 42%, rgba(255,255,255,0.8) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 55% 68%, rgba(255,255,255,0.88) 50%, transparent 50%),
              radial-gradient(1px 1px at 88% 72%, rgba(255,255,255,0.75) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 15% 78%, rgba(255,255,255,0.7) 50%, transparent 50%)`,
            backgroundSize: '100% 100%',
            opacity: 0.55,
          }}
          aria-hidden
        />

        <div className="relative z-20 flex h-full min-h-[min(46vh,360px)] flex-col items-center justify-center px-6 pb-[5.5rem] pt-10 text-center sm:min-h-[min(48vh,380px)] sm:pb-[6.25rem]">
          {/* Logo + nome em linha */}
          <div className="flex items-center gap-3">
            <div className="animate-[login-float_5.5s_ease-in-out_infinite] flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-2xl border border-white/55 bg-white/30 shadow-[0_12px_40px_-12px_rgba(80,100,160,0.35)] backdrop-blur-md ring-1 ring-white/40">
              <span className="bg-gradient-to-br from-[#3d8a7a] to-[#5a6fd0] bg-clip-text font-heading text-[1.75rem] font-bold tracking-tight text-transparent drop-shadow-sm">
                M
              </span>
            </div>
            <div className="text-left">
              <h1 className="font-heading text-[1.65rem] font-bold tracking-tight text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] sm:text-3xl">
                <span className="bg-gradient-to-r from-primary via-accent to-[hsl(262_72%_52%)] bg-clip-text text-transparent">
                  Makira Sales
                </span>
              </h1>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-slate-600/80">
                Sistema de vendas
              </p>
            </div>
          </div>
        </div>

        {/* Ondas em camadas + reflexo */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[min(28vw,7.5rem)] min-h-[5.25rem] sm:h-[min(26vw,8.5rem)] sm:min-h-[6rem]"
          aria-hidden
        >
          {/* Camada 3 — fundo, deriva horizontal */}
          <div
            className="absolute inset-x-[-12%] bottom-0 h-full w-[124%] animate-[login-drift_18s_ease-in-out_infinite] opacity-90"
            style={{ animationDelay: '-3s' }}
          >
            <svg
              className="h-[78%] w-full min-h-[3.25rem] text-[#d4dce8]"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                d="M0,75 C180,35 360,100 540,58 C720,18 900,88 1080,52 C1200,35 1320,70 1440,48 L1440,120 L0,120 Z"
              />
            </svg>
          </div>

          {/* Camada 2 — ondulação média */}
          <div
            className="absolute inset-x-0 bottom-0 flex h-full w-full items-end justify-center animate-[login-wave-bob_9s_ease-in-out_infinite]"
            style={{ animationDelay: '-1.5s' }}
          >
            <svg
              className="h-[88%] w-full min-h-[3.75rem] text-[#e6eaf4] drop-shadow-[0_-4px_20px_rgba(120,140,200,0.12)]"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                d="M0,55 C220,95 440,28 660,62 C880,95 1100,38 1320,58 C1380,65 1410,52 1440,50 L1440,120 L0,120 Z"
              />
            </svg>
          </div>

          {/* Camada 1 — frente, mais “espuma” */}
          <div
            className="absolute inset-x-0 bottom-0 flex h-full w-full items-end animate-[login-wave-bob_5.5s_ease-in-out_infinite]"
            style={{ animationDelay: '-0.8s' }}
          >
            <svg
              className="h-full w-full min-h-[4.25rem] text-[#eef1f8] drop-shadow-[0_-6px_24px_rgba(100,120,180,0.15)]"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                d="M0,48 C240,88 480,22 720,55 C960,88 1200,35 1440,52 L1440,120 L0,120 Z"
              />
              <path
                fill="rgba(255,255,255,0.42)"
                d="M0,42 C200,78 400,28 600,48 C800,72 1000,32 1200,45 C1320,58 1400,48 1440,44 L1440,52 L0,52 Z"
              />
            </svg>
          </div>
        </div>
      </header>

      {/* Card */}
      <main className="relative z-20 -mt-12 flex flex-1 flex-col px-4 pb-10 pt-0 sm:-mt-14 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/90 bg-white/95 p-8 shadow-[0_25px_60px_-20px_rgba(80,100,140,0.18)] backdrop-blur-sm sm:p-9">
          <div className="mb-8 text-center">
            <h2 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">
              Bem-vindo de volta <span className="inline-block">👋</span>
            </h2>
            <p className="mt-2 text-sm text-slate-500">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#6b7fd7]/90"
              >
                Utilizador
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-[#7dd3c0]"
                  strokeWidth={2}
                />
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  autoComplete="username"
                  placeholder="ex: gestor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 rounded-xl border-[#e2e8f4] bg-[#f4f7fb] pl-11 text-[0.95rem] text-slate-800 shadow-inner shadow-white/50 placeholder:text-slate-400 focus-visible:border-[#9db5ff] focus-visible:ring-[#9db5ff]/25"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="password"
                  className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#6b7fd7]/90"
                >
                  Senha
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-[#5a9d8f] transition hover:text-[#3d7a6f] hover:underline"
                  onClick={() =>
                    toast({
                      title: 'Recuperar senha',
                      description: 'Fale com o administrador do sistema para redefinir sua senha.',
                    })
                  }
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-[#7dd3c0]"
                  strokeWidth={2}
                />
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 rounded-xl border-[#e2e8f4] bg-[#f4f7fb] pl-11 pr-12 text-[0.95rem] text-slate-800 shadow-inner shadow-white/50 placeholder:text-slate-400 focus-visible:border-[#9db5ff] focus-visible:ring-[#9db5ff]/25"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#6b7fd7] transition hover:bg-[#eef1f8] hover:text-[#4a5bb5]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-[1.15rem] w-[1.15rem]" /> : <Eye className="h-[1.15rem] w-[1.15rem]" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="button-login"
              disabled={isSubmitting}
              className="mt-2 h-12 w-full rounded-xl border-0 bg-gradient-to-r from-[#5eb8aa] via-[#6b8dd6] to-[#8b9cf4] text-base font-semibold text-white shadow-[0_12px_28px_-8px_rgba(91,140,200,0.55)] transition hover:brightness-[1.03] hover:shadow-[0_16px_36px_-10px_rgba(91,140,200,0.6)] active:scale-[0.99] disabled:opacity-70"
            >
              {isSubmitting ? 'Entrando…' : 'Entrar no sistema'}
            </Button>

            <p className="pt-4 text-center text-sm text-slate-500">
              Não tem conta?{' '}
              <span className="font-semibold text-[#6b7fd7]">Fale com o administrador</span>
            </p>

            <p className="text-center text-[0.65rem] text-slate-400">
              © {new Date().getFullYear()} Makira Sales
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
