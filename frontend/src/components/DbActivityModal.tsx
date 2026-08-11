import React, { useState, useEffect } from 'react';
import { X, Activity, RefreshCw, Trash2, AlertTriangle, ShieldAlert, Clock, CheckCircle } from 'lucide-react';
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
  duration_seconds: number;
  query: string;
}

export const DbActivityModal: React.FC<DbActivityModalProps> = ({
  isOpen,
  onClose,
  activeSourceId,
}) => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchProcesses = async () => {
    if (!activeSourceId) return;
    setLoading(true);
    setError(null);

    const sql = `
      SELECT 
        pid,
        usename,
        datname,
        COALESCE(client_addr::text, 'local') AS client_addr,
        state,
        ROUND(extract(epoch from (clock_timestamp() - query_start))::numeric, 2) AS duration_seconds,
        query
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND state IS NOT NULL
        AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration_seconds DESC NULLS LAST;
    `;

    try {
      const res = await executeSql(activeSourceId, sql);
      if (res.error) {
        setError(res.error);
      } else {
        setProcesses(res.rows || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch process activity');
    } finally {
      setLoading(false);
    }
  };

  const handleKillProcess = async (pid: number) => {
    if (!activeSourceId) return;
    if (!window.confirm(`Are you sure you want to terminate process PID ${pid}?`)) return;

    setKillingPid(pid);
    try {
      const killSql = `SELECT pg_terminate_backend(${pid});`;
      const res = await executeSql(activeSourceId, killSql);
      if (res.error) {
        alert(`Failed to kill process: ${res.error}`);
      } else {
        await fetchProcesses();
      }
    } catch (err: any) {
      alert(`Error terminating process: ${err.message}`);
    } finally {
      setKillingPid(null);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-4xl bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between bg-[#161B22] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#F85149]/10 border border-[#F85149]/30 text-[#F85149]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F6FC]">Live Database Activity & Process Killer</h2>
              <p className="text-xs text-[#8B949E]">Monitor active queries (`pg_stat_activity`) and terminate hanging processes</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[#8B949E] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-[#30363D] bg-[#0D1117] text-[#1F6FEB] focus:ring-0"
              />
              Auto-refresh (5s)
            </label>

            <button
              onClick={fetchProcesses}
              disabled={loading}
              className="p-1.5 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#58A6FF] transition-colors cursor-pointer"
              title="Refresh process list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Process Table Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#211213] border border-[#F85149]/40 text-[#FF7B72] text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F85149] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {processes.length === 0 ? (
            <div className="p-8 text-center text-[#8B949E] text-xs font-medium bg-[#0D1117] rounded-xl border border-[#30363D]">
              No active user queries running in `pg_stat_activity` right now.
            </div>
          ) : (
            <div className="rounded-xl border border-[#30363D] overflow-hidden bg-[#0D1117]">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="bg-[#161B22] border-b border-[#30363D] text-[#8B949E] text-[11px]">
                  <tr>
                    <th className="px-3 py-2 border-r border-[#30363D]">PID</th>
                    <th className="px-3 py-2 border-r border-[#30363D]">User</th>
                    <th className="px-3 py-2 border-r border-[#30363D]">Database</th>
                    <th className="px-3 py-2 border-r border-[#30363D]">State</th>
                    <th className="px-3 py-2 border-r border-[#30363D]">Duration</th>
                    <th className="px-3 py-2 border-r border-[#30363D]">Query Statement</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]">
                  {processes.map((proc) => {
                    const isSlow = proc.duration_seconds > 5;
                    return (
                      <tr key={proc.pid} className="hover:bg-[#161B22] transition-colors">
                        <td className="px-3 py-2 text-[#58A6FF] font-bold border-r border-[#30363D]">{proc.pid}</td>
                        <td className="px-3 py-2 text-[#C9D1D9] border-r border-[#30363D]">{proc.usename || 'postgres'}</td>
                        <td className="px-3 py-2 text-[#C9D1D9] border-r border-[#30363D]">{proc.datname}</td>
                        <td className="px-3 py-2 border-r border-[#30363D]">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              proc.state === 'active'
                                ? 'bg-[#3FB950]/15 text-[#3FB950] border border-[#3FB950]/30'
                                : 'bg-[#21262D] text-[#8B949E]'
                            }`}
                          >
                            {proc.state}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-r border-[#30363D]">
                          <span className={`flex items-center gap-1 ${isSlow ? 'text-[#F85149] font-bold' : 'text-[#C9D1D9]'}`}>
                            <Clock className="w-3 h-3" />
                            {proc.duration_seconds || 0}s
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#C9D1D9] max-w-xs truncate border-r border-[#30363D]" title={proc.query}>
                          {proc.query}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleKillProcess(proc.pid)}
                            disabled={killingPid === proc.pid}
                            className="px-2 py-1 rounded bg-[#211213] hover:bg-[#F85149] text-[#F85149] hover:text-white font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer mx-auto"
                            title="Kill backend process"
                          >
                            <Trash2 className="w-3 h-3" />
                            Kill
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
      </div>
    </div>
  );
};
