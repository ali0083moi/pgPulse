import React, { useState, useEffect } from 'react';
import { X, Server, Container, Terminal, CheckCircle2, AlertCircle, Lock, Loader2, Key, Wrench, ShieldAlert, RefreshCw } from 'lucide-react';
import { DiscoveredSource } from '../types';
import { connectSource, resetSystemPassword } from '../services/api';

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  dockerSources: DiscoveredSource[];
  localSources: DiscoveredSource[];
  manualSources: DiscoveredSource[];
  activeSource: DiscoveredSource | null;
  onSelectSource: (source: DiscoveredSource) => void;
  onRefreshDiscovery: () => Promise<void>;
  isRefreshingDiscovery?: boolean;
}

const STORAGE_KEY_CREDS = 'pgpulse_source_credentials';

export const SourceModal: React.FC<SourceModalProps> = ({
  isOpen,
  onClose,
  dockerSources,
  localSources,
  manualSources,
  activeSource,
  onSelectSource,
  onRefreshDiscovery,
  isRefreshingDiscovery = false,
}) => {
  const [tab, setTab] = useState<'discovered' | 'manual'>('discovered');
  
  // Custom passwords/users per discovered source ID (persisted in localStorage)
  const [sourceCredentials, setSourceCredentials] = useState<Record<string, { user: string; pass: string; db: string }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CREDS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Password Reset Drawers per source ID
  const [resetDrawers, setResetDrawers] = useState<Record<string, boolean>>({});
  const [resetForms, setResetForms] = useState<Record<string, { newPass: string; sudoPass: string }>>({});
  const [resetStatus, setResetStatus] = useState<Record<string, { loading: boolean; error?: string; success?: string; requiresSudo?: boolean }>>({});

  const [formData, setFormData] = useState({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'postgres',
    ssl: false,
  });
  
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify(sourceCredentials));
    } catch (e) {
      console.warn('Failed to save source credentials to localStorage:', e);
    }
  }, [sourceCredentials]);

  if (!isOpen) return null;

  const getCreds = (source: DiscoveredSource) => {
    const existing = sourceCredentials[source.id];
    return {
      user: existing?.user ?? (source.user || 'postgres'),
      pass: existing?.pass ?? (source.defaultPassword || ''),
      db: existing?.db ?? (source.database || 'postgres'),
    };
  };

  const updateCreds = (sourceId: string, field: 'user' | 'pass' | 'db', val: string) => {
    setSourceCredentials((prev) => ({
      ...prev,
      [sourceId]: {
        user: prev[sourceId]?.user ?? 'postgres',
        pass: prev[sourceId]?.pass ?? '',
        db: prev[sourceId]?.db ?? 'postgres',
        [field]: val,
      },
    }));
  };

  const handleConnectDiscovered = async (source: DiscoveredSource, passOverride?: string) => {
    setLoadingId(source.id);
    setGeneralError(null);
    setErrorMap((prev) => ({ ...prev, [source.id]: '' }));

    const creds = getCreds(source);
    const passwordToUse = passOverride !== undefined ? passOverride : creds.pass;

    try {
      const config = {
        id: source.id,
        host: source.host,
        port: source.port,
        user: creds.user,
        password: passwordToUse,
        database: creds.db,
      };

      const res = await connectSource(config);
      if (res.success) {
        onSelectSource({ ...source, user: config.user, database: config.database });
        onClose();
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to connect';
      setErrorMap((prev) => ({ ...prev, [source.id]: msg }));
    } finally {
      setLoadingId(null);
    }
  };

  const handleResetPasswordAndAutoConnect = async (source: DiscoveredSource) => {
    const form = resetForms[source.id] || { newPass: 'postgres', sudoPass: '' };
    const newPassToSet = form.newPass || 'postgres';

    setResetStatus((prev) => ({ ...prev, [source.id]: { loading: true } }));

    try {
      const res = await resetSystemPassword({
        containerId: source.containerId,
        port: source.port,
        username: source.user || 'postgres',
        newPassword: newPassToSet,
        sudoPassword: form.sudoPass,
      });

      if (res.requiresSudo && !form.sudoPass) {
        setResetStatus((prev) => ({
          ...prev,
          [source.id]: { loading: false, requiresSudo: true, error: 'Sudo password required for system reset.' },
        }));
      } else if (!res.success) {
        setResetStatus((prev) => ({
          ...prev,
          [source.id]: { loading: false, requiresSudo: res.requiresSudo, error: res.error },
        }));
      } else {
        setResetStatus((prev) => ({
          ...prev,
          [source.id]: { loading: false, success: res.message },
        }));

        // Update creds in state & localStorage
        updateCreds(source.id, 'pass', newPassToSet);

        // Auto-connect with the new password!
        await handleConnectDiscovered(source, newPassToSet);
      }
    } catch (err: any) {
      setResetStatus((prev) => ({
        ...prev,
        [source.id]: { loading: false, error: err.message },
      }));
    }
  };

  const handleConnectManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingId('manual');
    setGeneralError(null);
    try {
      const manualId = `manual-${formData.host}-${formData.port}-${formData.database}`;
      const res = await connectSource({
        id: manualId,
        host: formData.host,
        port: Number(formData.port),
        user: formData.user,
        password: formData.password,
        database: formData.database,
        ssl: formData.ssl,
      });

      if (res.success) {
        updateCreds(manualId, 'user', formData.user);
        updateCreds(manualId, 'pass', formData.password);
        updateCreds(manualId, 'db', formData.database);

        onSelectSource({
          id: manualId,
          name: `Manual: ${formData.host}:${formData.port} (${formData.database})`,
          type: 'manual',
          host: formData.host,
          port: Number(formData.port),
          status: 'running',
          user: formData.user,
          database: formData.database,
        });
        onClose();
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Connection failed');
    } finally {
      setLoadingId(null);
    }
  };

  const renderSourceCard = (source: DiscoveredSource, isDocker: boolean) => {
    const creds = getCreds(source);
    const cardError = errorMap[source.id];
    const isLoading = loadingId === source.id;
    const isActive = activeSource?.id === source.id;
    const isResetOpen = !!resetDrawers[source.id];
    const statusReset = resetStatus[source.id];
    const formReset = resetForms[source.id] || { newPass: 'postgres', sudoPass: '' };
    const isAuthFailed = cardError && cardError.toLowerCase().includes('password authentication failed');

    return (
      <div
        key={source.id}
        className={`p-4 rounded-xl border transition-all space-y-3 ${
          isActive
            ? isDocker
              ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md'
              : 'bg-emerald-950/40 border-emerald-500/80 shadow-md'
            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                isDocker
                  ? 'bg-blue-950 border-blue-800/50 text-blue-400'
                  : 'bg-emerald-950 border-emerald-800/50 text-emerald-400'
              }`}
            >
              {isDocker ? <Container className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                {source.name}
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {source.host}:{source.port} | User: {creds.user || 'postgres'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setResetDrawers((prev) => ({ ...prev, [source.id]: !prev[source.id] }))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset or fix forgotten password"
            >
              <Wrench className="w-3.5 h-3.5" />
              Reset Pass
            </button>

            <button
              disabled={isLoading}
              onClick={() => handleConnectDiscovered(source)}
              className={`px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
                isDocker
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Connect
            </button>
          </div>
        </div>

        {/* Credentials Inputs (Password / Username / Database) */}
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">User</label>
            <input
              type="text"
              value={creds.user}
              onChange={(e) => updateCreds(source.id, 'user', e.target.value)}
              placeholder="postgres"
              className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={creds.pass}
                onChange={(e) => updateCreds(source.id, 'pass', e.target.value)}
                placeholder="Enter password..."
                className="w-full pl-7 pr-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
              <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1.5" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Database</label>
            <input
              type="text"
              value={creds.db}
              onChange={(e) => updateCreds(source.id, 'db', e.target.value)}
              placeholder="postgres"
              className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Auth Error & Auto-Reset Callout */}
        {cardError && (
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-mono">{cardError}</span>
              </div>
              {isAuthFailed && !isResetOpen && (
                <button
                  onClick={() => setResetDrawers((prev) => ({ ...prev, [source.id]: true }))}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 ml-2 shadow transition-colors cursor-pointer"
                >
                  Quick Sudo Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reset Password Helper Drawer */}
        {(isResetOpen || isAuthFailed) && (
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 text-xs space-y-3 shadow-lg animate-fade-in">
            <div className="font-bold text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Fix Password via System Sudo / Docker Exec</span>
              </div>
              <span className="text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800 px-2 py-0.5 rounded font-mono">
                `sudo -u postgres psql`
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-1">
                  1. System Sudo Password (OS Password)
                </label>
                <input
                  type="password"
                  value={formReset.sudoPass}
                  onChange={(e) =>
                    setResetForms((prev) => ({
                      ...prev,
                      [source.id]: { ...(prev[source.id] || { newPass: 'postgres', sudoPass: '' }), sudoPass: e.target.value },
                    }))
                  }
                  placeholder="Enter Linux Sudo Password..."
                  className="w-full px-3 py-1.5 rounded bg-slate-950 border border-amber-700/60 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-1">
                  2. New PostgreSQL Password
                </label>
                <input
                  type="text"
                  value={formReset.newPass}
                  onChange={(e) =>
                    setResetForms((prev) => ({
                      ...prev,
                      [source.id]: { ...(prev[source.id] || { newPass: 'postgres', sudoPass: '' }), newPass: e.target.value },
                    }))
                  }
                  placeholder="e.g. postgres"
                  className="w-full px-3 py-1.5 rounded bg-slate-950 border border-amber-700/60 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                disabled={statusReset?.loading || isLoading}
                onClick={() => handleResetPasswordAndAutoConnect(source)}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                {statusReset?.loading || isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Reset Password & Auto-Connect Now
              </button>
            </div>

            {statusReset?.error && <div className="text-rose-400 font-mono text-[11px]">{statusReset.error}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl glass-modal rounded-2xl p-6 shadow-2xl border border-slate-700/50 flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">Select PostgreSQL Source</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshDiscovery}
              disabled={isRefreshingDiscovery}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Rescan Docker socket and local ports for new containers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDiscovery ? 'animate-spin' : ''}`} />
              <span>{isRefreshingDiscovery ? 'Scanning...' : 'Rescan Containers'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 my-4 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('discovered')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              tab === 'discovered'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Auto-Discovered ({dockerSources.length + localSources.length})
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              tab === 'manual'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Connection
          </button>
        </div>

        {generalError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {tab === 'discovered' ? (
            <>
              {/* Docker Sources */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
                  <div className="flex items-center gap-2">
                    <Container className="w-4 h-4" />
                    <span>Docker Containers ({dockerSources.length})</span>
                  </div>

                  <button
                    onClick={onRefreshDiscovery}
                    disabled={isRefreshingDiscovery}
                    className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingDiscovery ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingDiscovery ? 'Scanning...' : 'Scan Now'}</span>
                  </button>
                </div>

                {dockerSources.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-500 text-sm text-center">
                    No running PostgreSQL containers detected via Docker Socket.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dockerSources.map((source) => renderSourceCard(source, true))}
                  </div>
                )}
              </div>

              {/* Local Host Sources */}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
                  <Terminal className="w-4 h-4" />
                  Local System Instances ({localSources.length})
                </div>

                {localSources.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-500 text-sm text-center">
                    No active PostgreSQL service detected on ports 5432, 5433, 5434.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {localSources.map((source) => renderSourceCard(source, false))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleConnectManual} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Host / Address</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Database Name</label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loadingId === 'manual'}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loadingId === 'manual' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Save & Connect to Database
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
