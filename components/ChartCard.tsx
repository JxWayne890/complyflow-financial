import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const COLORS = {
  primary: '#1e3a5f',
  secondary: '#c9953c',
  accent1: '#2d7d9a',
  accent2: '#5b8c5a',
  accent3: '#9b3d3d',
  accent4: '#6b5b95',
  accent5: '#e8a838',
  accent6: '#3a7ca5',
};

const PALETTE = [
  COLORS.primary, COLORS.secondary, COLORS.accent1, COLORS.accent2,
  COLORS.accent3, COLORS.accent4, COLORS.accent5, COLORS.accent6,
];

const GRADIENT_PAIRS = [
  { start: '#1e3a5f', end: '#2d5a87' },
  { start: '#c9953c', end: '#d4a94e' },
  { start: '#2d7d9a', end: '#3a9cb8' },
  { start: '#5b8c5a', end: '#6fa06e' },
  { start: '#9b3d3d', end: '#b85555' },
  { start: '#6b5b95', end: '#8474ad' },
];

export const getChartHeight = (data: any) => (
  data?.type === 'horizontalBar'
    ? Math.max(320, (data.data?.length || 5) * 58)
    : 380
);

export const getChartMinimumWidth = (data: any) => {
  switch (data?.type) {
    case 'horizontalBar': return 720;
    case 'pie': return 360;
    default: return 520;
  }
};

const validateChartData = (data: any): any | null => {
  if (!data) return null;
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const validTypes = ['bar', 'stackedBar', 'horizontalBar', 'areaLine', 'multiLine', 'line', 'pie'];
  const type = validTypes.includes(data.type) ? data.type : 'bar';
  const cleanData = data.data
    .filter((d: any) => d && typeof d.name === 'string' && d.name.trim() !== '')
    .map((d: any) => ({
      ...d,
      value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0,
      ...(d.value2 !== undefined ? { value2: typeof d.value2 === 'number' ? d.value2 : parseFloat(d.value2) || 0 } : {}),
      ...(d.value3 !== undefined ? { value3: typeof d.value3 === 'number' ? d.value3 : parseFloat(d.value3) || 0 } : {}),
    }));
  if (cleanData.length === 0) return null;
  return { ...data, type, data: cleanData };
};

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  fontSize: '12px',
  padding: '8px 12px',
};

const formatValue = (v: number, isPercent?: boolean) =>
  isPercent ? `${v}%` : v.toLocaleString();

const ChartCard: React.FC<{ data: any; inline?: boolean }> = ({ data: rawData, inline = false }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const chartInstanceIdRef = useRef(`chart-${Math.random().toString(36).slice(2, 10)}`);

  const data = validateChartData(rawData);
  const minimumWidth = getChartMinimumWidth(data);
  const chartHeight = getChartHeight(data);
  const lastValidWidthRef = useRef(minimumWidth);
  const [viewportWidth, setViewportWidth] = useState(minimumWidth);

  useEffect(() => {
    lastValidWidthRef.current = Math.max(lastValidWidthRef.current, minimumWidth);
    setViewportWidth((prev) => Math.max(prev, minimumWidth));
  }, [minimumWidth]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const updateWidth = () => {
      const measuredWidth = Math.floor(node.getBoundingClientRect().width);
      if (measuredWidth >= 240) {
        lastValidWidthRef.current = measuredWidth;
        setViewportWidth((prev) => (prev === measuredWidth ? prev : measuredWidth));
        return;
      }
      if (lastValidWidthRef.current > 0) {
        setViewportWidth((prev) => (prev === lastValidWidthRef.current ? prev : lastValidWidthRef.current));
      }
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => { window.removeEventListener('resize', updateWidth); };
    }
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = window.requestAnimationFrame(updateWidth);
    });
    resizeObserver.observe(node);
    return () => {
      resizeObserver.disconnect();
      if (resizeFrameRef.current !== null) { window.cancelAnimationFrame(resizeFrameRef.current); resizeFrameRef.current = null; }
    };
  }, [minimumWidth]);

  if (!data) return null;

  const renderWidth = Math.max(viewportWidth, minimumWidth);
  const isPercent = data.yAxisPercent || data.dataLabel?.includes('%') || data.type === 'stackedBar' || data.type === 'areaLine' || data.type === 'multiLine';
  const areaFillId = `${chartInstanceIdRef.current}-area`;
  const mlFill1 = `${chartInstanceIdRef.current}-ml1`;
  const mlFill2 = `${chartInstanceIdRef.current}-ml2`;
  const mlFill3 = `${chartInstanceIdRef.current}-ml3`;
  const barGradients = PALETTE.map((_, i) => `${chartInstanceIdRef.current}-bar-${i}`);

  const renderChart = () => {
    switch (data.type) {
      case 'stackedBar':
        return (
          <BarChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <defs>{PALETTE.map((_, i) => (<linearGradient key={i} id={barGradients[i]} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].end} stopOpacity={1} /><stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].start} stopOpacity={0.9} /></linearGradient>))}</defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => formatValue(v, true)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatValue(value, true)} />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 500 }} />
            {(data.stackKeys || ['value', 'value2', 'value3']).map((key: string, i: number) => (
              <Bar key={key} dataKey={key} stackId="a" fill={`url(#${barGradients[i]})`} radius={i === (data.stackKeys || ['value', 'value2', 'value3']).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} name={data.stackLabels?.[i] || key} />
            ))}
          </BarChart>
        );
      case 'horizontalBar':
        return (
          <BarChart width={renderWidth} height={chartHeight} data={data.data} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
            <defs>{PALETTE.map((_, i) => (<linearGradient key={i} id={`${chartInstanceIdRef.current}-hbar-${i}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].start} stopOpacity={0.85} /><stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].end} stopOpacity={1} /></linearGradient>))}</defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 500 }} width={160} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} name={data.dataLabel || 'Value'} barSize={28}>
              {(data.data || []).map((_entry: any, index: number) => (<Cell key={`cell-${index}`} fill={`url(#${chartInstanceIdRef.current}-hbar-${index % PALETTE.length})`} />))}
            </Bar>
          </BarChart>
        );
      case 'areaLine':
        return (
          <AreaChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <defs><linearGradient id={areaFillId} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} /><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => formatValue(v, isPercent)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatValue(value, isPercent)} />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 500 }} />
            <Area type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2.5} fill={`url(#${areaFillId})`} dot={{ r: 4, fill: COLORS.primary, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, stroke: COLORS.primary, strokeWidth: 2, fill: '#fff' }} name={data.dataLabel || 'Value'} />
            {data.dataKey2 && <Area type="monotone" dataKey="value2" stroke={COLORS.secondary} strokeWidth={2.5} fill="transparent" dot={{ r: 4, fill: COLORS.secondary, strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel2 || 'Value 2'} />}
            {data.dataKey3 && <Area type="monotone" dataKey="value3" stroke={COLORS.accent2} strokeWidth={2.5} fill="transparent" dot={{ r: 4, fill: COLORS.accent2, strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel3 || 'Value 3'} />}
          </AreaChart>
        );
      case 'multiLine':
        return (
          <AreaChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <defs>
              <linearGradient id={mlFill1} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} /><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.01} /></linearGradient>
              <linearGradient id={mlFill2} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.15} /><stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.01} /></linearGradient>
              <linearGradient id={mlFill3} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.accent2} stopOpacity={0.15} /><stop offset="95%" stopColor={COLORS.accent2} stopOpacity={0.01} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => formatValue(v, isPercent)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatValue(value, isPercent)} />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 500 }} />
            <Area type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2.5} fill={`url(#${mlFill1})`} dot={{ r: 4, fill: COLORS.primary, strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel || 'Series 1'} />
            {data.dataKey2 && <Area type="monotone" dataKey="value2" stroke={COLORS.secondary} strokeWidth={2.5} fill={`url(#${mlFill2})`} dot={{ r: 4, fill: COLORS.secondary, strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel2 || 'Series 2'} />}
            {data.dataKey3 && <Area type="monotone" dataKey="value3" stroke={COLORS.accent2} strokeWidth={2.5} fill={`url(#${mlFill3})`} dot={{ r: 4, fill: COLORS.accent2, strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel3 || 'Series 3'} />}
          </AreaChart>
        );
      case 'line':
        return (
          <LineChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={isPercent ? ((v: number) => `${v}%`) : undefined} />
            <Tooltip contentStyle={tooltipStyle} formatter={isPercent ? ((value: number) => `${value}%`) : undefined} />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 500 }} />
            <Line type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.primary, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, stroke: COLORS.primary, strokeWidth: 2, fill: '#fff' }} name={data.dataLabel || 'Value'} />
            {data.dataKey2 && <Line type="monotone" dataKey="value2" stroke={COLORS.secondary} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.secondary, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name={data.dataLabel2 || 'Value 2'} />}
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart width={renderWidth} height={chartHeight}>
            <defs>{PALETTE.map((_, i) => (<linearGradient key={i} id={`${chartInstanceIdRef.current}-pie-${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].end} stopOpacity={1} /><stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].start} stopOpacity={0.85} /></linearGradient>))}</defs>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
            <Pie data={data.data} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={4} dataKey="value" strokeWidth={2} stroke="#fff">
              {(data.data || []).map((_entry: any, index: number) => (<Cell key={`cell-${index}`} fill={`url(#${chartInstanceIdRef.current}-pie-${index % PALETTE.length})`} />))}
            </Pie>
          </PieChart>
        );
      default:
        return (
          <BarChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <defs>{PALETTE.map((_, i) => (<linearGradient key={i} id={barGradients[i]} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].end} stopOpacity={1} /><stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length].start} stopOpacity={0.85} /></linearGradient>))}</defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={isPercent ? ((v: number) => `${v}%`) : undefined} />
            <Tooltip cursor={{ fill: 'rgba(30, 58, 95, 0.04)' }} contentStyle={tooltipStyle} formatter={isPercent ? ((value: number) => `${value}%`) : undefined} />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 500 }} />
            <Bar dataKey="value" fill={`url(#${barGradients[0]})`} radius={[6, 6, 0, 0]} name={data.dataLabel || 'Value'} barSize={data.data.length <= 4 ? 48 : undefined} />
            {data.dataKey2 && <Bar dataKey="value2" fill={`url(#${barGradients[1]})`} radius={[6, 6, 0, 0]} name={data.dataLabel2 || 'Value 2'} barSize={data.data.length <= 4 ? 48 : undefined} />}
          </BarChart>
        );
    }
  };

  return (
    <div
      className={inline ? 'not-prose my-10' : 'shrink-0 mt-12 pt-8 border-t border-slate-100'}
      contentEditable={false}
      suppressContentEditableWarning
    >
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '3px', height: '20px', borderRadius: '2px', background: 'linear-gradient(180deg, #1e3a5f 0%, #2d7d9a 100%)' }} />
            <h3 style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              {data.title || 'Data Overview'}
            </h3>
          </div>
          {data.subtitle && (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '6px 0 0 11px', lineHeight: 1.5 }}>
              {data.subtitle}
            </p>
          )}
        </div>
        <div className="overflow-x-auto overflow-y-hidden" style={{ margin: '0 -8px' }}>
          <div ref={viewportRef} className="w-full min-w-0">
            <div style={{ width: `${renderWidth}px`, minWidth: `${minimumWidth}px`, height: `${chartHeight}px` }}>
              {renderChart()}
            </div>
          </div>
        </div>
        {data.source && (
          <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic', margin: 0, lineHeight: 1.6, letterSpacing: '0.01em' }}>
              {data.source}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartCard;
