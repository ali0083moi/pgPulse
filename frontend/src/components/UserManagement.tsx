import React, { useState, useEffect } from 'react';
import { UsersResponse, UserRoleInfo, DiscoveredSource } from '../types';
import { fetchUsers, createUser, changePassword, togglePrivilege } from '../services/api';
import { Shield, UserPlus, Key, Database, Lock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface UserManagementProps {
  activeSource: DiscoveredSource | null;
}

export const UserManagement: React.FC<UserManagementProps> = ({ activeSource }) => {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState<string | null>(null); // username
  const [showSuperuserModal, setShowSuperuserModal] = useState<any | null>(null); // pending action payload

  // Form states
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', isSuperuser: false, canCreateDb: true });
  const [newPassword, setNewPassword] = useState('');
  const [superCreds, setSuperCreds] = useState({ user: 'postgres', password: '' });

  const loadData = async (overrideSuperUser?: string, overrideSuperPass?: string) => {
    if (!activeSource) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsers(activeSource.id, overrideSuperUser, overrideSuperPass);
      if (res.requiresSuperuser) {
        setShowSuperuserModal({ action: 'load' });
      } else if (res.error) {
        setError(res.error);
      } else {
        setData(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSource]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSource) return;
    setLoading(true);
    try {
      const res = await createUser(activeSource.id, newUserForm, superCreds.password ? superCreds : undefined);
      if (res.requiresSuperuser) {
        setShowSuperuserModal({ action: 'create', data: newUserForm });
      } else if (!res.success) {
        setError(res.error);
      } else {
        setShowCreateModal(false);
        setNewUserForm({ username: '', password: '', isSuperuser: false, canCreateDb: true });
        loadData(superCreds.user, superCreds.password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSource || !showPassModal) return;
    setLoading(true);
    try {
      const res = await changePassword(
        activeSource.id,
        { username: showPassModal, newPassword },
        superCreds.password ? superCreds : undefined
      );
      if (res.requiresSuperuser) {
        setShowSuperuserModal({ action: 'password', username: showPassModal, newPassword });
      } else if (!res.success) {
        setError(res.error);
      } else {
        setShowPassModal(null);
        setNewPassword('');
        loadData(superCreds.user, superCreds.password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (username: string, database: string, currentAccess: boolean) => {
    if (!activeSource) return;
    setLoading(true);
    try {
      const res = await togglePrivilege(
        activeSource.id,
        { username, database, grant: !currentAccess },
        superCreds.password ? superCreds : undefined
      );
      if (res.requiresSuperuser) {
        setShowSuperuserModal({ action: 'privilege', username, database, grant: !currentAccess });
      } else if (!res.success) {
        setError(res.error);
      } else {
        loadData(superCreds.user, superCreds.password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuperuserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pending = showSuperuserModal;
    setShowSuperuserModal(null);
    if (!pending) return;

    if (pending.action === 'load') {
      loadData(superCreds.user, superCreds.password);
    } else if (pending.action === 'create') {
      createUser(activeSource!.id, pending.data, superCreds).then(() => loadData(superCreds.user, superCreds.password));
    } else if (pending.action === 'password') {
      changePassword(activeSource!.id, { username: pending.username, newPassword: pending.newPassword }, superCreds).then(() =>
        loadData(superCreds.user, superCreds.password)
      );
    } else if (pending.action === 'privilege') {
      togglePrivilege(activeSource!.id, { username: pending.username, database: pending.database, grant: pending.grant }, superCreds).then(
        () => loadData(superCreds.user, superCreds.password)
      );
    }
  };

  if (!activeSource) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Please connect to a PostgreSQL source first to manage Users and Privileges.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F19] overflow-y-auto p-6 space-y-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Users, Roles & Privilege Matrix
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage PostgreSQL database users, password credentials, and database access privileges.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Create New Role / User
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Database Roles List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Database Roles & System Users</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.users?.map((u) => (
            <div key={u.rolname} className="p-4 rounded-xl glass-panel border border-slate-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                  <span>{u.rolname}</span>
                  {u.isSuperuser && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-amber-950 text-amber-400 border border-amber-800/50 rounded font-semibold">
                      SUPERUSER
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setShowPassModal(u.rolname)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <Key className="w-3 h-3 text-cyan-400" />
                  Pass
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                <div>Create DB: {u.canCreateDb ? <span className="text-emerald-400">Yes</span> : <span className="text-slate-600">No</span>}</div>
                <div>Login: {u.canLogin ? <span className="text-emerald-400">Yes</span> : <span className="text-slate-600">No</span>}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database Access Matrix */}
      <div className="space-y-3 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Database Access Privilege Matrix (CONNECT Privilege)
        </h3>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-300">Username / Role</th>
                {data?.databases?.map((db) => (
                  <th key={db} className="px-4 py-3 font-semibold text-cyan-400 font-mono text-center">
                    {db}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data?.users?.map((u) => (
                <tr key={u.rolname} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-200">{u.rolname}</td>
                  {data?.databases?.map((db) => {
                    const access = data?.matrix?.find((m) => m.username === u.rolname && m.database === db);
                    const hasAccess = access?.hasAccess ?? false;
                    return (
                      <td key={db} className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleAccess(u.rolname, db, hasAccess)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            hasAccess
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800'
                              : 'bg-slate-950 text-slate-500 border border-slate-800 hover:bg-emerald-950 hover:text-emerald-300'
                          }`}
                        >
                          {hasAccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {hasAccess ? 'Access Granted' : 'Denied'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-modal rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              Create New Role / User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newUserForm.isSuperuser}
                    onChange={(e) => setNewUserForm({ ...newUserForm, isSuperuser: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-800 text-cyan-500"
                  />
                  Superuser
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newUserForm.canCreateDb}
                    onChange={(e) => setNewUserForm({ ...newUserForm, canCreateDb: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-800 text-cyan-500"
                  />
                  Can Create DB
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-modal rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-cyan-400" />
              Change Password for '{showPassModal}'
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Superuser Elevation Modal */}
      {showSuperuserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md glass-modal rounded-2xl p-6 space-y-4 shadow-2xl border border-amber-500/40">
            <div className="flex items-center gap-3 text-amber-400">
              <Lock className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-100">Superuser Privilege Required</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action requires high-level administrative permissions (`SUPERUSER`). Please enter the credentials for your main `postgres` system user to execute this operation.
            </p>

            <form onSubmit={handleSuperuserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Superuser Name</label>
                <input
                  type="text"
                  value={superCreds.user}
                  onChange={(e) => setSuperCreds({ ...superCreds, user: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Superuser Password</label>
                <input
                  type="password"
                  value={superCreds.password}
                  onChange={(e) => setSuperCreds({ ...superCreds, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Enter postgres password..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSuperuserModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
                >
                  Authenticate & Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
