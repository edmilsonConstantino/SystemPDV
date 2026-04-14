import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Download, Search, ChevronDown, Activity, User, CalendarDays, Clock, FileSearch, AlertCircle } from 'lucide-react';

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  createdAt: Date;
}

interface UserItem {
  id: string;
  name: string;
  username: string;
}

const ACTION_COLORS: Record<string, string> = {
  create:   'bg-emerald-50 text-emerald-700 border-emerald-100',
  update:   'bg-blue-50 text-blue-700 border-blue-100',
  delete:   'bg-red-50 text-red-700 border-red-100',
  login:    'bg-violet-50 text-violet-700 border-violet-100',
  logout:   'bg-gray-100 text-gray-600 border-gray-200',
  export:   'bg-amber-50 text-amber-700 border-amber-100',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600 border-gray-200';
}

export default function Tracking() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startHour, setStartHour] = useState<number | undefined>();
  const [endHour, setEndHour] = useState<number | undefined>();
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao buscar usuários');
      return res.json();
    }
  });

  const filterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/audit-logs/filter', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, startDate, endDate, startHour, endHour })
      });
      if (!res.ok) throw new Error('Erro ao filtrar logs');
      return res.json();
    },
    onSuccess: (data) => {
      setFilteredLogs(data);
      setShowResults(true);
      toast({ title: 'Busca concluída', description: `${data.length} registo${data.length !== 1 ? 's' : ''} encontrado${data.length !== 1 ? 's' : ''}` });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/audit-logs/filter?format=csv', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, startDate, endDate, startHour, endHour })
      });
      if (!res.ok) throw new Error('Erro ao baixar arquivo');
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Exportado', description: 'Ficheiro CSV descarregado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">

      {/* ── BANNER ── */}
      <div className="overflow-hidden rounded-3xl shadow-sm">
        <div className="relative bg-[#B71C1C] px-4 py-4 sm:px-6 sm:py-5">
          <div className="banner-texture" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  Rastreamento
                  <span className="hidden sm:inline text-sm font-normal text-white/50 ml-2">— Auditoria do Sistema</span>
                </h1>
                <p className="flex items-center gap-2 text-[11px] font-medium text-white/60 mt-0.5">
                  <span>Histórico completo de ações</span>
                  {showResults && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-white/40" />
                      <span className="text-emerald-200">{filteredLogs.length} registo{filteredLogs.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            {showResults && filteredLogs.length > 0 && (
              <button
                type="button"
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── PAINEL DE FILTROS ── */}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">

        {/* Cabeçalho do painel */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B71C1C]/10">
            <FileSearch className="h-4 w-4 text-[#B71C1C]" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Filtrar Histórico</p>
            <p className="text-[11px] text-gray-400">Defina o utilizador e o intervalo para consultar</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4 sm:px-6 sm:py-5 sm:space-y-5">

          {/* Linha 1 — Utilizador */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-gray-400" />
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Utilizador</label>
            </div>
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                title="Selecionar utilizador"
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-none transition focus:border-[#B71C1C]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Linha 2 — Datas */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 text-gray-400" />
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Intervalo de datas</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Data inicial"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 transition focus:border-[#B71C1C]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15"
                />
                <span className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  início
                </span>
              </div>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="Data final"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 transition focus:border-[#B71C1C]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15"
                />
                <span className="absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  fim
                </span>
              </div>
            </div>
          </div>

          {/* Linha 3 — Horas (colapsável visual) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gray-400" />
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Hora (opcional)</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                max="23"
                value={startHour !== undefined ? startHour : ''}
                onChange={(e) => setStartHour(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Hora início (0 – 23)"
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 transition focus:border-[#B71C1C]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15"
              />
              <input
                type="number"
                min="0"
                max="23"
                value={endHour !== undefined ? endHour : ''}
                onChange={(e) => setEndHour(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Hora fim (0 – 23)"
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 transition focus:border-[#B71C1C]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15"
              />
            </div>
          </div>

          {/* Rodapé — Acções */}
          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => filterMutation.mutate()}
              disabled={filterMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#B71C1C]/25 transition hover:opacity-90 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {filterMutation.isPending ? 'A pesquisar...' : 'Pesquisar registos'}
            </button>
            {showResults && (
              <button
                type="button"
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── RESULTADOS ── */}
      {showResults && (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">

          {/* Cabeçalho resultados */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B71C1C]/10">
                <Activity className="h-4 w-4 text-[#B71C1C]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  Resultados
                  <span className="ml-2 inline-flex items-center rounded-full bg-[#B71C1C]/10 px-2 py-0.5 text-[11px] font-bold text-[#B71C1C]">
                    {filteredLogs.length}
                  </span>
                </p>
                {selectedUser && (
                  <p className="text-[11px] text-gray-400">
                    {selectedUser.name} · {startDate} → {endDate}
                    {startHour !== undefined && endHour !== undefined && ` · ${startHour}h – ${endHour}h`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100">
                <AlertCircle className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Sem registos</p>
                <p className="text-xs text-gray-400 mt-0.5">Nenhuma actividade encontrada para este período.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/40">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Data / Hora</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Ação</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Entidade</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="group transition-colors hover:bg-gray-50/60">
                      <td className="px-5 py-3.5 text-xs tabular-nums text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${actionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-gray-400">
                        {log.entityId ? log.entityId.slice(-8).toUpperCase() : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <details className="cursor-pointer">
                          <summary className="font-semibold text-[#B71C1C] hover:underline list-none flex items-center gap-1">
                            <ChevronDown className="h-3 w-3" />
                            Ver
                          </summary>
                          <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] text-gray-600 border border-gray-100">
                            {JSON.stringify(log.details || {}, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
