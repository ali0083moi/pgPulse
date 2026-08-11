import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import {
  Play,
  Sparkles,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart2,
  X,
  ChevronRight,
  ChevronLeft,
  Table as TableIcon,
  List,
  History,
  Star,
  Zap,
  Activity,
  Plus,
  Bookmark,
  Search,
  Link as LinkIcon,
  Key,
  PieChart,
  Database as DbIcon,
  Users,
} from 'lucide-react';
import { DiscoveredSource, QueryResultPayload, SchemaTreeResponse, HistoryItem, SavedSnippet } from '../types';
import { executeSql } from '../services/api';
import { ResultGrid } from './ResultGrid';
import { DataChart } from './DataChart';

interface SqlStudioProps {
  activeSource: DiscoveredSource | null;
  schemaData: SchemaTreeResponse | null;
  onOpenCreateTableModal?: () => void;
  onOpenCreateIndexModal?: () => void;
  onOpenDbActivityModal?: () => void;
}

const STORAGE_KEY_HISTORY = 'pgpulse_query_history';
const STORAGE_KEY_SNIPPETS = 'pgpulse_saved_snippets';

const QUICK_COMMANDS = [
  {
    id: 'list-tables',
    label: 'List Tables',
    icon: TableIcon,
    iconColor: 'text-[#58A6FF]',
    sql: `-- List all user tables in public schema\nSELECT table_name, table_type \nFROM information_schema.tables \nWHERE table_schema = 'public'\nORDER BY table_name;`,
  },
  {
    id: 'list-columns',
    label: 'Columns & Types',
    icon: Search,
    iconColor: 'text-[#58A6FF]',
    sql: `-- Describe all columns and data types\nSELECT \n  table_name, \n  column_name, \n  data_type, \n  is_nullable, \n  column_default\nFROM information_schema.columns\nWHERE table_schema = 'public'\nORDER BY table_name, ordinal_position;`,
  },
  {
    id: 'foreign-keys',
    label: 'Foreign Keys',
    icon: LinkIcon,
    iconColor: 'text-[#A371F7]',
    sql: `-- View foreign key relationships\nSELECT \n  tc.table_name,\n  kcu.column_name,\n  ccu.table_name AS foreign_table_name,\n  ccu.column_name AS foreign_column_name\nFROM information_schema.table_constraints AS tc\nJOIN information_schema.key_column_usage AS kcu \n  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema\nJOIN information_schema.constraint_column_usage AS ccu \n  ON ccu.constraint_name = tc.constraint_name\nWHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';`,
  },
  {
    id: 'primary-keys',
    label: 'Primary Keys',
    icon: Key,
    iconColor: 'text-[#D29922]',
    sql: `-- View primary key constraints\nSELECT \n  tc.table_name, \n  kcu.column_name\nFROM information_schema.table_constraints tc\nJOIN information_schema.key_column_usage kcu \n  ON tc.constraint_name = kcu.constraint_name\nWHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';`,
  },
  {
    id: 'table-sizes',
    label: 'Disk Sizes',
    icon: PieChart,
    iconColor: 'text-[#3FB950]',
    sql: `-- Table sizes in human readable format\nSELECT \n  table_name,\n  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size,\n  pg_size_pretty(pg_relation_size(quote_ident(table_name))) AS data_size\nFROM information_schema.tables \nWHERE table_schema = 'public'\nORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;`,
  },
  {
    id: 'list-databases',
    label: 'Databases',
    icon: DbIcon,
    iconColor: 'text-[#58A6FF]',
    sql: `-- List all non-template databases and disk usage\nSELECT \n  datname AS database_name,\n  pg_size_pretty(pg_database_size(datname)) AS db_size\nFROM pg_database\nWHERE datistemplate = false\nORDER BY pg_database_size(datname) DESC;`,
  },
  {
    id: 'list-users',
    label: 'System Roles',
    icon: Users,
    iconColor: 'text-[#A371F7]',
    sql: `-- List database roles and permissions\nSELECT rolname AS username, rolsuper AS is_superuser, rolcreatedb AS can_create_db, rolcanlogin AS can_login \nFROM pg_roles \nWHERE rolname NOT LIKE 'pg_%'\nORDER BY rolname;`,
  },
];

export const SqlStudio: React.FC<SqlStudioProps> = ({
  activeSource,
  schemaData,
  onOpenCreateTableModal,
  onOpenCreateIndexModal,
  onOpenDbActivityModal,
}) => {
  const [sql, setSql] = useState<string>(
    '-- Write your SQL query here\nSELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';\n'
  );
  const [result, setResult] = useState<QueryResultPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // History & Snippets Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'history' | 'snippets'>('history');
  
  const [queryHistory, setQueryHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [savedSnippets, setSavedSnippets] = useState<SavedSnippet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SNIPPETS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(queryHistory.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save query history:', e);
    }
  }, [queryHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify(savedSnippets));
    } catch (e) {
      console.warn('Failed to save snippets:', e);
    }
  }, [savedSnippets]);

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
  const handleRunQuery = async (queryOverride?: string) => {
    if (!activeSource) return;
    const sqlToRun = queryOverride !== undefined ? queryOverride : sql;
    if (!sqlToRun.trim()) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      const res = await executeSql(activeSource.id, sqlToRun);
      setResult(res);

      const historyItem: HistoryItem = {
        id: Math.random().toString(),
        sql: sqlToRun,
        timestamp: Date.now(),
        durationMs: res.durationMs || Date.now() - startTime,
        rowCount: res.rowCount,
        status: res.error ? 'error' : 'success',
        errorMessage: res.error,
      };

      setQueryHistory((prev) => [historyItem, ...prev.filter((h) => h.sql !== sqlToRun)]);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to execute query';
      setResult({
        command: 'ERROR',
        rowCount: 0,
        durationMs: Date.now() - startTime,
        columns: [],
        rows: [],
        error: errorMsg,
      });

      const historyItem: HistoryItem = {
        id: Math.random().toString(),
        sql: sqlToRun,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        rowCount: 0,
        status: 'error',
        errorMessage: errorMsg,
      };

      setQueryHistory((prev) => [historyItem, ...prev.filter((h) => h.sql !== sqlToRun)]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSnippet = (sqlSnippet: string) => {
    const title = window.prompt('Enter a title for this saved SQL snippet:', 'My Query Snippet');
    if (!title) return;

    const newSnippet: SavedSnippet = {
      id: Math.random().toString(),
      title,
      sql: sqlSnippet,
      createdAt: Date.now(),
    };

    setSavedSnippets((prev) => [newSnippet, ...prev]);
    setIsSidebarOpen(true);
    setSidebarTab('snippets');
  };

  const handleDeleteSnippet = (id: string) => {
    setSavedSnippets((prev) => prev.filter((s) => s.id !== id));
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
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden bg-[#0D1117]">
      {/* Top Action Toolbar */}
      <div className="h-11 border-b border-[#30363D] bg-[#161B22] px-4 flex items-center justify-between shrink-0 z-10 select-none">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleRunQuery()}
            disabled={loading || !activeSource}
            className="px-3.5 py-1 rounded-lg bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Execute SQL (Ctrl + Enter)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run (Ctrl+Enter)</span>
          </button>

          <button
            onClick={() => handleSaveSnippet(sql)}
            className="px-3 py-1 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#D29922] hover:text-[#E3B341] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Save current SQL as a snippet"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#D29922]" />
            <span>Save Snippet</span>
          </button>

          <button
            onClick={() => setSql('')}
            className="px-3 py-1 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#8B949E]" />
            <span>Clear</span>
          </button>
        </div>

        {/* Right Panel Toggle & View Controls */}
        <div className="flex items-center gap-2">
          {onOpenDbActivityModal && (
            <button
              onClick={onOpenDbActivityModal}
              className="px-3 py-1 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#F85149] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="Live DB Process Monitor & Process Killer"
            >
              <Activity className="w-3.5 h-3.5 text-[#F85149]" />
              <span>DB Activity</span>
            </button>
          )}

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-3 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isSidebarOpen
                ? 'bg-[#1F6FEB]/15 border-[#1F6FEB]/40 text-[#58A6FF]'
                : 'bg-[#21262D] border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
            title="Toggle Query History & Saved Snippets Sidebar"
          >
            <History className="w-3.5 h-3.5" />
            <span>History & Snippets</span>
          </button>

          <button
            onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
            className={`px-3 py-1 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              isAnalyticsOpen
                ? 'bg-[#1F6FEB]/15 border-[#1F6FEB]/40 text-[#58A6FF]'
                : 'bg-[#21262D] border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
            title="Toggle Right Live Analytics Side Panel"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Live Analytics</span>
            {isAnalyticsOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Quick Developer Commands & Dynamic Table Chips Bar */}
      <div className="h-9 border-b border-[#30363D] bg-[#161B22] px-4 flex items-center gap-2 shrink-0 overflow-x-auto select-none">
        {onOpenCreateTableModal && (
          <button
            onClick={onOpenCreateTableModal}
            className="px-2.5 py-0.5 rounded bg-[#1F6FEB] hover:bg-[#388BFD] text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 mr-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Table</span>
          </button>
        )}

        {onOpenCreateIndexModal && (
          <button
            onClick={onOpenCreateIndexModal}
            className="px-2.5 py-0.5 rounded bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#58A6FF] font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 mr-1"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Create Index</span>
          </button>
        )}

        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] shrink-0 mr-1">
          <List className="w-3.5 h-3.5" />
          <span>Quick Actions:</span>
        </div>

        {/* Essential Postgres Schema Actions (GitHub Dark Clean Buttons) */}
        {QUICK_COMMANDS.map((cmd) => {
          const CmdIcon = cmd.icon;
          return (
            <button
              key={cmd.id}
              onClick={() => {
                setSql(cmd.sql);
                handleRunQuery(cmd.sql);
              }}
              className="px-2.5 py-0.5 rounded bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#C9D1D9] hover:text-[#58A6FF] text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CmdIcon className={`w-3.5 h-3.5 ${cmd.iconColor}`} />
              <span>{cmd.label}</span>
            </button>
          );
        })}

        {/* Active Database Tables Quick Selector Chips */}
        {schemaData?.tables && schemaData.tables.length > 0 && (
          <>
            <div className="h-4 w-[1px] bg-[#30363D] shrink-0 mx-1" />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-semibold text-[#8B949E] uppercase mr-1">Tables:</span>
              {schemaData.tables.map((tbl) => {
                const sampleQuery = `SELECT * FROM "${tbl.name}" LIMIT 50;`;
                return (
                  <button
                    key={tbl.name}
                    onClick={() => {
                      setSql(sampleQuery);
                      handleRunQuery(sampleQuery);
                    }}
                    className="px-2 py-0.5 rounded bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] text-[#58A6FF] text-xs font-mono font-medium whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer"
                    title={`Select top 50 rows from ${tbl.name}`}
                  >
                    <TableIcon className="w-3 h-3 text-[#58A6FF]" />
                    {tbl.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Editor & Collapsible History/Snippets Sidebar Container */}
      <div style={{ height: `${editorHeightPercent}%` }} className="min-h-[120px] max-h-[85%] flex relative border-b border-[#30363D]">
        {/* History / Snippets Left Drawer */}
        {isSidebarOpen && (
          <div className="w-72 bg-[#161B22] border-r border-[#30363D] flex flex-col h-full shrink-0 z-10">
            {/* Tabs */}
            <div className="flex items-center justify-between p-2 border-b border-[#30363D] bg-[#0D1117]">
              <div className="flex gap-1 bg-[#161B22] p-0.5 rounded border border-[#30363D]">
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    sidebarTab === 'history' ? 'bg-[#1F6FEB] text-white' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                  }`}
                >
                  History ({queryHistory.length})
                </button>
                <button
                  onClick={() => setSidebarTab('snippets')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    sidebarTab === 'snippets' ? 'bg-[#D29922] text-black font-bold' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                  }`}
                >
                  Snippets ({savedSnippets.length})
                </button>
              </div>

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {sidebarTab === 'history' ? (
                queryHistory.length === 0 ? (
                  <p className="text-xs text-[#8B949E] text-center py-6">No query history yet.</p>
                ) : (
                  queryHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSql(item.sql)}
                      className="p-2 rounded bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] text-xs font-mono transition-all cursor-pointer group space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#8B949E]">
                        <span className={item.status === 'error' ? 'text-[#F85149] font-bold' : 'text-[#3FB950] font-bold'}>
                          {item.status === 'error' ? 'Failed' : `${item.durationMs}ms`}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveSnippet(item.sql);
                            }}
                            className="p-0.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#D29922]"
                            title="Save as snippet"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[#C9D1D9] line-clamp-2 truncate">{item.sql}</p>
                    </div>
                  ))
                )
              ) : savedSnippets.length === 0 ? (
                <p className="text-xs text-[#8B949E] text-center py-6">No saved snippets yet. Click "Save Snippet" to add one.</p>
              ) : (
                savedSnippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    onClick={() => setSql(snippet.sql)}
                    className="p-2 rounded bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] text-xs font-mono transition-all cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between text-[#D29922] font-semibold">
                      <span className="truncate">{snippet.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSnippet(snippet.id);
                        }}
                        className="p-0.5 text-[#8B949E] hover:text-[#F85149]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[#C9D1D9] line-clamp-2 truncate">{snippet.sql}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Monaco Editor */}
        <div className="flex-1 h-full relative">
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
      </div>

      {/* Resizable Vertical Handle (Drag up/down) */}
      <div
        onMouseDown={handleMouseDownVertical}
        className="h-1.5 bg-[#161B22] border-y border-[#30363D] hover:bg-[#1F6FEB] cursor-row-resize flex items-center justify-center group transition-colors shrink-0 select-none z-10"
        title="Drag up/down to resize Editor and Query Results"
      >
        <div className="w-12 h-1 rounded bg-[#30363D] group-hover:bg-white transition-colors" />
      </div>

      {/* Bottom Main Workspace (Result Grid + Collapsible Side Analytics Panel) */}
      <div ref={workspaceRef} className="flex-1 flex min-h-0 bg-[#0D1117] overflow-hidden relative">
        {/* Left Side: SQL Result Grid & Metadata */}
        <div className="flex-1 flex flex-col min-w-0 h-full border-r border-[#30363D] overflow-hidden">
          {/* Metadata Bar */}
          {result && (
            <div className="h-8 px-4 border-b border-[#30363D] bg-[#161B22] flex items-center justify-between text-xs shrink-0 select-none">
              <div className="flex items-center gap-4">
                {result.error ? (
                  <div className="flex items-center gap-1.5 text-[#F85149] font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F85149] shrink-0" />
                    <span>Query Error</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[#3FB950] font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-[#3FB950] shrink-0" />
                    <span>Success ({result.command})</span>
                  </div>
                )}

                <div className="flex items-center gap-1 text-[#8B949E] font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-[#8B949E]" />
                  <span>{result.durationMs} ms</span>
                </div>
              </div>

              <div className="text-[#8B949E] font-mono text-[11px]">
                Rows: <span className="text-[#C9D1D9] font-semibold">{result.rowCount}</span>
              </div>
            </div>
          )}

          {/* Result Content */}
          <div className="flex-1 overflow-auto relative p-2">
            {!result && (
              <div className="h-full flex flex-col items-center justify-center text-[#8B949E] space-y-2">
                <Sparkles className="w-7 h-7 text-[#484F58]" />
                <p className="text-xs font-medium">Write SQL query and press Run (Ctrl+Enter) or click a Quick Action button above</p>
              </div>
            )}

            {result?.error && (
              <div className="p-3.5 rounded-lg bg-[#211213] border border-[#F85149]/40 text-[#FF7B72] font-mono text-xs">
                <div className="font-bold text-[#F85149] mb-1">Execution Error:</div>
                <pre className="whitespace-pre-wrap">{result.error}</pre>
              </div>
            )}

            {result && !result.error && (
              <ResultGrid
                columns={result.columns}
                rows={result.rows}
                sourceId={activeSource?.id}
                onRefreshData={() => handleRunQuery()}
              />
            )}
          </div>
        </div>

        {/* Resizable Horizontal Divider between Result Grid & Analytics Panel */}
        {isAnalyticsOpen && (
          <div
            onMouseDown={handleMouseDownHorizontal}
            className="w-1.5 bg-[#161B22] border-x border-[#30363D] hover:bg-[#1F6FEB] cursor-col-resize flex flex-col items-center justify-center group transition-colors shrink-0 select-none z-10"
            title="Drag left/right to resize Live Analytics Side Panel"
          >
            <div className="h-12 w-1 rounded bg-[#30363D] group-hover:bg-white transition-colors" />
          </div>
        )}

        {/* Right Side: Collapsible & Resizable Live Data Analytics Panel */}
        {isAnalyticsOpen && (
          <div
            style={{ width: `${analyticsWidth}px` }}
            className="h-full bg-[#161B22] flex flex-col shrink-0 overflow-hidden border-l border-[#30363D]"
          >
            {/* Analytics Panel Header */}
            <div className="h-8 px-3 border-b border-[#30363D] bg-[#0D1117] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-[#58A6FF]" />
                <span className="text-xs font-semibold text-[#C9D1D9]">Live Data Analytics & Chart</span>
              </div>
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="p-1 rounded text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D] transition-colors"
                title="Close Analytics Panel"
              >
                <X className="w-3.5 h-3.5" />
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
