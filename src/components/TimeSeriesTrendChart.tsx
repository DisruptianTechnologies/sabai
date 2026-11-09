import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Brush,
} from 'recharts';
import {
  calculateTrendLine,
  type ExtractedTimeSeries,
  type TrendStatistics,
  type ProcessedTimeSeriesPoint,
} from '../lib/timeSeriesDetector';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Maximize2,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Download,
  Check,
} from 'lucide-react';

interface TimeSeriesTrendChartProps {
  timeSeries: ExtractedTimeSeries;
  caption?: string;
  height?: number;
  compact?: boolean;
  onZoom?: () => void;
  className?: string;
}

export const TimeSeriesTrendChart: React.FC<TimeSeriesTrendChartProps> = ({
  timeSeries,
  caption,
  height = 360,
  compact = false,
  onZoom,
  className = '',
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string>(
    timeSeries.metricKeys[0] || ''
  );
  const [showLinearTrend, setShowLinearTrend] = useState<boolean>(true);
  const [showMovingAvg, setShowMovingAvg] = useState<boolean>(false);
  const [showReferenceMean, setShowReferenceMean] = useState<boolean>(true);
  const [projectFuture, setProjectFuture] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [showControlsMenu, setShowControlsMenu] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadedJustNow, setDownloadedJustNow] = useState<boolean>(false);
  const chartAreaRef = useRef<HTMLDivElement | null>(null);

  // Compute trend data dynamically for the selected metric
  const { chartData, stats } = useMemo(() => {
    const rawSeries = timeSeries.points.map((p) => ({
      ...p,
      label: p.label,
      value: typeof p[selectedMetric] === 'number' ? (p[selectedMetric] as number) : 0,
    }));

    const result = calculateTrendLine(rawSeries, {
      movingAvgWindow: 3,
      projectPeriods: projectFuture ? 3 : 0,
    });

    return {
      chartData: result.processedPoints,
      stats: result.stats,
    };
  }, [timeSeries, selectedMetric, projectFuture]);

  // Format tick numbers (e.g. 1500 -> 1.5k, 1200000 -> 1.2M)
  const formatNumber = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(2);
  };

  const trendIcon =
    stats.trendDirection === 'upward' ? (
      <TrendingUp className="h-4 w-4 text-emerald-600" />
    ) : stats.trendDirection === 'downward' ? (
      <TrendingDown className="h-4 w-4 text-rose-600" />
    ) : (
      <Minus className="h-4 w-4 text-neutral-500" />
    );

  const trendBadgeColor =
    stats.trendDirection === 'upward'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : stats.trendDirection === 'downward'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-neutral-100 text-neutral-700 border-neutral-200';

  const trendDescription =
    stats.trendDirection === 'upward'
      ? `Upward Trend (+${stats.percentChange.toFixed(1)}%)`
      : stats.trendDirection === 'downward'
      ? `Downward Trend (${stats.percentChange.toFixed(1)}%)`
      : 'Stable / Flat Trend';

  const handleDownloadChartPng = useCallback(async () => {
    if (!chartAreaRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const svgElement = chartAreaRef.current.querySelector('svg.recharts-surface') as SVGSVGElement | null;
      if (!svgElement) {
        setIsDownloading(false);
        return;
      }

      const bbox = svgElement.getBoundingClientRect();
      const svgW = Math.max(Math.round(bbox.width), 640);
      const svgH = Math.max(Math.round(bbox.height), 320);

      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('width', String(svgW));
      clonedSvg.setAttribute('height', String(svgH));

      const svgXml = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const scale = 2;
      const padX = 32;
      const headerH = 92;
      const footerH = 44;
      const canvasW = (svgW + padX * 2) * scale;
      const canvasH = (headerH + svgH + footerH) * scale;

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        setIsDownloading(false);
        return;
      }

      ctx.scale(scale, scale);
      const logicalW = svgW + padX * 2;
      const logicalH = headerH + svgH + footerH;

      // White card background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Top brand accent bar
      const grad = ctx.createLinearGradient(0, 0, logicalW, 0);
      grad.addColorStop(0, '#2563eb');
      grad.addColorStop(0.5, '#f59e0b');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, logicalW, 4);

      // Title & Caption
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(timeSeries.title || 'Time-Series Chart', padX, 34);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      const subText = caption || `Metric: ${selectedMetric} · ${trendDescription} · R² = ${stats.rSquared}`;
      ctx.fillText(subText.slice(0, 95), padX, 54);

      // Stats summary strip
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px monospace';
      const statsLine = `Slope: ${stats.slope >= 0 ? '+' : ''}${formatNumber(stats.slope)}/period   |   R²: ${stats.rSquared}   |   Range: ${formatNumber(stats.min)} – ${formatNumber(stats.max)}   |   Mean: ${formatNumber(stats.mean)}`;
      ctx.fillText(statsLine, padX, 76);

      // Divider line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, headerH - 6);
      ctx.lineTo(logicalW - padX, headerH - 6);
      ctx.stroke();

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, padX, headerH, svgW, svgH);
          resolve();
        };
        img.onerror = reject;
        img.src = svgUrl;
      });

      URL.revokeObjectURL(svgUrl);

      // Legend & Footer
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(padX, headerH + svgH + 8);
      ctx.lineTo(logicalW - padX, headerH + svgH + 8);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.fillText(
        `SABAI Foundation · Data Storytelling & Civic BI · Actual (${selectedMetric}) + OLS Linear Trend`,
        padX,
        headerH + svgH + 28
      );

      const safeFileName = (timeSeries.title || 'chart')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safeFileName || 'chart'}_${selectedMetric.toLowerCase()}.png`;
      a.click();

      setDownloadedJustNow(true);
      setTimeout(() => setDownloadedJustNow(false), 2000);
    } catch (err) {
      console.error('Failed to download chart PNG:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, timeSeries.title, caption, selectedMetric, trendDescription, stats]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const currentPoint = payload[0]?.payload as ProcessedTimeSeriesPoint;
    const actualVal = currentPoint?.value;
    const trendVal = currentPoint?.trend;
    const movingAvgVal = currentPoint?.movingAvg;
    const isProj = currentPoint?.isProjection;
    const residual = currentPoint?.residual;
    const pctDiff = currentPoint?.percentFromTrend;

    return (
      <div className="bg-neutral-900/95 text-white p-3.5 rounded-xl shadow-xl border border-neutral-700 text-xs min-w-[210px] backdrop-blur-sm pointer-events-none z-50">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2 font-medium text-neutral-300">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            {label}
          </span>
          {isProj && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-mono">
              Projection
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {!isProj && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Actual {selectedMetric}:
              </span>
              <span className="font-bold text-white font-mono">
                {formatNumber(actualVal)}
              </span>
            </div>
          )}

          {showLinearTrend && typeof trendVal === 'number' && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <span className="h-2 w-2 rounded-xs bg-rose-500" />
                Linear Trend:
              </span>
              <span className="font-bold text-rose-400 font-mono">
                {formatNumber(trendVal)}
              </span>
            </div>
          )}

          {showMovingAvg && typeof movingAvgVal === 'number' && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                3-Period SMA:
              </span>
              <span className="font-bold text-emerald-400 font-mono">
                {formatNumber(movingAvgVal)}
              </span>
            </div>
          )}

          {!isProj && typeof residual === 'number' && showLinearTrend && (
            <div className="border-t border-neutral-800 pt-1.5 mt-1.5 flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Trend Variance:</span>
              <span
                className={`font-mono font-semibold ${
                  residual >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {residual >= 0 ? `+${formatNumber(residual)}` : formatNumber(residual)}
                {typeof pctDiff === 'number' && ` (${pctDiff >= 0 ? '+' : ''}${pctDiff}%)`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const chartId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  return (
    <div
      className={`flex flex-col bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs hover:border-neutral-300 transition ${className}`}
    >
      {/* Header bar with title, trend indicator, and action buttons */}
      <div className="px-5 py-3.5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2.5 bg-neutral-50/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70 text-io-blue shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-neutral-900 text-sm truncate flex items-center gap-2">
              <span>{timeSeries.title}</span>
              <span className="hidden sm:inline-block text-[11px] font-normal text-neutral-400">
                (Time-Series Trend)
              </span>
            </h3>
            {caption && (
              <p className="text-xs text-neutral-500 truncate">{caption}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Trend status badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 ${trendBadgeColor}`}
            title={`Slope: ${stats.slope.toFixed(2)} / period · R²: ${stats.rSquared}`}
          >
            {trendIcon}
            <span>{trendDescription}</span>
          </div>

          {/* Metric Selector if multiple metrics */}
          {timeSeries.metricKeys.length > 1 && (
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="text-xs border border-neutral-200 bg-white rounded-lg px-2.5 py-1 text-neutral-700 font-medium outline-none focus:border-io-blue cursor-pointer"
            >
              {timeSeries.metricKeys.map((k) => (
                <option key={k} value={k}>
                  Metric: {k}
                </option>
              ))}
            </select>
          )}

          {/* Controls toggle button */}
          <button
            type="button"
            onClick={() => setShowControlsMenu(!showControlsMenu)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
              showControlsMenu
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
            title="Trend Visualization Options"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Options</span>
          </button>

          {/* Download Chart PNG Button */}
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadChartPng}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            title="Download current chart visualization as PNG"
          >
            {downloadedJustNow ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Saved PNG</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-io-blue" />
                <span>Download Chart</span>
              </>
            )}
          </button>

          {onZoom && (
            <button
              type="button"
              onClick={onZoom}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition cursor-pointer shrink-0"
              title="Expand Chart"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Controls & Analysis Toolbar */}
      {showControlsMenu && (
        <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-neutral-700 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-io-blue" />
              Trend Features:
            </span>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLinearTrend}
                onChange={(e) => setShowLinearTrend(e.target.checked)}
                className="rounded text-io-blue focus:ring-blue-400 h-3.5 w-3.5"
              />
              <span className="font-medium">Linear Trend Line (OLS)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showMovingAvg}
                onChange={(e) => setShowMovingAvg(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-400 h-3.5 w-3.5"
              />
              <span className="font-medium">Moving Average (SMA)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showReferenceMean}
                onChange={(e) => setShowReferenceMean(e.target.checked)}
                className="rounded text-neutral-600 focus:ring-neutral-400 h-3.5 w-3.5"
              />
              <span className="font-medium">Average Baseline</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={projectFuture}
                onChange={(e) => setProjectFuture(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-400 h-3.5 w-3.5"
              />
              <span className="font-medium">Forecast +3 Periods</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-neutral-200">
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition ${
                chartType === 'line'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition ${
                chartType === 'area'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Area
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition ${
                chartType === 'bar'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Bar
            </button>
          </div>
        </div>
      )}

      {/* Trend Summary Analytics strip */}
      {!compact && (
        <div className="px-5 py-2.5 bg-blue-50/30 border-b border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-neutral-400 font-mono uppercase">Rate of Change</span>
            <p className="font-semibold text-neutral-800">
              {stats.slope > 0 ? `+${formatNumber(stats.slope)}` : formatNumber(stats.slope)}{' '}
              <span className="font-normal text-neutral-500">/ period</span>
            </p>
          </div>
          <div>
            <span className="text-neutral-400 font-mono uppercase">Goodness of Fit (R²)</span>
            <p className="font-semibold text-neutral-800 flex items-center gap-1">
              <span>{stats.rSquared}</span>
              <span className="text-[10px] text-neutral-500">
                ({stats.rSquared >= 0.7 ? 'Strong' : stats.rSquared >= 0.4 ? 'Moderate' : 'Diffused'})
              </span>
            </p>
          </div>
          <div>
            <span className="text-neutral-400 font-mono uppercase">Observed Range</span>
            <p className="font-semibold text-neutral-800">
              {formatNumber(stats.min)} - {formatNumber(stats.max)}
            </p>
          </div>
          <div>
            <span className="text-neutral-400 font-mono uppercase">Mean Baseline</span>
            <p className="font-semibold text-neutral-800">{formatNumber(stats.mean)}</p>
          </div>
        </div>
      )}

      {/* Main Recharts Area */}
      <div ref={chartAreaRef} className="p-4 flex-1 w-full" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={chartData}
            margin={{ top: 15, right: 25, left: 0, bottom: chartData.length > 8 ? 20 : 5 }}
          >
            <defs>
              <linearGradient id={`gradientActual-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
            />

            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tickFormatter={formatNumber}
              domain={['auto', 'auto']}
              width={48}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              height={32}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
            />

            {/* Mean Reference Line */}
            {showReferenceMean && stats.mean !== undefined && (
              <ReferenceLine
                y={stats.mean}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: `Mean (${formatNumber(stats.mean)})`,
                  position: 'insideBottomRight',
                  fill: '#64748b',
                  fontSize: 10,
                }}
              />
            )}

            {/* Actual Series: Area / Line / Bar */}
            {chartType === 'area' && (
              <Area
                type="monotone"
                dataKey="value"
                name={`Actual ${selectedMetric}`}
                stroke="#3b82f6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#gradientActual-${chartId})`}
                dot={{ r: 3, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#1d4ed8' }}
              />
            )}

            {chartType === 'line' && (
              <Line
                type="monotone"
                dataKey="value"
                name={`Actual ${selectedMetric}`}
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#1d4ed8' }}
              />
            )}

            {chartType === 'bar' && (
              <Bar
                dataKey="value"
                name={`Actual ${selectedMetric}`}
                fill="#93c5fd"
                radius={[4, 4, 0, 0]}
              />
            )}

            {/* Automatic Linear Regression Trend Line */}
            {showLinearTrend && (
              <Line
                type="linear"
                dataKey="trend"
                name={`Trend Line (m=${stats.slope >= 0 ? '+' : ''}${formatNumber(stats.slope)})`}
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#ef4444' }}
              />
            )}

            {/* Moving Average Line */}
            {showMovingAvg && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                name="3-Period Moving Avg"
                stroke="#10b981"
                strokeDasharray="3 3"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#10b981' }}
              />
            )}

            {/* Brush for long datasets */}
            {chartData.length > 8 && (
              <Brush
                dataKey="label"
                height={22}
                stroke="#cbd5e1"
                fill="#f8fafc"
                startIndex={0}
                endIndex={chartData.length - 1}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Explanatory footer note */}
      <div className="px-5 py-2.5 bg-neutral-50/60 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Info className="h-3 w-3 text-neutral-400" />
          Linear trend calculated via Ordinary Least Squares (OLS) regression over {timeSeries.points.length} periods.
        </span>
        <span className="font-mono text-neutral-400">Recharts Time-Series Engine</span>
      </div>
    </div>
  );
};
