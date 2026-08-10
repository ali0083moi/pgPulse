import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface DataChartProps {
  rows: any[];
  columns: Array<{ name: string }>;
}

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export const DataChart: React.FC<DataChartProps> = ({ rows, columns }) => {
  const columnNames = useMemo(() => columns.map((c) => c.name), [columns]);

  const [xAxisKey, setXAxisKey] = useState<string>('');
  const [yAxisKey, setYAxisKey] = useState<string>('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');

  // Auto pick smart default X and Y axis keys when columns or rows change
  useEffect(() => {
    if (columnNames.length > 0) {
      setXAxisKey(columnNames[0]);

      // Try finding the first column that contains numeric values
      const numericCol = columnNames.find((colName) => {
        if (colName === columnNames[0]) return false;
        return rows.some((r) => r[colName] !== null && !isNaN(Number(r[colName])));
      });

      setYAxisKey(numericCol || columnNames[1] || columnNames[0]);
    }
  }, [columnNames, rows]);

  // Clean data for Recharts: parse numeric strings (e.g. postgres NUMERIC/DECIMAL) to JS Numbers
  const parsedData = useMemo(() => {
    if (!rows.length) return [];
    return rows.map((r) => {
      const copy: any = { ...r };
      if (yAxisKey && copy[yAxisKey] !== undefined && copy[yAxisKey] !== null) {
        const numVal = Number(copy[yAxisKey]);
        copy[yAxisKey] = isNaN(numVal) ? copy[yAxisKey] : numVal;
      }
      return copy;
    });
  }, [rows, yAxisKey]);

  if (rows.length === 0 || columnNames.length === 0) {
    return <div className="p-8 text-center text-slate-500 text-sm font-medium">No data available to chart. Execute a SELECT query to plot results.</div>;
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Chart Config Controls */}
      <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Chart Type:</span>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as any)}
            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="area">Area Chart</option>
            <option value="pie">Pie Chart</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">X-Axis (Category):</span>
          <select
            value={xAxisKey}
            onChange={(e) => setXAxisKey(e.target.value)}
            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
          >
            {columnNames.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Y-Axis (Metric):</span>
          <select
            value={yAxisKey}
            onChange={(e) => setYAxisKey(e.target.value)}
            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
          >
            {columnNames.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Render Chart */}
      <div className="flex-1 min-h-[300px] w-full bg-slate-900/60 p-4 rounded-xl border border-slate-800 shadow-inner">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={parsedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
              <Legend />
              <Bar dataKey={yAxisKey} fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={parsedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
              <Legend />
              <Line type="monotone" dataKey={yAxisKey} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={parsedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
              <Legend />
              <Area type="monotone" dataKey={yAxisKey} stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
            </AreaChart>
          ) : (
            <PieChart>
              <Pie data={parsedData} dataKey={yAxisKey} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={100} label>
                {parsedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
