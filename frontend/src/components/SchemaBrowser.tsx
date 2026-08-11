import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Layers, Network, Table as TableIcon, Key, ArrowRightCircle, ArrowDownCircle, Grid, Search, Plus, Wand2 } from 'lucide-react';
import { SchemaTreeResponse } from '../types';

interface SchemaBrowserProps {
  schemaData: SchemaTreeResponse | null;
  onSelectTable: (tableName: string) => void;
  onOpenCreateTableModal?: () => void;
}

// Custom ERD Node rendering table box with ReactFlow Handles
const TableNode = ({ data }: { data: any }) => {
  return (
    <div className="w-72 bg-[#161B22] border border-[#30363D] rounded-xl shadow-xl overflow-hidden font-sans relative group hover:border-[#58A6FF] transition-all">
      {/* Top Handle (Incoming FK) */}
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        className="w-3 h-3 !bg-[#58A6FF] !border-2 !border-[#0D1117] transition-transform group-hover:scale-125"
      />
      {/* Left Handle */}
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className="w-3 h-3 !bg-[#58A6FF] !border-2 !border-[#0D1117] transition-transform group-hover:scale-125"
      />

      <div className="px-3.5 py-2 bg-[#0D1117] border-b border-[#30363D] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-[#58A6FF]" />
          <span className="font-bold text-xs text-[#F0F6FC] font-mono truncate">{data.label}</span>
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#21262D] text-[#8B949E] border border-[#30363D]">
          {data.columns.length} cols
        </span>
      </div>

      <div className="p-2 space-y-1 font-mono text-xs">
        {data.columns.map((col: any) => (
          <div
            key={col.name}
            className="flex items-center justify-between px-2 py-1 rounded bg-[#0D1117] hover:bg-[#21262D] text-[11px] text-[#C9D1D9] transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate">
              {col.isPk ? (
                <Key className="w-3 h-3 text-[#D29922] shrink-0" />
              ) : col.isFk ? (
                <span className="text-[#58A6FF] font-bold text-[10px] shrink-0">FK</span>
              ) : (
                <span className="w-3 h-3 block shrink-0" />
              )}
              <span className={`truncate ${col.isPk ? 'font-bold text-[#F0F6FC]' : ''}`}>{col.name}</span>
            </div>
            <span className="text-[10px] text-[#8B949E] ml-2 shrink-0">{col.type}</span>
          </div>
        ))}
      </div>

      {/* Bottom Handle (Outgoing FK) */}
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        className="w-3 h-3 !bg-[#58A6FF] !border-2 !border-[#0D1117] transition-transform group-hover:scale-125"
      />
      {/* Right Handle */}
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className="w-3 h-3 !bg-[#58A6FF] !border-2 !border-[#0D1117] transition-transform group-hover:scale-125"
      />
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode,
};

// Advanced Dagre Layout Algorithm with dynamic node heights & smoothstep edges
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' | 'GRID') => {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  if (direction === 'GRID') {
    const gridCols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
    const nodeWidth = 300;

    const layoutedNodes = nodes.map((node, index) => {
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);
      const colsCount = (node.data?.columns as any[])?.length || 4;
      const calcHeight = Math.max(120, 45 + colsCount * 28 + 15);

      return {
        ...node,
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        position: {
          x: col * (nodeWidth + 70),
          y: row * (calcHeight + 90),
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 120,
    nodesep: 80,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    const colsCount = (node.data?.columns as any[])?.length || 4;
    const calcHeight = Math.max(120, 45 + colsCount * 28 + 15);
    dagreGraph.setNode(node.id, { width: 300, height: calcHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const colsCount = (node.data?.columns as any[])?.length || 4;
    const calcHeight = Math.max(120, 45 + colsCount * 28 + 15);

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - 150,
        y: nodeWithPosition.y - calcHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({ schemaData, onSelectTable, onOpenCreateTableModal }) => {
  const [selectedSchema, setSelectedSchema] = useState<string>('public');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'erd' | 'tree'>('erd');
  const [layoutDir, setLayoutDir] = useState<'TB' | 'LR' | 'GRID'>('TB');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const filteredTables = useMemo(() => {
    if (!schemaData) return [];
    return schemaData.tables.filter((t) => {
      const matchSchema = !selectedSchema || t.schema === selectedSchema;
      const matchSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSchema && matchSearch;
    });
  }, [schemaData, selectedSchema, searchTerm]);

  // Update Graph Layout
  const updateGraphLayout = useCallback(
    (direction: 'TB' | 'LR' | 'GRID') => {
      if (!schemaData) return;

      const tables = schemaData.tables.filter((t) => !selectedSchema || t.schema === selectedSchema);

      const rawNodes: Node[] = tables.map((tbl) => {
        const pkCols = new Set(tbl.columns.filter((c) => c.isPrimaryKey).map((c) => c.name));
        
        // Find foreign keys for this table
        const fkCols = new Set(
          schemaData.foreignKeys
            .filter((fk) => {
              const srcTbl = (fk.fromTable || '').replace(/^.*?\./, '').replace(/"/g, '');
              return srcTbl === tbl.name;
            })
            .map((fk) => fk.fromColumn)
        );

        const colsFormatted = tbl.columns.map((c) => ({
          name: c.name,
          type: c.type,
          isPk: c.isPrimaryKey || pkCols.has(c.name),
          isFk: fkCols.has(c.name),
        }));

        return {
          id: tbl.name,
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: {
            label: tbl.name,
            columns: colsFormatted,
            onSelect: () => onSelectTable(tbl.name),
          },
        };
      });

      const isHorizontal = direction === 'LR';

      const rawEdges: Edge[] = schemaData.foreignKeys
        .map((fk, idx) => {
          const fromTbl = (fk.fromTable || '').replace(/^.*?\./, '').replace(/"/g, '');
          const toTbl = (fk.toTable || '').replace(/^.*?\./, '').replace(/"/g, '');

          const hasSource = tables.some((t) => t.name === fromTbl);
          const hasTarget = tables.some((t) => t.name === toTbl);

          if (!hasSource || !hasTarget) return null;

          return {
            id: `e-${fromTbl}-${toTbl}-${idx}`,
            source: fromTbl,
            target: toTbl,
            type: 'smoothstep',
            pathOptions: { borderRadius: 16, offset: 20 },
            sourceHandle: isHorizontal ? 'right' : 'bottom',
            targetHandle: isHorizontal ? 'left' : 'top',
            animated: true,
            label: `${fk.fromColumn} ➔ ${fk.toColumn}`,
            labelStyle: { fill: '#58A6FF', fontSize: 10, fontFamily: 'Fira Code, monospace', fontWeight: 600 },
            labelBgStyle: { fill: '#0D1117', fillOpacity: 0.9, rx: 6, ry: 6 },
            labelBgPadding: [6, 4] as [number, number],
            style: { stroke: '#58A6FF', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#58A6FF',
              width: 16,
              height: 16,
            },
          };
        })
        .filter(Boolean) as Edge[];

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges, direction);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [schemaData, selectedSchema, onSelectTable, setNodes, setEdges]
  );

  useEffect(() => {
    updateGraphLayout(layoutDir);
  }, [updateGraphLayout, layoutDir]);

  if (!schemaData) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8B949E] text-sm">
        Connect to a database to inspect Schema and ERD diagram.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0D1117] select-none">
      {/* Top Header Toolbar */}
      <div className="h-12 border-b border-[#30363D] bg-[#161B22] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#58A6FF]" />
            <span className="text-xs font-semibold text-[#8B949E] uppercase">Schema:</span>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-[#0D1117] border border-[#30363D] text-xs font-medium text-[#C9D1D9] focus:outline-none focus:border-[#58A6FF] cursor-pointer"
            >
              {schemaData.schemas.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {onOpenCreateTableModal && (
              <button
                onClick={onOpenCreateTableModal}
                className="px-3 py-1 rounded-lg bg-[#1F6FEB] hover:bg-[#388BFD] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ml-2"
                title="Visually create a new table"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create Table</span>
              </button>
            )}
          </div>

          {/* Auto-Layout Controls for ERD */}
          {viewMode === 'erd' && filteredTables.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#0D1117] px-2 py-1 rounded-lg border border-[#30363D] text-xs">
              <Wand2 className="w-3.5 h-3.5 text-[#D29922] shrink-0" />
              <span className="text-[#8B949E] font-semibold mr-1">Layout:</span>
              <button
                onClick={() => {
                  setLayoutDir('TB');
                  updateGraphLayout('TB');
                }}
                className={`p-1 rounded flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                  layoutDir === 'TB' ? 'bg-[#1F6FEB] text-white font-bold' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
                title="Hierarchical Top-to-Bottom Layout"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Vertical
              </button>

              <button
                onClick={() => {
                  setLayoutDir('LR');
                  updateGraphLayout('LR');
                }}
                className={`p-1 rounded flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                  layoutDir === 'LR' ? 'bg-[#1F6FEB] text-white font-bold' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
                title="Horizontal Left-to-Right Flow"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                Horizontal
              </button>

              <button
                onClick={() => {
                  setLayoutDir('GRID');
                  updateGraphLayout('GRID');
                }}
                className={`p-1 rounded flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                  layoutDir === 'GRID' ? 'bg-[#1F6FEB] text-white font-bold' : 'text-[#8B949E] hover:text-[#C9D1D9]'
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
        <div className="flex gap-1 p-1 bg-[#0D1117] rounded-lg border border-[#30363D]">
          <button
            onClick={() => setViewMode('erd')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'erd'
                ? 'bg-[#1F6FEB] text-white font-semibold'
                : 'text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Visual ERD Diagram
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'tree'
                ? 'bg-[#1F6FEB] text-white font-semibold'
                : 'text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Table List View
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'erd' ? (
          <div className="w-full h-full bg-[#0D1117]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-right"
            >
              <Background color="#30363D" gap={24} size={1} />
              <Controls className="bg-[#161B22] border-[#30363D] fill-[#C9D1D9]" />
              <MiniMap
                nodeColor={() => '#161B22'}
                maskColor="rgba(13, 17, 23, 0.7)"
                className="bg-[#161B22] border-[#30363D]"
              />
            </ReactFlow>
          </div>
        ) : (
          <div className="p-6 h-full overflow-y-auto space-y-4">
            <div className="max-w-md relative">
              <Search className="w-4 h-4 text-[#8B949E] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tables by name..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#161B22] border border-[#30363D] text-[#C9D1D9] text-xs focus:outline-none focus:border-[#58A6FF]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTables.map((tbl) => (
                <div
                  key={tbl.name}
                  onClick={() => onSelectTable(tbl.name)}
                  className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] hover:border-[#58A6FF] transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-center justify-between border-b border-[#30363D] pb-2">
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-[#58A6FF] group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-sm text-[#F0F6FC] font-mono">{tbl.name}</span>
                    </div>
                    <span className="text-xs text-[#8B949E] font-mono">{tbl.columns.length} columns</span>
                  </div>

                  <div className="space-y-1 max-h-36 overflow-y-auto text-xs font-mono">
                    {tbl.columns.map((col) => (
                      <div key={col.name} className="flex items-center justify-between text-[#8B949E]">
                        <span className={`truncate ${col.isPrimaryKey ? 'text-[#D29922] font-bold' : ''}`}>
                          {col.isPrimaryKey && '🔑 '}
                          {col.name}
                        </span>
                        <span className="text-[10px] text-[#484F58]">{col.type}</span>
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
