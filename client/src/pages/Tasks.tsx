import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckSquare, ListTodo, Users, ShieldCheck, Briefcase, UserCheck, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, usersApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AssignedTo = 'all' | 'admin' | 'manager' | 'seller' | 'user';

const assignOptions: { value: AssignedTo; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { value: 'all',     label: 'Todos',        icon: <Users className="h-3.5 w-3.5" /> },
  { value: 'admin',   label: 'Admins',       icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { value: 'manager', label: 'Gerentes',     icon: <Briefcase className="h-3.5 w-3.5" /> },
  { value: 'seller',  label: 'Vendedores',   icon: <UserCheck className="h-3.5 w-3.5" /> },
  { value: 'user',    label: 'Específico',   icon: <User className="h-3.5 w-3.5" />, adminOnly: true },
];

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState<AssignedTo>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.getAll,
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: !!user && user.role === 'admin',
  });

  const createTaskMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskTitle('');
      setAssignedTo('all');
      setSelectedUserId('');
      toast({ title: "Tarefa criada", description: "A tarefa foi adicionada com sucesso." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao criar tarefa", description: error.message });
    }
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      tasksApi.update(id, { completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: "Tarefa removida" });
    },
  });

  if (!user) return null;

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) {
      toast({ variant: "destructive", title: "Campo obrigatório", description: "Digite o título da tarefa." });
      return;
    }
    if (assignedTo === 'user' && !selectedUserId) {
      toast({ variant: "destructive", title: "Selecione um usuário", description: "Escolha um usuário para atribuir a tarefa." });
      return;
    }
    createTaskMutation.mutate({
      title: newTaskTitle,
      assignedTo,
      assignedToId: assignedTo === 'user' ? selectedUserId : undefined,
    });
  };

  const getAssignedLabel = (task: typeof tasks[0]) => {
    if (task.assignedTo === 'all') return 'Todos';
    if (task.assignedTo === 'user' && task.assignedToId) {
      const u = users.find(u => u.id === task.assignedToId);
      return u ? u.name : 'Usuário';
    }
    if (task.assignedTo === 'admin')   return 'Admins';
    if (task.assignedTo === 'manager') return 'Gerentes';
    if (task.assignedTo === 'seller')  return 'Vendedores';
    return task.assignedTo;
  };

  const badgeColor: Record<string, string> = {
    all:     'bg-blue-50 text-blue-600 border-blue-100',
    admin:   'bg-purple-50 text-purple-600 border-purple-100',
    manager: 'bg-amber-50 text-amber-600 border-amber-100',
    seller:  'bg-emerald-50 text-emerald-600 border-emerald-100',
    user:    'bg-gray-50 text-gray-600 border-gray-200',
  };

  const pendingTasks  = tasks.filter(t => !t.completed);
  const doneTasks     = tasks.filter(t => t.completed);
  const pendingCount  = pendingTasks.length;

  const visibleOptions = assignOptions.filter(o => !o.adminOnly || user.role === 'admin');

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── BANNER ── */}
      <div className="overflow-hidden rounded-3xl shadow-sm">
        <div className="relative bg-[#B71C1C] px-6 py-5">
          <div className="banner-texture" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <ListTodo className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                {user.role === 'admin' ? 'Todas as Tarefas' : 'Minhas Tarefas'}
                <span className="hidden sm:inline text-sm font-normal text-white/50 ml-2">— Equipa</span>
              </h1>
              <p className="flex items-center gap-2 text-[11px] font-medium text-white/60 mt-0.5">
                <span>{tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}</span>
                {pendingCount > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-amber-300/80" />
                    <span className="text-amber-200">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</span>
                  </>
                )}
                {doneTasks.length > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/40" />
                    <span>{doneTasks.length} concluída{doneTasks.length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAINEL PRINCIPAL ── */}
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* Formulário */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Nova tarefa</p>

          {/* Input + botão */}
          <div className="flex gap-2">
            <Input
              data-testid="input-new-task"
              placeholder="Descreva a tarefa..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="h-10 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
            />
            <Button
              data-testid="button-add-task"
              onClick={handleAddTask}
              disabled={createTaskMutation.isPending}
              className="h-10 rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] px-4 text-sm font-semibold hover:opacity-90 shadow-sm shadow-[#B71C1C]/25"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {/* Atribuição — pills compactos */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-400 mr-1">Para:</span>
            {visibleOptions.map((opt) => {
              const active = assignedTo === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setAssignedTo(opt.value); setSelectedUserId(''); }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-[#B71C1C] text-white shadow-sm shadow-[#B71C1C]/30'
                      : 'border border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Seletor de usuário específico */}
          {assignedTo === 'user' && user.role === 'admin' && (
            <div className="mt-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9 rounded-xl border-gray-200 bg-gray-50 text-sm focus:border-[#B71C1C]/40 focus:ring-[#B71C1C]/15">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} <span className="text-muted-foreground">({u.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Lista de tarefas */}
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">A carregar tarefas...</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100">
              <CheckSquare className="h-7 w-7 text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Tudo em dia!</p>
              <p className="text-xs text-gray-400 mt-0.5">Nenhuma tarefa pendente. Bom trabalho!</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Pendentes */}
            {pendingTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-5 py-2 bg-gray-50/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Pendentes · {pendingTasks.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {pendingTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      label={getAssignedLabel(task)}
                      colorClass={badgeColor[task.assignedTo] ?? badgeColor.user}
                      onToggle={() => toggleTaskMutation.mutate({ id: task.id, completed: !task.completed })}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Concluídas */}
            {doneTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-5 py-2 bg-gray-50/60 border-t border-gray-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Concluídas · {doneTasks.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      label={getAssignedLabel(task)}
                      colorClass={badgeColor[task.assignedTo] ?? badgeColor.user}
                      onToggle={() => toggleTaskMutation.mutate({ id: task.id, completed: !task.completed })}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── sub-componente linha de tarefa ── */
function TaskRow({
  task, label, colorClass, onToggle, onDelete,
}: {
  task: { id: string; title: string; completed: boolean };
  label: string;
  colorClass: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid={`task-${task.id}`}
      className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/70"
    >
      <Checkbox
        data-testid={`checkbox-${task.id}`}
        checked={task.completed}
        onCheckedChange={onToggle}
        className="shrink-0 rounded-md border-gray-300 data-[state=checked]:border-[#B71C1C] data-[state=checked]:bg-[#B71C1C]"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>
      </div>
      <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
        {label}
      </span>
      <button
        data-testid={`button-delete-${task.id}`}
        type="button"
        title="Eliminar tarefa"
        onClick={onDelete}
        className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
