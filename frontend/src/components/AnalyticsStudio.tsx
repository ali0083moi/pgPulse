import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Sparkles, BarChart2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { DiscoveredSource, QueryResultPayload, SchemaTreeResponse } from '../types';
import { executeSql } from '../services/api';
import { DataChart } from './DataChart';

interface AnalyticsStudioProps {
  activeSource: DiscoveredSource | null;
  activeDb: string;
  schemaData: SchemaTreeResponse | null;
}

const PRESET_QUERIES = [
  {
    name: 'Total Spent per Customer',
    db: 'ecommerce_db',
    sql: `SELECT u.full_name AS customer, SUM(o.total_amount) AS total_spent\nFROM users u\nJOIN orders o ON u.id = o.user_id\nGROUP BY u.full_name\nORDER BY total_spent DESC;`,
  },
  {
    name: 'Doctor Earnings',
    db: 'hospital_db',
    sql: `SELECT d.name AS doctor_name, SUM(a.fee) AS total_earnings\nFROM doctors d\nJOIN appointments a ON d.id = a.doctor_id\nGROUP BY d.id, d.name\nORDER BY total_earnings DESC;`,
  },
  {
    name: 'Average Student GPA',
    db: 'school_db',
    sql: `SELECT d.dept_name, ROUND(AVG(s.gpa), 2) AS avg_gpa\nFROM departments d\nJOIN students s ON d.id = s.dept_id\nGROUP BY d.id, d.dept_name;`,
  },
  {
    name: 'Product Inventory Levels',
    db: 'ecommerce_db',
    sql: `SELECT title AS product_name, stock_quantity\nFROM products\nORDER BY stock_quantity DESC;`,
  },
];

export const AnalyticsStudio: React.FC<AnalyticsStudioProps> = ({ activeSource, activeDb, schemaData }) => {
  const [sql, setSql] = useState<string>(PRESET_QUERIES[0].sql);
  const [result, setResult] = useState<QueryResultPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleRunQuery = async (sqlToRun?: string) => {
    if (!activeSource) return;
    const queryText = sqlToRun || sql;
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const res = await executeSql(activeSource.id, queryText);
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

  useEffect(() => {
    if (activeSource) {
      handleRunQuery();
    }
  }, [activeSource, activeDb]);

  const handleEditorMount = (editor: any, monacoInstance: any) => {
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      handleRunQuery();
    });
  };

  if (!activeSource) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Connect to a PostgreSQL source to start instant data analytics.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F19] overflow-hidden">
      {/* Preset Queries Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 shrink-0 mr-2 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4" />
            Preset Analytics Queries:
          </span>
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                setSql(preset.sql);
                handleRunQuery(preset.sql);
              }}
              className="px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 text-xs font-medium whitespace-nowrap transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleRunQuery()}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 shrink-0 transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Run & Plot (Ctrl+Enter)
        </button>
      </div>

      {/* Main Workspace Split: Top SQL Editor, Bottom Chart */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* SQL Editor */}
        <div className="h-44 border-b border-slate-800 relative">
          <Editor
            height="100%"
            defaultLanguage="sql"
            theme="vs-dark"
            value={sql}
            onChange={(val) => setSql(val || '')}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
              fontFamily: 'Fira Code, monospace',
            }}
          />
        </div>

        {/* Live Chart & Results Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950 p-4 space-y-2 overflow-hidden">
          {result && (
            <div className="h-8 px-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs shrink-0 rounded-lg">
              <div className="flex items-center gap-4">
                {result.error ? (
                  <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    Query Error
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    Chart Succeeded ({result.command})
                  </div>
                )}

                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{result.durationMs} ms</span>
                </div>
              </div>

              <div className="text-slate-400 font-mono">
                Plotted Rows: <span className="text-slate-200 font-semibold">{result.rowCount}</span>
              </div>
            </div>
          )}

          <div className="flex-1 relative overflow-hidden">
            {result?.error ? (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 font-mono text-sm">
                <div className="font-bold text-rose-400 mb-1">Execution Error:</div>
                <pre className="whitespace-pre-wrap">{result.error}</pre>
              </div>
            ) : result?.rows ? (
              <DataChart rows={result.rows} columns={result.columns} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-cyan-500 animate-pulse" />
                <p className="text-sm font-medium">Run SQL Query or click a Preset button to render live charts.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
