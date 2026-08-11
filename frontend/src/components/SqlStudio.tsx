import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import {
  Play,
  Sparkles,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Table as TableIcon,
  BarChart2,
  X,
  GripHorizontal,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { DiscoveredSource, QueryResultPayload, SchemaTreeResponse } from '../types';
import { executeSql } from '../services/api';
import { ResultGrid } from './ResultGrid';
import { DataChart } from './DataChart';

interface SqlStudioProps {
  activeSource: DiscoveredSource | null;
  schemaData: SchemaTreeResponse | null;
}

export const SqlStudio: React.FC<SqlStudioProps> = ({ activeSource, schemaData }) => {
  const [sql, setSql] = useState<string>(
    '-- Write your SQL query here\nSELECT u.full_name, COUNT(o.id) AS total_orders, SUM(o.total_amount) AS total_spent\nFROM users u\nJOIN orders o ON u.id = o.user_id\nGROUP BY u.full_name;\n'
  );
  const [result, setResult] = useState<QueryResultPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'chart'>('grid');

  // Resizable Editor State (Height %)
  const [editorHeightPercent, setEditorHeightPercent] = useState<number>(45);
  const isDraggingVertical = useRef<boolean>(false);

  // Resizable & Collapsible Side Analytics Panel State
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(true);
  const [analyticsWidth, setAnalyticsWidth] = useState<number>(420);
  const isDraggingHorizontal = useRef<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const monaco = useMonaco();

  // Monaco SQL Completion Provider
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

        keywords.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        });

        schemaData.tables.forEach((tbl) => {
          suggestions.push({
            label: tbl.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: tbl.name,
            detail: `Table (${tbl.schema})`,
            range,
          });

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

  // Execute SQL Query
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
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      handleRunQuery();
    });
  };

  // Vertical Resize Dragging (Editor vs Results)
  const handleMouseDownVertical = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingVertical.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Horizontal Resize Dragging (Results vs Side Analytics Panel)
  const handleMouseDownHorizontal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHorizontal.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingVertical.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const newPercent = (relativeY / rect.height) * 100;
        if (newPercent >= 15 && newPercent <= 80) {
          setEditorHeightPercent(newPercent);
        }
      }

      if (isDraggingHorizontal.current && workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        const relativeX = rect.right - e.clientX;
        if (relativeX >= 260 && relativeX <= rect.width * 0.65) {
          setAnalyticsWidth(relativeX);
        }
      }
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingVertical.current || isDraggingHorizontal.current) {
      isDraggingVertical.current = false;
      isDraggingHorizontal.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden bg-[#0B0F19]">
      {/* Top Action Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunQuery}
            disabled={loading || !activeSource}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            title="Execute SQL (Ctrl + Enter)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Query (Ctrl+Enter)
          </button>

          <button
            onClick={() => setSql('')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            Clear
          </button>
        </div>

        {/* Right Panel Toggle & View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isAnalyticsOpen
                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Right Live Analytics Side Panel"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Live Analytics Panel</span>
            {isAnalyticsOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Monaco SQL Editor Section (Resizable Height) */}
      <div style={{ height: `${editorHeightPercent}%` }} className="min-h-[120px] max-h-[85%] relative border-b border-slate-800">
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

      {/* Resizable Vertical Handle (Drag up/down) */}
      <div
        onMouseDown={handleMouseDownVertical}
        className="h-2 bg-slate-900/90 border-y border-slate-800/80 hover:bg-cyan-500/80 active:bg-cyan-400 cursor-row-resize flex items-center justify-center group transition-colors shrink-0 select-none z-10"
        title="Drag up/down to resize Editor and Query Results"
      >
        <div className="w-12 h-1 rounded-full bg-slate-700 group-hover:bg-slate-950 transition-colors" />
      </div>

      {/* Bottom Main Workspace (Result Grid + Collapsible Side Analytics Panel) */}
      <div ref={workspaceRef} className="flex-1 flex min-h-0 bg-slate-950 overflow-hidden relative">
        {/* Left Side: SQL Result Grid & Metadata */}
        <div className="flex-1 flex flex-col min-w-0 h-full border-r border-slate-800/60 overflow-hidden">
          {/* Metadata Bar */}
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

          {/* Result Content */}
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
              <ResultGrid columns={result.columns} rows={result.rows} sourceId={activeSource?.id} />
            )}
          </div>
        </div>

        {/* Resizable Horizontal Divider between Result Grid & Analytics Panel */}
        {isAnalyticsOpen && (
          <div
            onMouseDown={handleMouseDownHorizontal}
            className="w-2 bg-slate-900/90 border-x border-slate-800/80 hover:bg-cyan-500/80 active:bg-cyan-400 cursor-col-resize flex flex-col items-center justify-center group transition-colors shrink-0 select-none z-10"
            title="Drag left/right to resize Live Analytics Side Panel"
          >
            <div className="h-12 w-1 rounded-full bg-slate-700 group-hover:bg-slate-950 transition-colors" />
          </div>
        )}

        {/* Right Side: Collapsible & Resizable Live Data Analytics Panel */}
        {isAnalyticsOpen && (
          <div
            style={{ width: `${analyticsWidth}px` }}
            className="h-full bg-slate-900/40 flex flex-col shrink-0 overflow-hidden"
          >
            {/* Analytics Panel Header */}
            <div className="h-9 px-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 tracking-wide">Live Data Analytics & Chart</span>
              </div>
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Close Analytics Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Analytics Panel Body */}
            <div className="flex-1 p-3 overflow-hidden">
              <DataChart rows={result?.rows || []} columns={result?.columns || []} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
