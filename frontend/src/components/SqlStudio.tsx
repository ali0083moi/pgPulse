import React, { useState, useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Play, Sparkles, Trash2, Clock, CheckCircle, AlertTriangle, Table as TableIcon, BarChart2 } from 'lucide-react';
import { DiscoveredSource, QueryResultPayload, SchemaTreeResponse } from '../types';
import { executeSql } from '../services/api';
import { ResultGrid } from './ResultGrid';
import { DataChart } from './DataChart';

interface SqlStudioProps {
  activeSource: DiscoveredSource | null;
  schemaData: SchemaTreeResponse | null;
}

export const SqlStudio: React.FC<SqlStudioProps> = ({ activeSource, schemaData }) => {
  const [sql, setSql] = useState<string>('-- Write your SQL query here\nSELECT * FROM information_schema.tables LIMIT 20;');
  const [result, setResult] = useState<QueryResultPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'chart'>('grid');
  const monaco = useMonaco();

  // Register SQL completion provider
  useEffect(() => {
    if (!monaco || !schemaData) return;

    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'UPDATE',
      'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'UNION ALL', 'VALUES'
    ];

    const provider = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];

        // Add SQL Keywords
        keywords.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        });

        // Add Tables
        schemaData.tables.forEach((tbl) => {
          suggestions.push({
            label: tbl.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: tbl.name,
            detail: `Table (${tbl.schema})`,
            range,
          });

          // Add Columns
          tbl.columns.forEach((col) => {
            suggestions.push({
              label: `${tbl.name}.${col.name}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `Column in ${tbl.name} (${col.type})`,
              range,
            });
          });
        });

        return { suggestions };
      },
    });

    return () => provider.dispose();
  }, [monaco, schemaData]);

  const handleRunQuery = async () => {
    if (!activeSource || !sql.trim()) return;
    setLoading(true);
    try {
      const res = await executeSql(activeSource.id, sql);
      setResult(res);
    } catch (err: any) {
      setResult({
        command: 'ERROR',
        rowCount: 0,
        durationMs: 0,
        columns: [],
        rows: [],
        error: err.message || 'Failed to execute query',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditorMount = (editor: any, monacoInstance: any) => {
    // Add Ctrl+Enter / Cmd+Enter shortcut
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      handleRunQuery();
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0B0F19]">
      {/* Action Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunQuery}
            disabled={loading || !activeSource}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
            title="Execute SQL (Ctrl + Enter)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Query (Ctrl+Enter)
          </button>

          <button
            onClick={() => setSql('')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            Clear
          </button>
        </div>

        {/* View Switcher for Query Results */}
        {result && !result.error && result.rows.length > 0 && (
          <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table View
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'chart' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Chart View
            </button>
          </div>
        )}
      </div>

      {/* Monaco SQL Editor container */}
      <div className="h-1/2 min-h-[220px] border-b border-slate-800 relative">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={(val) => setSql(val || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            fontFamily: 'Fira Code, monospace',
          }}
        />
      </div>

      {/* Query Result Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
        {/* Results Metadata Bar */}
        {result && (
          <div className="h-9 px-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-4">
              {result.error ? (
                <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  Query Error
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  Execution Succeeded ({result.command})
                </div>
              )}

              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{result.durationMs} ms</span>
              </div>
            </div>

            <div className="text-slate-400 font-mono">
              Rows: <span className="text-slate-200 font-semibold">{result.rowCount}</span>
            </div>
          </div>
        )}

        {/* Results Body */}
        <div className="flex-1 overflow-auto relative p-2">
          {!result && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
              <p className="text-sm font-medium">Write SQL query and press Run (Ctrl+Enter)</p>
            </div>
          )}

          {result?.error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 font-mono text-sm">
              <div className="font-bold text-rose-400 mb-1">Execution Error:</div>
              <pre className="whitespace-pre-wrap">{result.error}</pre>
            </div>
          )}

          {result && !result.error && (
            <>
              {viewMode === 'grid' ? (
                <ResultGrid
                  columns={result.columns}
                  rows={result.rows}
                  sourceId={activeSource?.id}
                />
              ) : (
                <DataChart rows={result.rows} columns={result.columns} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
