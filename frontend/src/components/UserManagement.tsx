import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Key, Database, Check, X, AlertTriangle, RefreshCw, Lock, UserCheck, ShieldAlert } from 'lucide-react';
import { DiscoveredSource, UsersResponse, UserRoleInfo, UserDbAccess } from '../types';
import { fetchUsers, createUser, changePassword, togglePrivilege } from '../services/api';

interface UserManagementProps {
  activeSource: DiscoveredSource | null;
}

export const UserManagement: React.FC<UserManagementProps> = ({ activeSource }) => {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Superuser override modal / prompt
  const [superUser, setSuperUser] = useState('postgres');
  const [superPass, setSuperPass] = useState('');
  const [isSuperAuthRequired, setIsSuperAuthRequired] = useState(false);

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [canCreateDb, setCanCreateDb] = useState(false);

  // Password Change State
  const [selectedUserForPass, setSelectedUserForPass] = useState<string | null>(null);
  const [changePassValue, setChangePassValue] = useState('');

  const loadData = async (spUser = superUser, spPass = superPass) => {
    if (!activeSource) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsers(activeSource.id, spUser, spPass);
      if (res.error) {
        if (res.requiresSuperuser) {
          setIsSuperAuthRequired(true);
        }
        setError(res.error);
      } else {
        setData(res);
        setIsSuperAuthRequired(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSource]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSource || !newUsername) return;
    setLoading(true);
    try {
      const res = await createUser(
        activeSource.id,
        {
          username: newUsername,
          password: newUserPass,
          isSuperuser,
          canCreateDb,
        },
        { user: superUser, password: superPass }
      );
      if (res.error) {
        setError(res.error);
      } else {
        setNewUsername('');
        setNewUserPass('');
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (username: string) => {
    if (!activeSource || !changePassValue) return;
    setLoading(true);
    try {
      const res = await changePassword(
        activeSource.id,
        { username, newPassword: changePassValue },
        { user: superUser, password: superPass }
      );
      if (res.error) {
        setError(res.error);
      } else {
        setSelectedUserForPass(null);
        setChangePassValue('');
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePrivilege = async (username: string, database: string, currentGranted: boolean) => {
    if (!activeSource) return;
    setLoading(true);
    try {
      const res = await togglePrivilege(
        activeSource.id,
        { username, database, grant: !currentGranted },
        { user: superUser, password: superPass }
      );
      if (res.error) {
        setError(res.error);
      } else {
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update privileges');
    } finally {
      setLoading(false);
    }
  };

  if (!activeSource) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8B949E] text-sm">
        Connect to a PostgreSQL source to manage database users and permissions.
      </div>
    );
  }

  const usersList: UserRoleInfo[] = data?.users || [];
  const matrixList: UserDbAccess[] = data?.matrix || [];
  const databasesList: string[] = data?.databases || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0D1117] p-6 overflow-y-auto space-y-6 select-none">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#1F6FEB]/10 border border-[#1F6FEB]/30 text-[#58A6FF]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#F0F6FC]">Database User Management & Access Control</h1>
            <p className="text-xs text-[#8B949E]">Create roles, set passwords, grant superuser privileges & database access</p>
          </div>
        </div>

        <button
          onClick={() => loadData()}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#58A6FF] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Roles
        </button>
      </div>

      {/* Error Callout */}
      {error && (
        <div className="p-3.5 rounded-xl bg-[#211213] border border-[#F85149]/40 text-[#FF7B72] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F85149] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#8B949E] hover:text-[#C9D1D9]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Superuser Authentication Box (If non-superuser is connected) */}
      {isSuperAuthRequired && (
        <div className="p-4 rounded-xl bg-[#161B22] border border-[#D29922]/40 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-[#D29922]">
            <ShieldAlert className="w-4 h-4 text-[#D29922]" />
            Superuser Privileges Required to Manage Database Users
          </div>
          <p className="text-[#8B949E]">
            The current active connection does not have permission to query `pg_roles`. Please enter superuser credentials below:
          </p>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={superUser}
              onChange={(e) => setSuperUser(e.target.value)}
              placeholder="Superuser Name (postgres)"
              className="px-3 py-1.5 rounded-lg bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono text-xs focus:outline-none"
            />
            <input
              type="password"
              value={superPass}
              onChange={(e) => setSuperPass(e.target.value)}
              placeholder="Superuser Password"
              className="px-3 py-1.5 rounded-lg bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono text-xs focus:outline-none"
            />
            <button
              onClick={() => loadData(superUser, superPass)}
              className="px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2EA043] text-white font-bold text-xs cursor-pointer"
            >
              Authenticate
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Create User Form & Users Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create User Card */}
        <div className="p-5 rounded-2xl bg-[#161B22] border border-[#30363D] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#30363D] pb-3 text-sm font-bold text-[#F0F6FC]">
            <UserPlus className="w-4 h-4 text-[#58A6FF]" />
            Create New Database User
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#8B949E] font-semibold mb-1">Username *</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. app_user, analyst"
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono focus:outline-none focus:border-[#58A6FF]"
              />
            </div>

            <div>
              <label className="block text-[#8B949E] font-semibold mb-1">Password</label>
              <input
                type="password"
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
                placeholder="Optional password..."
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono focus:outline-none focus:border-[#58A6FF]"
              />
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-[#C9D1D9] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSuperuser}
                  onChange={(e) => setIsSuperuser(e.target.checked)}
                  className="rounded border-[#30363D] bg-[#0D1117] text-[#1F6FEB] focus:ring-0"
                />
                Grant SUPERUSER Permission
              </label>

              <label className="flex items-center gap-2 text-[#C9D1D9] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={canCreateDb}
                  onChange={(e) => setCanCreateDb(e.target.checked)}
                  className="rounded border-[#30363D] bg-[#0D1117] text-[#1F6FEB] focus:ring-0"
                />
                Allow CREATEDB Permission
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !newUsername}
                className="w-full py-2.5 rounded-xl bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                Create Role
              </button>
            </div>
          </form>
        </div>

        {/* Existing Users & Access Matrix */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#161B22] border border-[#30363D] space-y-4">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-3 text-sm font-bold text-[#F0F6FC]">
            <span>Database Roles & Permissions ({usersList.length})</span>
          </div>

          {usersList.length === 0 ? (
            <div className="p-8 text-center text-[#8B949E] text-xs font-medium bg-[#0D1117] rounded-xl border border-[#30363D]">
              No role data loaded. Please authenticate as superuser if required.
            </div>
          ) : (
            <div className="space-y-4">
              {usersList.map((user) => (
                <div key={user.rolname} className="p-4 rounded-xl bg-[#0D1117] border border-[#30363D] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-[#F0F6FC] font-mono">{user.rolname}</span>
                      {user.isSuperuser && (
                        <span className="px-2 py-0.5 rounded bg-[#1F6FEB]/15 border border-[#1F6FEB]/30 text-[#58A6FF] text-[10px] font-bold">
                          SUPERUSER
                        </span>
                      )}
                      {user.canCreateDb && (
                        <span className="px-2 py-0.5 rounded bg-[#3FB950]/15 border border-[#3FB950]/30 text-[#3FB950] text-[10px] font-bold">
                          CREATEDB
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedUserForPass(selectedUserForPass === user.rolname ? null : user.rolname)}
                      className="px-2.5 py-1 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#D29922] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Change Password
                    </button>
                  </div>

                  {/* Password Change Drawer */}
                  {selectedUserForPass === user.rolname && (
                    <div className="p-3 rounded-lg bg-[#161B22] border border-[#D29922]/40 flex items-center gap-2">
                      <input
                        type="password"
                        value={changePassValue}
                        onChange={(e) => setChangePassValue(e.target.value)}
                        placeholder="New password..."
                        className="flex-1 px-3 py-1 rounded bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => handleChangePassword(user.rolname)}
                        className="px-3 py-1 rounded bg-[#238636] text-white font-bold text-xs cursor-pointer"
                      >
                        Update
                      </button>
                    </div>
                  )}

                  {/* Database Access Privileges */}
                  <div className="pt-2 border-t border-[#30363D]">
                    <div className="text-[11px] font-semibold text-[#8B949E] mb-2 uppercase tracking-wider">
                      Database Access Grants:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {databasesList.map((dbName) => {
                        const accessObj = matrixList.find(
                          (m) => m.username === user.rolname && m.database === dbName
                        );
                        const isGranted = accessObj ? accessObj.hasAccess : false;

                        return (
                          <button
                            key={dbName}
                            onClick={() => handleTogglePrivilege(user.rolname, dbName, isGranted)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                              isGranted
                                ? 'bg-[#238636]/15 border-[#238636]/40 text-[#3FB950]'
                                : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9]'
                            }`}
                          >
                            <Database className="w-3 h-3" />
                            {dbName}
                            {isGranted ? <Check className="w-3 h-3 text-[#3FB950]" /> : <X className="w-3 h-3 text-[#8B949E]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
