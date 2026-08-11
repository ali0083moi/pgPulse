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
import { BarChart2, PieChart as PieIcon, TrendingUp, Layers, Calculator, Hash, Activity } from 'lucide-react';

interface DataChartProps {
  rows: any[];
  columns: Array<{ name: string }>;
}

const PALETTE = ['#58A6FF', '#3FB950', '#D29922', '#F85149', '#A371F7', '#79C0FF', '#56D364', '#E3B341'];

export const DataChart: React.FC<DataChartProps> = ({ rows, columns }) => {
  const columnNames = useMemo(() => columns.map((c) => c.name), [columns]);

  const [xAxisKey, setXAxisKey] = useState<string>('');
  const [yAxisKey, setYAxisKey] = useState<string>('');
  const [aggregation, setAggregation] = useState<'auto' | 'sum' | 'avg' | 'count' | 'max' | 'min' | 'raw'>('auto');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');

  // Smart Auto-Selection of X and Y axes
  useEffect(() => {
    if (columnNames.length === 0 || rows.length === 0) return;

    // Smart X-axis choice: Date/Time > Name/Title/Type/Status > First non-numeric
    const dateCol = columnNames.find((col) =>
      /date|time|created|updated|month|year|day/i.test(col)
    );
    const categoryCol = columnNames.find((col) =>
      /name|title|type|status|category|role|group|schema|table/i.test(col)
    );
    const firstCol = dateCol || categoryCol || columnNames[0];
    setXAxisKey(firstCol);

    // Smart Y-axis choice: Metric/Amount/Price/Size/Count > First numeric column (excluding id/uuid)
    const metricCol = columnNames.find((col) =>
      /price|amount|total|count|sum|size|score|val|num|duration|capacity/i.test(col)
    );

    const numericCol = columnNames.find((col) => {
      if (col.toLowerCase() === 'id' || col.toLowerCase().includes('uuid')) return false;
      return rows.some((r) => r[col] !== null && r[col] !== undefined && !isNaN(Number(r[col])));
    });

    const anyNumericCol = columnNames.find((col) =>
      rows.some((r) => r[col] !== null && r[col] !== undefined && !isNaN(Number(r[col])))
    );

    setYAxisKey(metricCol || numericCol || anyNumericCol || columnNames[1] || columnNames[0]);
  }, [columnNames, rows]);

  // Is Y-axis currently numeric?
  const isYNumeric = useMemo(() => {
    if (!yAxisKey || !rows.length) return false;
    return rows.some((r) => r[yAxisKey] !== null && r[yAxisKey] !== undefined && !isNaN(Number(r[yAxisKey])));
  }, [rows, yAxisKey]);

  // Automatically determine best aggregation mode
  const activeAgg = useMemo(() => {
    if (aggregation !== 'auto' as any) return aggregation;
    if (!isYNumeric) return 'count';
    // If X has duplicate entries, group by sum
    const xValues = rows.map((r) => r[xAxisKey]);
    const hasDuplicates = new Set(xValues).size < xValues.length;
    return hasDuplicates ? 'sum' : 'raw';
  }, [aggregation, isYNumeric, rows, xAxisKey]);

  // Process & Aggregate Data
  const chartData = useMemo(() => {
    if (!rows.length || !xAxisKey) return [];

    if (activeAgg === 'raw') {
      return rows.map((r) => ({
        ...r,
        [xAxisKey]: r[xAxisKey] === null || r[xAxisKey] === undefined ? 'null' : String(r[xAxisKey]),
        [yAxisKey]: r[yAxisKey] !== null && !isNaN(Number(r[yAxisKey])) ? Number(r[yAxisKey]) : 0,
      }));
    }

    // Perform Group-By Aggregation on X-Axis
    const groups = new Map<string, number[]>();

    rows.forEach((r) => {
      const rawX = r[xAxisKey];
      const groupKey = rawX === null || rawX === undefined ? 'null' : String(rawX);
      const rawY = Number(r[yAxisKey]);
      const val = !isNaN(rawY) ? rawY : 1;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(val);
    });

    const aggregatedResult: any[] = [];

    groups.forEach((vals, category) => {
      let finalVal = 0;
      if (activeAgg === 'count') {
        finalVal = vals.length;
      } else if (activeAgg === 'sum') {
        finalVal = vals.reduce((a, b) => a + b, 0);
      } else if (activeAgg === 'avg') {
        finalVal = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      } else if (activeAgg === 'max') {
        finalVal = Math.max(...vals);
      } else if (activeAgg === 'min') {
        finalVal = Math.min(...vals);
      }

      aggregatedResult.push({
        [xAxisKey]: category,
        [yAxisKey || 'count']: finalVal,
      });
    });

    return aggregatedResult.slice(0, 50); // Limit to top 50 categories for clean visualization
  }, [rows, xAxisKey, yAxisKey, activeAgg]);

  // KPI Statistics
  const kpis = useMemo(() => {
    if (!rows.length) return null;

    const totalRows = rows.length;
    const distinctCategories = new Set(rows.map((r) => r[xAxisKey])).size;

    let metricSum = 0;
    let metricAvg = 0;
    let numericCount = 0;

    if (isYNumeric) {
      const nums = rows.map((r) => Number(r[yAxisKey])).filter((n) => !isNaN(n));
      numericCount = nums.length;
      metricSum = nums.reduce((a, b) => a + b, 0);
      metricAvg = nums.length ? Number((metricSum / nums.length).toFixed(2)) : 0;
    }

    return {
      totalRows,
      distinctCategories,
      metricSum: Number(metricSum.toFixed(2)),
      metricAvg,
      numericCount,
    };
  }, [rows, xAxisKey, yAxisKey, isYNumeric]);

  if (rows.length === 0 || columnNames.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#8B949E] text-xs font-medium space-y-2">
        <Activity className="w-8 h-8 text-[#484F58] animate-pulse" />
        <p>No query data available to chart. Run a SQL query to visualize insights.</p>
      </div>
    );
  }

  const metricLabel = activeAgg === 'count' ? 'Count (*)' : yAxisKey;

  return (
    <div className="flex flex-col h-full space-y-3 font-sans">
      {/* Smart KPI Summary Bar */}
      {kpis && (
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="p-2 rounded-xl bg-[#0D1117] border border-[#30363D] flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1F6FEB]/15 text-[#58A6FF]">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-[#8B949E] uppercase font-bold tracking-wider">Total Rows</div>
              <div className="text-xs font-mono font-bold text-[#F0F6FC]">{kpis.totalRows}</div>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#0D1117] border border-[#30363D] flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D29922]/15 text-[#D29922]">
              <Hash className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-[#8B949E] uppercase font-bold tracking-wider">Categories</div>
              <div className="text-xs font-mono font-bold text-[#F0F6FC]">{kpis.distinctCategories}</div>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#0D1117] border border-[#30363D] flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#3FB950]/15 text-[#3FB950]">
              <Calculator className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-[#8B949E] uppercase font-bold tracking-wider">
                {activeAgg === 'count' ? 'Total Count' : 'Metric Sum'}
              </div>
              <div className="text-xs font-mono font-bold text-[#F0F6FC]">
                {activeAgg === 'count' ? kpis.totalRows : kpis.metricSum}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Config Controls Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0D1117] p-2.5 rounded-xl border border-[#30363D] text-xs shrink-0">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#8B949E] uppercase">Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as any)}
            className="w-full px-2 py-1 rounded bg-[#161B22] border border-[#30363D] text-[#58A6FF] font-semibold focus:outline-none cursor-pointer"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="area">Area Chart</option>
            <option value="pie">Pie Chart</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#8B949E] uppercase">X-Axis (Group By)</label>
          <select
            value={xAxisKey}
            onChange={(e) => setXAxisKey(e.target.value)}
            className="w-full px-2 py-1 rounded bg-[#161B22] border border-[#30363D] text-[#C9D1D9] font-mono focus:outline-none cursor-pointer"
          >
            {columnNames.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#8B949E] uppercase">Y-Axis (Measure)</label>
          <select
            value={yAxisKey}
            onChange={(e) => setYAxisKey(e.target.value)}
            className="w-full px-2 py-1 rounded bg-[#161B22] border border-[#30363D] text-[#C9D1D9] font-mono focus:outline-none cursor-pointer"
          >
            {columnNames.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#8B949E] uppercase">Aggregation</label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as any)}
            className="w-full px-2 py-1 rounded bg-[#161B22] border border-[#30363D] text-[#D29922] font-semibold focus:outline-none cursor-pointer"
          >
            <option value="auto">⚡ Smart Auto</option>
            <option value="count">COUNT (*)</option>
            <option value="sum">SUM</option>
            <option value="avg">AVERAGE</option>
            <option value="max">MAX</option>
            <option value="min">MIN</option>
            <option value="raw">RAW DATA</option>
          </select>
        </div>
      </div>

      {/* Render Chart Workspace */}
      <div className="flex-1 min-h-[260px] w-full bg-[#0D1117] p-3 rounded-xl border border-[#30363D] relative overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
              <XAxis dataKey={xAxisKey} stroke="#8B949E" fontSize={11} tickLine={false} />
              <YAxis stroke="#8B949E" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161B22',
                  borderColor: '#30363D',
                  borderRadius: '8px',
                  color: '#F0F6FC',
                  fontSize: '12px',
                  fontFamily: 'Fira Code, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#C9D1D9' }} />
              <Bar dataKey={metricLabel} fill="#58A6FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
              <XAxis dataKey={xAxisKey} stroke="#8B949E" fontSize={11} tickLine={false} />
              <YAxis stroke="#8B949E" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161B22',
                  borderColor: '#30363D',
                  borderRadius: '8px',
                  color: '#F0F6FC',
                  fontSize: '12px',
                  fontFamily: 'Fira Code, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#C9D1D9' }} />
              <Line type="monotone" dataKey={metricLabel} stroke="#3FB950" strokeWidth={2.5} dot={{ r: 4, fill: '#3FB950' }} />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
              <XAxis dataKey={xAxisKey} stroke="#8B949E" fontSize={11} tickLine={false} />
              <YAxis stroke="#8B949E" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161B22',
                  borderColor: '#30363D',
                  borderRadius: '8px',
                  color: '#F0F6FC',
                  fontSize: '12px',
                  fontFamily: 'Fira Code, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#C9D1D9' }} />
              <Area type="monotone" dataKey={metricLabel} stroke="#58A6FF" fill="#58A6FF" fillOpacity={0.25} />
            </AreaChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={metricLabel}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={35}
                paddingAngle={2}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161B22',
                  borderColor: '#30363D',
                  borderRadius: '8px',
                  color: '#F0F6FC',
                  fontSize: '12px',
                  fontFamily: 'Fira Code, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#C9D1D9' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
