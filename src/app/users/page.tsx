'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleGate from '@/components/ui/RoleGate';
import { User, PaginatedResponse, UserRole } from '@/types';
import { Users, Plus, Trash2, Search, Edit2, X, Shield } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const ROLES: UserRole[] = ['viewer', 'executor', 'editor', 'admin'];

const ROLE_STYLES: Record<UserRole, string> = {
  admin:    'bg-red-900/40 text-red-300',
  editor:   'bg-indigo-900/40 text-indigo-300',
  executor: 'bg-blue-900/40 text-blue-300',
  viewer:   'bg-slate-700 text-slate-400',
};

type UserForm = { name: string; email: string; role: UserRole; password: string };
const defaultForm = (): UserForm => ({ name: '', email: '', role: 'viewer', password: '' });

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(defaultForm());

  const { data, isLoading } = useQuery<PaginatedResponse<User>>({
    queryKey: ['users', search],
    queryFn: async () => {
      const res = await usersApi.list({ search: search || undefined, page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(form as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setShowCreate(false); setForm(defaultForm()); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to create user'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Role updated'); setEditTarget(null); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to update role'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); setDeleteTarget(null); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete user'),
  });

  const users = data?.items ?? [];

  const roleRadioClass = (selected: boolean) => clsx(
    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors capitalize text-sm',
    selected ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300' : 'border-slate-600 hover:bg-slate-700 text-slate-400'
  );

  return (
    <AppShell title="Users">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
              className="pl-9 pr-4 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60" />
          </div>
          <RoleGate minRole="admin">
            <button onClick={() => { setForm(defaultForm()); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" /> Invite User
            </button>
          </RoleGate>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Login</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-semibold text-sm flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize', ROLE_STYLES[user.role])}>
                          <Shield className="w-3 h-3" />{user.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {user.last_login ? format(new Date(user.last_login), 'MMM d, yyyy HH:mm') : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <RoleGate minRole="admin">
                            <button onClick={() => setEditTarget(user)}
                              className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-indigo-900/30 transition-colors" title="Change role">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(user)}
                              className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/30 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </RoleGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">Invite User</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" autoFocus
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <label key={r} className={roleRadioClass(form.role === r)}>
                      <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => setForm({ ...form, role: r })} className="sr-only" />
                      <Shield className="w-3.5 h-3.5" />{r}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.email.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60">
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditTarget(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">Change Role</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Changing role for <strong className="text-slate-200">{editTarget.name}</strong></p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {ROLES.map((r) => (
                <label key={r} className={roleRadioClass(editTarget.role === r)}>
                  <input type="radio" name="edit-role" value={r} checked={editTarget.role === r} onChange={() => setEditTarget({ ...editTarget, role: r })} className="sr-only" />
                  <Shield className="w-3.5 h-3.5" />{r}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => updateRoleMutation.mutate({ id: editTarget.id, role: editTarget.role })} disabled={updateRoleMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60">
                {updateRoleMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Delete "${deleteTarget?.name}"? They will lose all access. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
