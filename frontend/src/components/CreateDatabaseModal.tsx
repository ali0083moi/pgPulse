import React, { useState } from 'react';
import { X, Database, Plus, Check, AlertTriangle, Code } from 'lucide-react';
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
  const [owner, setOwner] = useState('postgres');
  const [encoding, setEncoding] = useState('UTF8');
  const [connLimit, setConnLimit] = useState('-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sanitizedDbName = dbName.trim().replace(/[^a-zA-Z0-9_]/g, '');
  const sanitizedOwner = owner.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'postgres';

  const generatedSql = sanitizedDbName
    ? `CREATE DATABASE "${sanitizedDbName}" WITH OWNER = "${sanitizedOwner}" ENCODING = '${encoding}' CONNECTION LIMIT = ${connLimit || -1};`
    : '-- Fill in Database Name to see generated DDL';

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceId) {
      setError('No active database source connected.');
      return;
    }
    if (!sanitizedDbName) {
      setError('Please enter a valid Database Name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await executeSql(activeSourceId, generatedSql);
      if (res.error) {
        setError(res.error);
      } else {
        onDatabaseCreated(sanitizedDbName);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Create New PostgreSQL Database</h2>
              <p className="text-xs text-slate-400">Visually configure and create a database</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateDatabase} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Database Name <span className="text-rose-400">*</span></label>
            <input
              type="text"
              required
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="e.g. ecommerce_v2_db"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Owner Role</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="postgres"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Encoding</label>
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="UTF8">UTF8 (Recommended)</option>
                <option value="LATIN1">LATIN1</option>
                <option value="SQL_ASCII">SQL_ASCII</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Connection Limit</label>
            <input
              type="number"
              value={connLimit}
              onChange={(e) => setConnLimit(e.target.value)}
              placeholder="-1 for unlimited"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* DDL Preview */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span>Generated DDL Preview:</span>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-cyan-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
              {generatedSql}
            </pre>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !sanitizedDbName}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
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
