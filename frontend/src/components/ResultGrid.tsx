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
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface ResultGridProps {
  columns: Array<{ name: string; dataTypeId: number }>;
  rows: any[];
  sourceId?: string;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ columns, rows }) => {
  const [globalFilter, setGlobalFilter] = useState('');

  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    if (columns.length === 0 && rows.length > 0) {
      return Object.keys(rows[0]).map((key) => ({
        accessorKey: key,
        header: key,
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined) {
            return <span className="text-slate-600 italic">null</span>;
          }
          if (typeof val === 'object') {
            return <span className="font-mono text-xs text-amber-400">{JSON.stringify(val)}</span>;
          }
          return String(val);
        },
      }));
    }

    return columns.map((col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info) => {
        const val = info.getValue();
        if (val === null || val === undefined) {
          return <span className="text-slate-600 italic font-mono text-xs">null</span>;
        }
        if (typeof val === 'object') {
          return <span className="font-mono text-xs text-cyan-300">{JSON.stringify(val)}</span>;
        }
        return String(val);
      },
    }));
  }, [columns, rows]);

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
    const headers = columns.map((c) => c.name).join(',');
    const body = rows
      .map((r) => columns.map((c) => JSON.stringify(r[c.name] ?? '')).join(','))
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
      <div className="p-8 text-center text-slate-500 text-sm">
        Statement executed successfully with no returned rows.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Search & Export Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search rows..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCsv}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            CSV
          </button>
          <button
            onClick={exportToJson}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            JSON
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="w-10 px-3 py-2 text-slate-500 font-mono text-[10px] border-r border-slate-800">#</th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-2.5 font-semibold text-slate-300 cursor-pointer hover:bg-slate-800/80 border-r border-slate-800/50 select-none whitespace-nowrap"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' 🔼',
                      desc: ' 🔽',
                    }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {table.getRowModel().rows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2 text-slate-500 font-mono text-[10px] border-r border-slate-800/40 bg-slate-950/40">
                  {idx + 1}
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-xs truncate border-r border-slate-800/20">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 py-1">
        <div>
          Showing page <span className="font-semibold text-slate-200">{table.getState().pagination.pageIndex + 1}</span> of{' '}
          <span className="font-semibold text-slate-200">{table.getPageCount() || 1}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
