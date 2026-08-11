import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit2, Save, Trash2, AlertTriangle, RefreshCw, X, ChevronUp, ChevronDown } from 'lucide-react';
import { executeSql } from '../services/api';

interface ResultGridProps {
  columns: Array<{ name: string; dataTypeId: number }>;
  rows: any[];
  sourceId?: string;
  onRefreshData?: () => void;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ columns, rows, sourceId, onRefreshData }) => {
  const [globalFilter, setGlobalFilter] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedRows, setEditedRows] = useState<Record<number, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  const handleCellEdit = (rowIndex: number, colName: string, value: any) => {
    setEditedRows((prev) => {
      const rowEdits = prev[rowIndex] || {};
      return {
        ...prev,
        [rowIndex]: {
          ...rowEdits,
          [colName]: value,
        },
      };
    });
  };

  const handleSaveEdits = async () => {
    if (!sourceId) {
      setGridError('No active database source connected.');
      return;
    }
    setSaving(true);
    setGridError(null);

    try {
      const pkCol = columns.find((c) => c.name.toLowerCase() === 'id' || c.name.toLowerCase().includes('id'))?.name || columns[0]?.name;

      for (const [rowIndexStr, changes] of Object.entries(editedRows)) {
        const rowIndex = Number(rowIndexStr);
        const originalRow = rows[rowIndex];
        if (!originalRow || !pkCol) continue;

        const setStatements: string[] = [];
        for (const [col, val] of Object.entries(changes)) {
          if (val === null || val === undefined) {
            setStatements.push(`"${col}" = NULL`);
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            setStatements.push(`"${col}" = ${val}`);
          } else {
            setStatements.push(`"${col}" = '${String(val).replace(/'/g, "''")}'`);
          }
        }

        if (setStatements.length > 0 && originalRow[pkCol] !== undefined) {
          const pkVal = originalRow[pkCol];
          const pkWhere = typeof pkVal === 'number' ? `"${pkCol}" = ${pkVal}` : `"${pkCol}" = '${String(pkVal).replace(/'/g, "''")}'`;
          
          const updateSql = `UPDATE public."${originalRow.table_name || 'users'}" SET ${setStatements.join(', ')} WHERE ${pkWhere};`;
          await executeSql(sourceId, updateSql);
        }
      }

      setEditedRows({});
      setIsEditing(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setGridError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (rowObj: any) => {
    if (!sourceId) return;
    const pkCol = columns.find((c) => c.name.toLowerCase() === 'id' || c.name.toLowerCase().includes('id'))?.name || columns[0]?.name;
    if (!pkCol || rowObj[pkCol] === undefined) {
      alert('Cannot delete row: No primary key column ("id") found.');
      return;
    }

    const pkVal = rowObj[pkCol];
    if (!window.confirm(`Are you sure you want to delete row with ${pkCol} = ${pkVal}?`)) return;

    try {
      const pkWhere = typeof pkVal === 'number' ? `"${pkCol}" = ${pkVal}` : `"${pkCol}" = '${String(pkVal).replace(/'/g, "''")}'`;
      const deleteSql = `DELETE FROM public."${rowObj.table_name || 'users'}" WHERE ${pkWhere};`;
      const res = await executeSql(sourceId, deleteSql);

      if (res.error) {
        setGridError(res.error);
      } else if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      setGridError(err.message || 'Failed to delete row');
    }
  };

  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    const cols = columns.length > 0 ? columns : Object.keys(rows[0] || {}).map((k) => ({ name: k, dataTypeId: 0 }));

    return cols.map((col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info) => {
        const rowIndex = info.row.index;
        const colName = col.name;
        const isEdited = editedRows[rowIndex] && editedRows[rowIndex][colName] !== undefined;
        const displayVal = isEdited ? editedRows[rowIndex][colName] : info.getValue();

        if (isEditing) {
          return (
            <input
              type="text"
              value={displayVal === null || displayVal === undefined ? '' : String(displayVal)}
              onChange={(e) => handleCellEdit(rowIndex, colName, e.target.value)}
              className={`w-full px-2 py-0.5 rounded bg-[#0D1117] border text-xs font-mono focus:outline-none ${
                isEdited ? 'border-[#D29922] text-[#E3B341] bg-[#D29922]/10' : 'border-[#30363D] text-[#C9D1D9] focus:border-[#58A6FF]'
              }`}
            />
          );
        }

        if (displayVal === null || displayVal === undefined) {
          return <span className="text-[#8B949E] italic font-mono text-xs">null</span>;
        }
        if (typeof displayVal === 'object') {
          return <span className="font-mono text-xs text-[#58A6FF]">{JSON.stringify(displayVal)}</span>;
        }
        return String(displayVal);
      },
    }));
  }, [columns, rows, isEditing, editedRows]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const exportToJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rows, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `query_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportToCsv = () => {
    if (!rows.length) return;
    const colList = columns.length > 0 ? columns.map((c) => c.name) : Object.keys(rows[0] || {});
    const headers = colList.join(',');
    const body = rows
      .map((r) => colList.map((c) => JSON.stringify(r[c] ?? '')).join(','))
      .join('\n');
    const csvStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(`${headers}\n${body}`);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvStr);
    downloadAnchor.setAttribute('download', `query_export_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-[#8B949E] text-sm">
        Statement executed successfully with no returned rows.
      </div>
    );
  }

  const hasEdits = Object.keys(editedRows).length > 0;

  return (
    <div className="flex flex-col h-full space-y-2">
      {gridError && (
        <div className="p-2.5 rounded-lg bg-[#211213] border border-[#F85149]/40 text-[#FF7B72] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F85149] shrink-0" />
            <span>{gridError}</span>
          </div>
          <button onClick={() => setGridError(null)} className="text-[#8B949E] hover:text-[#C9D1D9]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Export Toolbar & Inline Edit Controls */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#8B949E] absolute left-3 top-2.5" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search rows..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] text-xs focus:outline-none focus:border-[#58A6FF]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Inline Edit Mode Toggle */}
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              if (isEditing) setEditedRows({});
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isEditing
                ? 'bg-[#D29922]/20 border-[#D29922]/50 text-[#E3B341]'
                : 'bg-[#21262D] border-[#30363D] text-[#C9D1D9] hover:bg-[#30363D]'
            }`}
            title="Toggle inline cell editing mode"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#D29922]" />
            <span>{isEditing ? 'Cancel Edit' : 'Edit Mode'}</span>
          </button>

          {/* Save Changes Button */}
          {hasEdits && (
            <button
              onClick={handleSaveEdits}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2EA043] text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save ({Object.keys(editedRows).length})</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-[#30363D] mx-1" />

          <button
            onClick={exportToCsv}
            className="px-3 py-1.5 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#C9D1D9] hover:text-[#58A6FF] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export query results to CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#58A6FF]" />
            CSV
          </button>
          <button
            onClick={exportToJson}
            className="px-3 py-1.5 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#C9D1D9] hover:text-[#3FB950] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export query results to JSON"
          >
            <Download className="w-3.5 h-3.5 text-[#3FB950]" />
            JSON
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-[#30363D] bg-[#0D1117]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#161B22] sticky top-0 z-10 border-b border-[#30363D]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="w-12 px-3 py-2 text-[#8B949E] font-mono text-[10px] border-r border-[#30363D]">#</th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-2 font-semibold text-[#8B949E] hover:text-[#C9D1D9] cursor-pointer hover:bg-[#21262D] border-r border-[#30363D]/60 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3.5 h-3.5 text-[#58A6FF]" />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3.5 h-3.5 text-[#58A6FF]" />}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-2 py-2 text-center text-[#8B949E] font-mono text-[10px]">Action</th>
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#30363D]/60 font-mono">
            {table.getRowModel().rows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-[#161B22] transition-colors group">
                <td className="px-3 py-2 text-[#8B949E] font-mono text-[10px] border-r border-[#30363D]/50 bg-[#161B22]/40">
                  {idx + 1}
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-[#C9D1D9] whitespace-nowrap max-w-xs truncate border-r border-[#30363D]/30">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => handleDeleteRow(row.original)}
                    className="p-1 rounded text-[#8B949E] hover:text-[#F85149] hover:bg-[#21262D] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Delete row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between text-xs text-[#8B949E] py-1 shrink-0">
        <div>
          Page <span className="font-semibold text-[#C9D1D9]">{table.getState().pagination.pageIndex + 1}</span> of{' '}
          <span className="font-semibold text-[#C9D1D9]">{table.getPageCount() || 1}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded bg-[#21262D] hover:bg-[#30363D] disabled:opacity-30 border border-[#30363D] text-[#C9D1D9] cursor-pointer"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded bg-[#21262D] hover:bg-[#30363D] disabled:opacity-30 border border-[#30363D] text-[#C9D1D9] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded bg-[#21262D] hover:bg-[#30363D] disabled:opacity-30 border border-[#30363D] text-[#C9D1D9] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded bg-[#21262D] hover:bg-[#30363D] disabled:opacity-30 border border-[#30363D] text-[#C9D1D9] cursor-pointer"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
