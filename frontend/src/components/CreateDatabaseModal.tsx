import React, { useState } from 'react';
import { X, Database, Plus, AlertTriangle, Check, Globe } from 'lucide-react';
import { executeSql } from '../services/api';

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatabaseCreated: (newDbName: string) => void;
  activeSourceId?: string;
}

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({
  isOpen,
  onClose,
  onDatabaseCreated,
  activeSourceId,
}) => {
  const [dbName, setDbName] = useState('');
  const [encoding, setEncoding] = useState('UTF8');
  const [template, setTemplate] = useState('template1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceId) {
      setError('No active database source connected.');
      return;
    }
    const cleanDbName = dbName.trim();
    if (!cleanDbName) {
      setError('Please enter a Database Name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sql = `CREATE DATABASE "${cleanDbName}" ENCODING '${encoding}' TEMPLATE ${template};`;
      const res = await executeSql(activeSourceId, sql);
      if (res.error) {
        setError(res.error);
      } else {
        onDatabaseCreated(cleanDbName);
        onClose();
        setDbName('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-lg bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between bg-[#161B22]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1F6FEB]/10 border border-[#1F6FEB]/30 text-[#58A6FF]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F6FC]">Create New PostgreSQL Database</h2>
              <p className="text-xs text-[#8B949E]">Visually create a database with encoding & template settings</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#211213] border border-[#F85149]/40 text-[#FF7B72] text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F85149] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Database Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8B949E]">Database Name <span className="text-[#F85149]">*</span></label>
            <input
              type="text"
              required
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="e.g. analytics_db, production_v2"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-sm text-[#C9D1D9] placeholder-[#484F58] focus:outline-none focus:border-[#58A6FF] font-mono font-bold"
            />
          </div>

          {/* Encoding & Template */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8B949E]">Character Encoding</label>
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-xs font-mono text-[#C9D1D9] focus:outline-none focus:border-[#58A6FF]"
              >
                <option value="UTF8">UTF8 (Recommended)</option>
                <option value="LATIN1">LATIN1</option>
                <option value="SQL_ASCII">SQL_ASCII</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8B949E]">Database Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-xs font-mono text-[#C9D1D9] focus:outline-none focus:border-[#58A6FF]"
              >
                <option value="template1">template1 (Default)</option>
                <option value="template0">template0 (Clean)</option>
              </select>
            </div>
          </div>

          {/* SQL Command Preview */}
          <div className="pt-2">
            <label className="text-xs font-semibold text-[#8B949E] block mb-1">Generated DDL Command:</label>
            <div className="p-3 rounded-xl bg-[#0D1117] border border-[#30363D] font-mono text-xs text-[#58A6FF]">
              CREATE DATABASE "{dbName.trim() || 'dbname'}" ENCODING '{encoding}' TEMPLATE {template};
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#30363D] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !dbName.trim()}
              className="px-5 py-2 rounded-xl bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              {loading ? 'Creating...' : 'Create Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
