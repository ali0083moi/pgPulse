import React, { useState, useMemo } from 'react';
import { X, Zap, Plus, AlertTriangle, Code, Check } from 'lucide-react';
import { SchemaTreeResponse } from '../types';
import { executeSql } from '../services/api';

interface CreateIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIndexCreated: () => void;
  activeSourceId?: string;
  schemaData: SchemaTreeResponse | null;
}

export const CreateIndexModal: React.FC<CreateIndexModalProps> = ({
  isOpen,
  onClose,
  onIndexCreated,
  activeSourceId,
  schemaData,
}) => {
  const [selectedTable, setSelectedTable] = useState('');
  const [indexName, setIndexName] = useState('');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [indexType, setIndexType] = useState('BTREE');
  const [isUnique, setIsUnique] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablesList = schemaData?.tables || [];

  // Active table object
  const currentTableObj = useMemo(() => {
    return tablesList.find((t) => t.name === selectedTable) || tablesList[0];
  }, [tablesList, selectedTable]);

  // Set initial selected table if not set
  useMemo(() => {
    if (!selectedTable && tablesList.length > 0) {
      setSelectedTable(tablesList[0].name);
    }
  }, [tablesList]);

  // Auto-generate index name if user hasn't custom edited it or when column selection changes
  const effectiveIndexName = useMemo(() => {
    if (indexName.trim()) return indexName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const tbl = currentTableObj?.name || 'table';
    const colsPart = selectedCols.length > 0 ? selectedCols.join('_') : 'col';
    return `idx_${tbl}_${colsPart}`.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
  }, [indexName, currentTableObj, selectedCols]);

  const generatedSql = useMemo(() => {
    const tblName = currentTableObj?.name || '';
    if (!tblName || selectedCols.length === 0) {
      return '-- Select a table and at least one column to generate CREATE INDEX DDL';
    }

    const uniqueStr = isUnique ? 'UNIQUE ' : '';
    const colsStr = selectedCols.map((c) => `"${c}"`).join(', ');
    return `CREATE ${uniqueStr}INDEX "${effectiveIndexName}" ON public."${tblName}" USING ${indexType} (${colsStr});`;
  }, [currentTableObj, selectedCols, effectiveIndexName, indexType, isUnique]);

  const handleToggleColumn = (colName: string) => {
    if (selectedCols.includes(colName)) {
      setSelectedCols(selectedCols.filter((c) => c !== colName));
    } else {
      setSelectedCols([...selectedCols, colName]);
    }
  };

  const handleCreateIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceId) {
      setError('No active database source connected.');
      return;
    }
    if (selectedCols.length === 0) {
      setError('Please select at least one column to index.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await executeSql(activeSourceId, generatedSql);
      if (res.error) {
        setError(res.error);
      } else {
        onIndexCreated();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create index');
    } finally {
      setLoading(false);
    }
  };

  // Rule of Hooks: Early return MUST occur after all hooks (useState, useMemo) are declared!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Zap className="w-5 h-5 fill-amber-400/20" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Visually Create PostgreSQL Index</h2>
              <p className="text-xs text-slate-400">Boost query performance with B-Tree, Hash, GIN, or GiST indexes</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleCreateIndex} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Target Table */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Table <span className="text-rose-400">*</span></label>
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setSelectedCols([]);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono font-bold"
            >
              {tablesList.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.columns.length} columns)
                </option>
              ))}
            </select>
          </div>

          {/* Index Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Index Name (Auto-suggested)</label>
            <input
              type="text"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              placeholder={effectiveIndexName}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Select Columns */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Select Columns to Index <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-amber-400 font-mono">{selectedCols.length} selected</span>
            </label>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-44 overflow-y-auto space-y-1.5">
              {currentTableObj?.columns.map((col) => {
                const isChecked = selectedCols.includes(col.name);
                return (
                  <label
                    key={col.name}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleColumn(col.name)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{col.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                        {col.type}
                      </span>
                      {col.isPrimaryKey && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                          PK
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Index Options (Method & Unique) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Index Method</label>
              <select
                value={indexType}
                onChange={(e) => setIndexType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="BTREE">B-Tree (Default & Fast General)</option>
                <option value="HASH">HASH (Equality checks)</option>
                <option value="GIN">GIN (JSONB & Full-Text)</option>
                <option value="GIST">GiST (Geometric & Range data)</option>
              </select>
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUnique}
                  onChange={(e) => setIsUnique(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span>Unique Index (`UNIQUE`)</span>
              </label>
            </div>
          </div>

          {/* DDL Preview */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Code className="w-3.5 h-3.5 text-amber-400" />
              <span>Generated SQL DDL Preview:</span>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-amber-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
              {generatedSql}
            </pre>
          </div>
        </form>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateIndex}
            disabled={loading || selectedCols.length === 0}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            {loading ? 'Creating Index...' : 'Create Index'}
          </button>
        </div>
      </div>
    </div>
  );
};
