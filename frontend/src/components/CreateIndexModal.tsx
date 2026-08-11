import React, { useState, useMemo } from 'react';
import { X, Zap, Plus, AlertTriangle, Check, Code, Layers } from 'lucide-react';
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
  const tablesList = schemaData?.tables || [];

  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [indexType, setIndexType] = useState<string>('BTREE');
  const [isUnique, setIsUnique] = useState<boolean>(false);
  const [customIndexName, setCustomIndexName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Default table selection
  const currentTable = useMemo(() => {
    if (!selectedTable && tablesList.length > 0) {
      return tablesList[0];
    }
    return tablesList.find((t) => t.name === selectedTable) || tablesList[0] || null;
  }, [selectedTable, tablesList]);

  // Suggested Index Name
  const suggestedIndexName = useMemo(() => {
    if (customIndexName.trim()) return customIndexName.trim();
    const tblName = currentTable?.name || 'table';
    const colsStr = selectedColumns.length > 0 ? selectedColumns.join('_') : 'col';
    return `idx_${tblName}_${colsStr}`;
  }, [customIndexName, currentTable, selectedColumns]);

  // Live DDL preview
  const generatedSql = useMemo(() => {
    if (!currentTable || selectedColumns.length === 0) {
      return '-- Select a table and at least one column to build index SQL DDL';
    }

    const uniqueClause = isUnique ? 'UNIQUE ' : '';
    const colsList = selectedColumns.map((c) => `"${c}"`).join(', ');

    return `CREATE ${uniqueClause}INDEX "${suggestedIndexName}"\nON public."${currentTable.name}" USING ${indexType} (${colsList});`;
  }, [currentTable, selectedColumns, isUnique, indexType, suggestedIndexName]);

  if (!isOpen) return null;

  const handleToggleColumn = (colName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceId) {
      setError('No active database source connected.');
      return;
    }
    if (!currentTable || selectedColumns.length === 0) {
      setError('Select a table and at least one column.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-xl bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between bg-[#161B22]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1F6FEB]/10 border border-[#1F6FEB]/30 text-[#58A6FF]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F6FC]">Visual Index Creator</h2>
              <p className="text-xs text-[#8B949E]">Optimize PostgreSQL query performance with BTREE, GIN, GIST, or HASH indexes</p>
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

          {/* Table Selector & Index Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8B949E]">Target Table</label>
              <select
                value={currentTable?.name || ''}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setSelectedColumns([]);
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-xs font-mono text-[#58A6FF] font-bold focus:outline-none focus:border-[#58A6FF]"
              >
                {tablesList.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.columns.length} cols)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8B949E]">Index Name</label>
              <input
                type="text"
                value={customIndexName}
                onChange={(e) => setCustomIndexName(e.target.value)}
                placeholder={suggestedIndexName}
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-xs font-mono text-[#C9D1D9] focus:outline-none focus:border-[#58A6FF]"
              />
            </div>
          </div>

          {/* Columns Selection Chips */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-[#8B949E] flex items-center justify-between">
              <span>Select Columns to Index:</span>
              <span className="text-[11px] text-[#58A6FF] font-mono">{selectedColumns.length} selected</span>
            </label>
            <div className="p-3 rounded-xl bg-[#0D1117] border border-[#30363D] flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {currentTable?.columns.map((col) => {
                const isSelected = selectedColumns.includes(col.name);
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => handleToggleColumn(col.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1F6FEB] border-[#1F6FEB] text-white shadow-sm'
                        : 'bg-[#161B22] border-[#30363D] text-[#C9D1D9] hover:border-[#8B949E]'
                    }`}
                  >
                    {col.name} <span className="text-[10px] text-[#8B949E]">({col.type})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method & Unique Options */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8B949E]">Index Method</label>
              <select
                value={indexType}
                onChange={(e) => setIndexType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0D1117] border border-[#30363D] text-xs font-mono text-[#C9D1D9] focus:outline-none focus:border-[#58A6FF]"
              >
                <option value="BTREE">BTREE (Default - B-Tree)</option>
                <option value="HASH">HASH (Equality matches)</option>
                <option value="GIN">GIN (Generalized Inverted Index / JSONB)</option>
                <option value="GIST">GIST (Generalized Search Tree)</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-xs text-[#C9D1D9] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUnique}
                  onChange={(e) => setIsUnique(e.target.checked)}
                  className="rounded border-[#30363D] bg-[#0D1117] text-[#1F6FEB] focus:ring-0"
                />
                Enforce UNIQUE Constraint
              </label>
            </div>
          </div>

          {/* DDL Preview */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8B949E]">
              <Code className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span>Index SQL DDL Preview:</span>
            </div>
            <pre className="p-3 rounded-xl bg-[#0D1117] border border-[#30363D] text-[#58A6FF] font-mono text-xs overflow-x-auto whitespace-pre-wrap">
              {generatedSql}
            </pre>
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
              disabled={loading || selectedColumns.length === 0}
              className="px-5 py-2 rounded-xl bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              {loading ? 'Creating Index...' : 'Create Index'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
