import React, { useState, useMemo } from 'react';
import { X, Table, Plus, Trash2, Key, Check, AlertTriangle, Code, Link as LinkIcon } from 'lucide-react';
import { SchemaTreeResponse } from '../types';
import { executeSql } from '../services/api';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTableCreated: () => void;
  activeSourceId?: string;
  schemaData: SchemaTreeResponse | null;
}

interface ColumnDef {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  defaultValue: string;
}

interface ForeignKeyDef {
  id: string;
  columnName: string;
  refTable: string;
  refColumn: string;
  onDelete: string;
}

const DATA_TYPES = [
  'SERIAL',
  'BIGSERIAL',
  'INTEGER',
  'BIGINT',
  'VARCHAR(255)',
  'TEXT',
  'NUMERIC(10,2)',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'UUID',
  'JSONB',
];

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onTableCreated,
  activeSourceId,
  schemaData,
}) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: '1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNotNull: true, isUnique: false, defaultValue: '' },
    { id: '2', name: 'created_at', type: 'TIMESTAMP', isPrimaryKey: false, isNotNull: false, isUnique: false, defaultValue: 'CURRENT_TIMESTAMP' },
  ]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablesList = schemaData?.tables || [];

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      {
        id: Math.random().toString(),
        name: `column_${columns.length + 1}`,
        type: 'VARCHAR(255)',
        isPrimaryKey: false,
        isNotNull: false,
        isUnique: false,
        defaultValue: '',
      },
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(columns.filter((c) => c.id !== id));
  };

  const handleUpdateColumn = (id: string, field: keyof ColumnDef, val: any) => {
    setColumns(
      columns.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: val };
        if (field === 'type' && (val === 'SERIAL' || val === 'BIGSERIAL')) {
          updated.isPrimaryKey = true;
          updated.isNotNull = true;
        }
        return updated;
      })
    );
  };

  const handleAddForeignKey = () => {
    const firstTbl = tablesList[0];
    const firstCol = firstTbl?.columns?.[0]?.name || '';
    setForeignKeys([
      ...foreignKeys,
      {
        id: Math.random().toString(),
        columnName: columns[0]?.name || '',
        refTable: firstTbl?.name || '',
        refColumn: firstCol,
        onDelete: 'CASCADE',
      },
    ]);
  };

  const handleRemoveForeignKey = (id: string) => {
    setForeignKeys(foreignKeys.filter((fk) => fk.id !== id));
  };

  // Generate live DDL query safely - MUST be called unconditionally before early returns!
  const generatedSql = useMemo(() => {
    const cleanTableName = (tableName || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanTableName || columns.length === 0) {
      return '-- Enter table name and add at least one column';
    }

    const colLines: string[] = [];
    const pkCols: string[] = [];

    columns.forEach((c) => {
      const cleanColName = (c?.name || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
      if (!cleanColName) return;

      const colType = c?.type || 'VARCHAR(255)';
      let line = `  "${cleanColName}" ${colType}`;
      if (c?.isPrimaryKey && !colType.includes('SERIAL')) {
        pkCols.push(`"${cleanColName}"`);
      } else if (c?.isPrimaryKey && colType.includes('SERIAL')) {
        line += ' PRIMARY KEY';
      }

      if (c?.isNotNull && !line.includes('PRIMARY KEY')) line += ' NOT NULL';
      if (c?.isUnique) line += ' UNIQUE';

      const defVal = (c?.defaultValue || '').trim();
      if (defVal) line += ` DEFAULT ${defVal}`;

      colLines.push(line);
    });

    if (pkCols.length > 0) {
      colLines.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
    }

    foreignKeys.forEach((fk) => {
      const colName = (fk?.columnName || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
      const refTbl = (fk?.refTable || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
      const refCol = (fk?.refColumn || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
      if (colName && refTbl && refCol) {
        colLines.push(`  CONSTRAINT "fk_${cleanTableName}_${colName}" FOREIGN KEY ("${colName}") REFERENCES "${refTbl}"("${refCol}") ON DELETE ${fk.onDelete || 'CASCADE'}`);
      }
    });

    return `CREATE TABLE public."${cleanTableName}" (\n${colLines.join(',\n')}\n);`;
  }, [tableName, columns, foreignKeys]);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceId) {
      setError('No active database source connected.');
      return;
    }
    if (!(tableName || '').trim()) {
      setError('Please enter a Table Name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await executeSql(activeSourceId, generatedSql);
      if (res.error) {
        setError(res.error);
      } else {
        onTableCreated();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create table');
    } finally {
      setLoading(false);
    }
  };

  // Rule of Hooks: Early return MUST occur after all hooks (useState, useMemo) are declared!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Visually Create New PostgreSQL Table</h2>
              <p className="text-xs text-slate-400">Define table structure, data types, primary keys & foreign keys</p>
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
        <form onSubmit={handleCreateTable} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Table Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Table Name <span className="text-rose-400">*</span></label>
            <input
              type="text"
              required
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. customers, orders, invoices"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono font-bold"
            />
          </div>

          {/* Columns Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Columns</span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Column
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {columns.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                  <input
                    type="text"
                    required
                    value={c.name}
                    onChange={(e) => handleUpdateColumn(c.id, 'name', e.target.value)}
                    placeholder="column_name"
                    className="w-36 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />

                  <select
                    value={c.type}
                    onChange={(e) => handleUpdateColumn(c.id, 'type', e.target.value)}
                    className="w-36 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {DATA_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer select-none px-1">
                    <input
                      type="checkbox"
                      checked={!!c.isPrimaryKey}
                      onChange={(e) => handleUpdateColumn(c.id, 'isPrimaryKey', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <Key className="w-3 h-3 text-amber-400" />
                    PK
                  </label>

                  <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer select-none px-1">
                    <input
                      type="checkbox"
                      checked={!!c.isNotNull}
                      onChange={(e) => handleUpdateColumn(c.id, 'isNotNull', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    NN
                  </label>

                  <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer select-none px-1">
                    <input
                      type="checkbox"
                      checked={!!c.isUnique}
                      onChange={(e) => handleUpdateColumn(c.id, 'isUnique', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    UQ
                  </label>

                  <input
                    type="text"
                    value={c.defaultValue || ''}
                    onChange={(e) => handleUpdateColumn(c.id, 'defaultValue', e.target.value)}
                    placeholder="Default val"
                    className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />

                  {columns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(c.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Foreign Keys Section */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                Foreign Key Relationships (Optional)
              </span>
              <button
                type="button"
                onClick={handleAddForeignKey}
                disabled={tablesList.length === 0}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add FK Constraint
              </button>
            </div>

            {tablesList.length === 0 && foreignKeys.length === 0 && (
              <p className="text-[11px] text-slate-500 italic">No existing tables in this schema to reference for Foreign Keys.</p>
            )}

            {foreignKeys.map((fk) => {
              const selectedTblObj = tablesList.find((t) => t.name === fk.refTable);
              const selectedTblCols = selectedTblObj?.columns || [];

              return (
                <div key={fk.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                  <select
                    value={fk.columnName || ''}
                    onChange={(e) =>
                      setForeignKeys(foreignKeys.map((item) => (item.id === fk.id ? { ...item, columnName: e.target.value } : item)))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs focus:outline-none"
                  >
                    {columns.length === 0 && <option value="">No Columns</option>}
                    {columns.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-500 font-bold">➔</span>

                  <select
                    value={fk.refTable || ''}
                    onChange={(e) => {
                      const newTbl = e.target.value;
                      const matchedTbl = tablesList.find((t) => t.name === newTbl);
                      setForeignKeys(
                        foreignKeys.map((item) =>
                          item.id === fk.id
                            ? { ...item, refTable: newTbl, refColumn: matchedTbl?.columns?.[0]?.name || '' }
                            : item
                        )
                      );
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs focus:outline-none"
                  >
                    {tablesList.length === 0 && <option value="">No Tables</option>}
                    {tablesList.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={fk.refColumn || ''}
                    onChange={(e) =>
                      setForeignKeys(foreignKeys.map((item) => (item.id === fk.id ? { ...item, refColumn: e.target.value } : item)))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300 font-mono text-xs focus:outline-none"
                  >
                    {selectedTblCols.length === 0 && <option value="">No Columns</option>}
                    {selectedTblCols.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={fk.onDelete || 'CASCADE'}
                    onChange={(e) =>
                      setForeignKeys(foreignKeys.map((item) => (item.id === fk.id ? { ...item, onDelete: e.target.value } : item)))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none ml-auto"
                  >
                    <option value="CASCADE">ON DELETE CASCADE</option>
                    <option value="SET NULL">ON DELETE SET NULL</option>
                    <option value="RESTRICT">ON DELETE RESTRICT</option>
                    <option value="NO ACTION">ON DELETE NO ACTION</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveForeignKey(fk.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* DDL Preview */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span>Generated SQL DDL Preview:</span>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-cyan-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-36">
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
            onClick={handleCreateTable}
            disabled={loading || !(tableName || '').trim()}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            {loading ? 'Creating...' : 'Create Table'}
          </button>
        </div>
      </div>
    </div>
  );
};
