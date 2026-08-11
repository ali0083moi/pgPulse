import React, { useState, useEffect } from 'react';
import { X, Activity, RefreshCw, AlertTriangle, Play, Skull, CheckCircle2, ShieldAlert } from 'lucide-react';
import { executeSql } from '../services/api';

interface DbActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSourceId?: string;
}

interface ProcessInfo {
  pid: number;
  usename: string;
  datname: string;
  client_addr: string;
  state: string;
  query: string;
  duration_seconds: number;
}

export const DbActivityModal: React.FC<DbActivityModalProps> = ({
  isOpen,
  onClose,
  activeSourceId,
}) => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchProcesses = async () => {
    if (!activeSourceId) return;
    setLoading(true);
    setError(null);

    const query = `
      SELECT 
        pid,
        usename::text,
        datname::text,
        COALESCE(client_addr::text, 'local') AS client_addr,
        state::text,
        query::text,
        ROUND(COALESCE(extract(epoch from (clock_timestamp() - query_start)), 0)::numeric, 2) AS duration_seconds
      FROM pg_stat_activity
      WHERE state IS NOT NULL AND pid != pg_backend_pid()
      ORDER BY duration_seconds DESC;
    `;

    try {
      const res = await executeSql(activeSourceId, query);
      if (res.error) {
        setError(res.error);
      } else {
        const procList: ProcessInfo[] = (res.rows || []).map((r: any) => ({
          pid: Number(r.pid),
          usename: r.usename || 'postgres',
          datname: r.datname || 'postgres',
          client_addr: r.client_addr || 'local',
          state: r.state || 'active',
          query: r.query || '',
          duration_seconds: Number(r.duration_seconds || 0),
        }));
        setProcesses(procList);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch DB processes');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateProcess = async (pid: number) => {
    if (!activeSourceId) return;
    if (!window.confirm(`Are you sure you want to terminate PostgreSQL process PID ${pid}?`)) return;

    setTerminatingPid(pid);
    try {
      const res = await executeSql(activeSourceId, `SELECT pg_terminate_backend(${pid});`);
      if (res.error) {
        setError(`Failed to terminate PID ${pid}: ${res.error}`);
      } else {
        fetchProcesses();
      }
    } catch (err: any) {
      setError(`Failed to terminate PID ${pid}: ${err.message}`);
    } finally {
      setTerminatingPid(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProcesses();
    }
  }, [isOpen, activeSourceId]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchProcesses();
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, activeSourceId]);

  // Rule of Hooks: Early return MUST occur after all hooks are declared!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">PostgreSQL Live Activity & Process Killer</h2>
              <p className="text-xs text-slate-400">Monitor running queries, locks, and kill hanging processes (`pg_stat_activity`)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0"
              />
              <span>Auto-Refresh (5s)</span>
            </label>

            <button
              onClick={fetchProcesses}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Refresh Processes"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {processes.length === 0 && !loading ? (
            <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-200">Database is running smoothly!</p>
              <p className="text-xs text-slate-500">No active processes or long-running queries detected.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5 font-mono">PID</th>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Database</th>
                    <th className="px-3 py-2.5">State</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Active SQL Query</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {processes.map((proc) => {
                    const isSlow = proc.duration_seconds > 5;

                    return (
                      <tr key={proc.pid} className={`hover:bg-slate-800/40 transition-colors ${isSlow ? 'bg-rose-950/20' : ''}`}>
                        <td className="px-3 py-2 text-cyan-400 font-bold">{proc.pid}</td>
                        <td className="px-3 py-2 text-slate-200">{proc.usename}</td>
                        <td className="px-3 py-2 text-slate-300">{proc.datname}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              proc.state === 'active'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {proc.state}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-bold ${isSlow ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                            {proc.duration_seconds}s
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 max-w-xs truncate" title={proc.query}>
                          {proc.query}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleTerminateProcess(proc.pid)}
                            disabled={terminatingPid === proc.pid}
                            className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-[11px] font-bold flex items-center gap-1 ml-auto transition-all cursor-pointer"
                            title="Kill backend process (pg_terminate_backend)"
                          >
                            <Skull className="w-3.5 h-3.5" />
                            <span>Kill</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Total Active Processes: <strong className="text-slate-200">{processes.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
