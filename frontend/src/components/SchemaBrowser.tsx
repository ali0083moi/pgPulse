import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ReactFlow, Controls, Background, Node, Edge, MarkerType, Handle, Position, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { SchemaTreeResponse, TableInfo } from '../types';
import { Table, Key, Network, Eye, Layers, Info, Wand2, ArrowDownCircle, ArrowRightCircle, Grid } from 'lucide-react';

interface SchemaBrowserProps {
  schemaData: SchemaTreeResponse | null;
  onSelectTable: (tableName: string) => void;
}

// Custom ReactFlow Node for ERD Tables with clean top/bottom/left/right Handles
const ERDTableNode: React.FC<{ data: { table: TableInfo; onSelectTable: (name: string) => void } }> = ({ data }) => {
  const tbl = data.table;
  return (
    <div className="w-68 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden font-sans text-xs hover:border-cyan-500/80 transition-all">
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-cyan-400 !w-3 !h-3 !-top-1.5" />
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-cyan-400 !w-3 !h-3 !-left-1.5" />

      <div className="bg-slate-800/90 px-3 py-2 border-b border-slate-700 flex items-center justify-between font-bold text-slate-100">
        <div className="flex items-center gap-2">
          <Table className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate max-w-[130px]">{tbl.name}</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono font-normal shrink-0">{tbl.columns.length} cols</span>
      </div>

      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {tbl.columns.map((c) => (
          <div key={c.name} className="flex items-center justify-between text-[11px] text-slate-300 hover:bg-slate-800/60 px-1.5 py-0.5 rounded">
            <div className="flex items-center gap-1.5 font-mono truncate">
              {c.isPrimaryKey ? (
                <Key className="w-3 h-3 text-amber-400 shrink-0" />
              ) : (
                <span className="w-3 text-center text-slate-600">•</span>
              )}
              <span className={c.isPrimaryKey ? 'font-bold text-amber-300' : ''}>{c.name}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono pl-1 shrink-0">{c.type}</span>
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-cyan-400 !w-3 !h-3 !-bottom-1.5" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-cyan-400 !w-3 !h-3 !-right-1.5" />
    </div>
  );
};

// Dagre Layout Algorithm helper
const getLayoutedElements = (rawNodes: Node[], rawEdges: Edge[], direction: 'TB' | 'LR' | 'GRID' = 'TB') => {
  if (direction === 'GRID') {
    const colsPerRow = Math.ceil(Math.sqrt(rawNodes.length)) || 3;
    const gridNodes = rawNodes.map((node, idx) => {
      const row = Math.floor(idx / colsPerRow);
      const col = idx % colsPerRow;
      return {
        ...node,
        position: { x: col * 320, y: row * 260 },
      };
    });
    return { nodes: gridNodes, edges: rawEdges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120 });

  rawNodes.forEach((node) => {
    const tbl = (node.data as any)?.table as TableInfo;
    const nodeWidth = 280;
    const nodeHeight = Math.min(260, 50 + (tbl?.columns?.length || 0) * 24);
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  rawEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = rawNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const tbl = (node.data as any)?.table as TableInfo;
    const nodeWidth = 280;
    const nodeHeight = Math.min(260, 50 + (tbl?.columns?.length || 0) * 24);

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges: rawEdges };
};

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({ schemaData, onSelectTable }) => {
  const [viewMode, setViewMode] = useState<'tree' | 'erd'>('erd');
  const [selectedSchema, setSelectedSchema] = useState<string>('public');
  const [layoutDir, setLayoutDir] = useState<'TB' | 'LR' | 'GRID'>('TB');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(() => ({ erdTable: ERDTableNode }), []);

  useEffect(() => {
    if (schemaData?.schemas && schemaData.schemas.length > 0) {
      if (!schemaData.schemas.includes(selectedSchema)) {
        setSelectedSchema(schemaData.schemas.includes('public') ? 'public' : schemaData.schemas[0]);
      }
    }
  }, [schemaData]);

  const filteredTables = useMemo(() => {
    if (!schemaData) return [];
    return schemaData.tables.filter((t) => t.schema === selectedSchema);
  }, [schemaData, selectedSchema]);

  // Generate and layout nodes/edges
  const updateGraphLayout = useCallback(
    (dir: 'TB' | 'LR' | 'GRID') => {
      if (!schemaData || schemaData.tables.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const tablesToRender = schemaData.tables.filter((t) => t.schema === selectedSchema);

      const rawNodes: Node[] = tablesToRender.map((tbl) => ({
        id: tbl.name,
        type: 'erdTable',
        position: { x: 0, y: 0 },
        style: { background: 'transparent', border: 'none', padding: 0 },
        data: { table: tbl, onSelectTable },
      }));

      const rawEdges: Edge[] = [];
      schemaData.foreignKeys.forEach((fk) => {
        if (
          tablesToRender.some((t) => t.name === fk.fromTable) &&
          tablesToRender.some((t) => t.name === fk.toTable)
        ) {
          rawEdges.push({
            id: fk.id,
            source: fk.fromTable,
            target: fk.toTable,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#06b6d4', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#06b6d4',
            },
          });
        }
      });

      const layouted = getLayoutedElements(rawNodes, rawEdges, dir);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    },
    [schemaData, selectedSchema, onSelectTable, setNodes, setEdges]
  );

  useEffect(() => {
    updateGraphLayout(layoutDir);
  }, [updateGraphLayout, layoutDir]);

  if (!schemaData) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Connect to a database to inspect Schema and ERD diagram.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F19]">
      {/* Top Header Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/60 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase">Schema:</span>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {schemaData.schemas.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Layout Controls for ERD */}
          {viewMode === 'erd' && filteredTables.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
              <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400 font-semibold mr-1">Layout:</span>
              <button
                onClick={() => setLayoutDir('TB')}
                className={`p-1 rounded flex items-center gap-1 font-medium transition-colors ${
                  layoutDir === 'TB' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Hierarchical Top-to-Bottom Layout"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Vertical
              </button>

              <button
                onClick={() => setLayoutDir('LR')}
                className={`p-1 rounded flex items-center gap-1 font-medium transition-colors ${
                  layoutDir === 'LR' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Horizontal Left-to-Right Flow"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                Horizontal
              </button>

              <button
                onClick={() => setLayoutDir('GRID')}
                className={`p-1 rounded flex items-center gap-1 font-medium transition-colors ${
                  layoutDir === 'GRID' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Compact Grid Layout"
              >
                <Grid className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>
          )}
        </div>

        {/* View Switcher */}
        <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('erd')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'erd' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Interactive ERD Diagram
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'tree' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Table Schema Details
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative overflow-hidden">
        {filteredTables.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
            <Info className="w-8 h-8 text-cyan-400 opacity-60" />
            <div className="text-slate-300 font-semibold text-sm">No tables found in schema '{selectedSchema}'.</div>
            <p className="text-xs text-slate-500 max-w-md">
              Use the <span className="text-cyan-400 font-bold font-mono">DB:</span> dropdown in the top header bar to switch to <span className="font-mono text-emerald-400">ecommerce_db</span>, <span className="font-mono text-emerald-400">hospital_db</span>, or <span className="font-mono text-emerald-400">school_db</span>!
            </p>
          </div>
        ) : viewMode === 'erd' ? (
          <div className="w-full h-full bg-[#0B0F19]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background color="#1e293b" gap={16} size={1} />
              <Controls className="bg-slate-900 border-slate-800 text-slate-200" />
            </ReactFlow>
          </div>
        ) : (
          <div className="p-6 h-full overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTables.map((tbl) => (
                <div
                  key={tbl.name}
                  className="p-4 rounded-xl glass-panel border border-slate-800 hover:border-cyan-500/50 transition-all shadow-lg space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                      <Table className="w-4 h-4 text-cyan-400" />
                      <span>{tbl.name}</span>
                    </div>
                    <button
                      onClick={() => onSelectTable(tbl.name)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Query Table
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {tbl.columns.map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/60 font-mono">
                        <div className="flex items-center gap-2">
                          {c.isPrimaryKey && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span className={c.isPrimaryKey ? 'font-bold text-amber-300' : ''}>{c.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{c.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
