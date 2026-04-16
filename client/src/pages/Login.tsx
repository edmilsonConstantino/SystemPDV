import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, Eye, EyeOff, ShoppingBag } from 'lucide-react';
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
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Por favor, preencha utilizador e senha.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await login(username, password);
      toast({ title: 'Login realizado!', description: 'Bem-vindo ao Makira Sales.' });
      setLocation('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Utilizador ou senha incorretos.';
      toast({ variant: 'destructive', title: 'Erro ao fazer login', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && !isLoading) { setLocation('/'); return null; }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#B71C1C]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <ShoppingBag className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-white/60">Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* ── PAINEL ESQUERDO — marca ── */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#c0392b] via-[#a93226] to-[#922b21] px-8 py-12 lg:w-[45%] lg:min-h-screen">
        {/* Textura diagonal */}
        <div className="banner-texture opacity-[0.06]" />

        {/* Orb decorativo */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/5 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#B71C1C]/30 blur-[60px]" />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          {/* Logo */}
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-2xl">
            <ShoppingBag className="h-9 w-9 text-[#B71C1C]" strokeWidth={1.75} />
          </div>

          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
              Makira Sales
            </h1>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-white/40">
              Sistema de Vendas
            </p>
          </div>

          {/* Descrição — só desktop */}
          <div className="hidden lg:block space-y-3 max-w-xs">
            {[
              { icon: '📦', label: 'Gestão de produtos e stock' },
              { icon: '🧾', label: 'PDV rápido e intuitivo' },
              { icon: '📊', label: 'Relatórios e análise financeira' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-base">{item.icon}</span>
                <span className="text-sm font-medium text-white/70">{item.label}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-white/25">© {new Date().getFullYear()} Makira Sales</p>
        </div>
      </div>

      {/* ── PAINEL DIREITO — formulário ── */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-10 lg:px-12">
        <div className="w-full max-w-sm">

          {/* Cabeçalho do card */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Bem-vindo de volta <span className="inline-block">👋</span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">Acesse a sua conta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Utilizador */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Utilizador
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  autoComplete="username"
                  placeholder="ex: admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 rounded-xl border-gray-200 bg-white pl-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:border-[#B71C1C]/50 focus-visible:ring-[#B71C1C]/15"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Senha
                </Label>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[#B71C1C] transition hover:underline"
                  onClick={() => toast({ title: 'Recuperar senha', description: 'Fale com o administrador do sistema para redefinir a sua senha.' })}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 rounded-xl border-gray-200 bg-white pl-10 pr-12 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:border-[#B71C1C]/50 focus-visible:ring-[#B71C1C]/15"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botão */}
            <button
              type="submit"
              data-testid="button-login"
              disabled={isSubmitting}
              className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] text-sm font-bold text-white shadow-lg shadow-[#B71C1C]/30 transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
            >
              {isSubmitting ? 'Entrando…' : 'Entrar no sistema'}
            </button>

            <p className="pt-2 text-center text-sm text-gray-500">
              Não tem conta?{' '}
              <span className="font-semibold text-[#B71C1C]">Fale com o administrador</span>
            </p>
          </form>
        </div>
      </div>

    </div>
  );
}
