/**
 * Utility functions for detecting time-series data in tables and charts,
 * parsing time-series sequences, and calculating automatic trend lines
 * (Ordinary Least Squares linear regression, moving averages, forecasting, and correlation).
 */

import type { ReportTable, ReportChart } from '../types';

export interface TrendStatistics {
  slope: number;
  intercept: number;
  rSquared: number;
  trendDirection: 'upward' | 'downward' | 'neutral';
  percentChange: number;
  actualChange: number;
  startValue: number;
  endValue: number;
  trendStart: number;
  trendEnd: number;
  mean: number;
  min: number;
  max: number;
  standardError: number;
  isReliable: boolean;
}

export interface ProcessedTimeSeriesPoint {
  index: number;
  label: string;
  rawValue?: any;
  value: number;
  trend?: number;
  movingAvg?: number;
  projectedTrend?: number;
  isProjection?: boolean;
  residual?: number;
  percentFromTrend?: number;
  [key: string]: any;
}

export interface ExtractedTimeSeries {
  title: string;
  timeKey: string;
  metricKeys: string[];
  points: ProcessedTimeSeriesPoint[];
  statsByMetric: Record<string, TrendStatistics>;
}

// Regex to identify time/temporal column names
const TIME_COLUMN_REGEX = /(date|time|timestamp|year|month|day|quarter|period|week|datetime|hour|step|epoch|fy|qtr|yr)/i;

// Regex to identify date/year/month-like values
const YEAR_REGEX = /^(19\d\d|20\d\d)$/;
const ISO_DATE_REGEX = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?/;
const MONTH_YEAR_REGEX = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]+\d{2,4}$/i;
const QUARTER_REGEX = /^(q[1-4][\s,-]?\d{2,4}|\d{4}[\s,-]?q[1-4])$/i;

/**
 * Determine if a column is a time/temporal dimension.
 */
export function isTemporalColumn(colName: string, sampleValues: any[] = []): boolean {
  if (TIME_COLUMN_REGEX.test(colName.trim())) {
    return true;
  }

  // Check sample values if available
  if (sampleValues && sampleValues.length > 0) {
    let matchCount = 0;
    const testCount = Math.min(sampleValues.length, 10);
    for (let i = 0; i < testCount; i++) {
      const val = sampleValues[i];
      if (val === null || val === undefined) continue;
      const str = String(val).trim();
      if (
        YEAR_REGEX.test(str) ||
        ISO_DATE_REGEX.test(str) ||
        MONTH_YEAR_REGEX.test(str) ||
        QUARTER_REGEX.test(str) ||
        (!isNaN(Date.parse(str)) && isNaN(Number(str)) && str.length > 4)
      ) {
        matchCount++;
      }
    }
    if (matchCount >= Math.max(1, Math.floor(testCount * 0.5))) {
      return true;
    }
  }

  return false;
}

/**
 * Safely parse a cell into a number if numeric.
 */
export function parseNumericValue(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val !== 'string') return null;

  // Clean strings like "$1,234.50" or "45.2%" or " 123 "
  const cleaned = val.replace(/[$€£¥,%\s]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Determine if a column is mostly numeric.
 */
export function isNumericColumn(sampleValues: any[]): boolean {
  let validCount = 0;
  let numericCount = 0;

  for (const v of sampleValues) {
    if (v === null || v === undefined || v === '') continue;
    validCount++;
    if (parseNumericValue(v) !== null) {
      numericCount++;
    }
  }

  return validCount > 0 && numericCount / validCount >= 0.7;
}

/**
 * Check if a table can be interpreted as a time-series dataset.
 */
export function isTimeSeriesTable(table: ReportTable): boolean {
  if (!table || !table.columns || table.columns.length < 2 || !table.rows || table.rows.length < 2) {
    return false;
  }

  // Look for time column
  let timeColIdx = -1;
  for (let i = 0; i < table.columns.length; i++) {
    const colName = table.columns[i];
    const samples = table.rows.slice(0, 10).map((r) => r[i]);
    if (isTemporalColumn(colName, samples)) {
      timeColIdx = i;
      break;
    }
  }

  // Fallback: check if the first column is non-numeric labels and sequential
  if (timeColIdx === -1 && table.columns.length >= 2) {
    const firstColSamples = table.rows.slice(0, 10).map((r) => r[0]);
    if (!isNumericColumn(firstColSamples)) {
      timeColIdx = 0;
    }
  }

  if (timeColIdx === -1) return false;

  // Check if there is at least one numeric metric column
  for (let i = 0; i < table.columns.length; i++) {
    if (i === timeColIdx) continue;
    const samples = table.rows.slice(0, 10).map((r) => r[i]);
    if (isNumericColumn(samples)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate Ordinary Least Squares (OLS) Linear Regression,
 * Moving Average, and summary trend statistics.
 */
export function calculateTrendLine(
  points: Array<{ label: string; value: number; [key: string]: any }>,
  options: {
    movingAvgWindow?: number;
    projectPeriods?: number;
  } = {}
): {
  processedPoints: ProcessedTimeSeriesPoint[];
  stats: TrendStatistics;
} {
  const windowSize = options.movingAvgWindow ?? Math.min(3, Math.max(2, Math.floor(points.length / 3)));
  const projectPeriods = options.projectPeriods ?? 0;

  const valid = points.filter((p) => p.value !== null && !isNaN(p.value));
  const n = valid.length;

  if (n < 2) {
    const defaultStats: TrendStatistics = {
      slope: 0,
      intercept: valid[0]?.value ?? 0,
      rSquared: 0,
      trendDirection: 'neutral',
      percentChange: 0,
      actualChange: 0,
      startValue: valid[0]?.value ?? 0,
      endValue: valid[0]?.value ?? 0,
      trendStart: valid[0]?.value ?? 0,
      trendEnd: valid[0]?.value ?? 0,
      mean: valid[0]?.value ?? 0,
      min: valid[0]?.value ?? 0,
      max: valid[0]?.value ?? 0,
      standardError: 0,
      isReliable: false,
    };
    const processed = points.map((p, i) => ({
      ...p,
      index: i,
      trend: p.value,
      movingAvg: p.value,
    }));
    return { processedPoints: processed, stats: defaultStats };
  }

  // OLS linear regression: y = m * x + b
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  const values: number[] = [];

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = valid[i].value;
    values.push(y);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  const sxx = sumXX - n * meanX * meanX;
  const sxy = sumXY - n * meanX * meanY;
  const syy = sumYY - n * meanY * meanY;

  const slope = sxx !== 0 ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;

  // Correlation & R-squared
  let rSquared = 0;
  if (sxx > 0 && syy > 0) {
    const r = sxy / Math.sqrt(sxx * syy);
    rSquared = Math.max(0, Math.min(1, r * r));
  }

  const startValue = valid[0].value;
  const endValue = valid[n - 1].value;
  const trendStart = intercept;
  const trendEnd = slope * (n - 1) + intercept;

  const actualChange = endValue - startValue;
  const percentChange =
    Math.abs(trendStart) > 1e-6
      ? ((trendEnd - trendStart) / Math.abs(trendStart)) * 100
      : trendEnd !== trendStart
      ? 100
      : 0;

  // Standard error of regression
  let ssResidual = 0;
  for (let i = 0; i < n; i++) {
    const fitted = slope * i + intercept;
    const diff = valid[i].value - fitted;
    ssResidual += diff * diff;
  }
  const standardError = n > 2 ? Math.sqrt(ssResidual / (n - 2)) : 0;

  // Trend direction classification
  let trendDirection: 'upward' | 'downward' | 'neutral' = 'neutral';
  // Consider normalized slope relative to mean
  const relativeSlope = meanY !== 0 ? Math.abs(slope / meanY) : Math.abs(slope);
  if (relativeSlope > 0.005 || Math.abs(percentChange) > 1.5) {
    if (slope > 0) trendDirection = 'upward';
    else if (slope < 0) trendDirection = 'downward';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  const stats: TrendStatistics = {
    slope,
    intercept,
    rSquared: Number(rSquared.toFixed(4)),
    trendDirection,
    percentChange: Number(percentChange.toFixed(2)),
    actualChange: Number(actualChange.toFixed(2)),
    startValue,
    endValue,
    trendStart: Number(trendStart.toFixed(2)),
    trendEnd: Number(trendEnd.toFixed(2)),
    mean: Number(meanY.toFixed(2)),
    min,
    max,
    standardError: Number(standardError.toFixed(2)),
    isReliable: rSquared >= 0.2 || Math.abs(percentChange) > 5,
  };

  // Build processed points with trend, residual, moving average
  const processedPoints: ProcessedTimeSeriesPoint[] = points.map((p, i) => {
    const fitted = slope * i + intercept;
    const roundedFitted = Number(fitted.toFixed(2));
    const residual = p.value !== null ? Number((p.value - fitted).toFixed(2)) : undefined;
    const percentFromTrend =
      fitted !== 0 && residual !== undefined ? Number(((residual / Math.abs(fitted)) * 100).toFixed(1)) : 0;

    // Moving average
    let movingAvg: number | undefined = undefined;
    if (i >= windowSize - 1) {
      let windowSum = 0;
      let count = 0;
      for (let j = 0; j < windowSize; j++) {
        const val = points[i - j]?.value;
        if (typeof val === 'number') {
          windowSum += val;
          count++;
        }
      }
      if (count === windowSize) {
        movingAvg = Number((windowSum / count).toFixed(2));
      }
    }

    return {
      ...p,
      index: i,
      trend: roundedFitted,
      movingAvg,
      residual,
      percentFromTrend,
      isProjection: false,
    };
  });

  // Optional future forecast projection
  if (projectPeriods > 0) {
    const lastLabel = points[points.length - 1]?.label || '';
    for (let k = 1; k <= projectPeriods; k++) {
      const futureIndex = points.length - 1 + k;
      const futureTrend = Number((slope * futureIndex + intercept).toFixed(2));
      processedPoints.push({
        index: futureIndex,
        label: `+${k} period`,
        rawValue: `${lastLabel} +${k}`,
        value: futureTrend,
        trend: futureTrend,
        projectedTrend: futureTrend,
        isProjection: true,
      });
    }
  }

  return { processedPoints, stats };
}

/**
 * Extract time-series data from a ReportTable.
 */
export function extractTimeSeriesFromTable(table: ReportTable): ExtractedTimeSeries | null {
  if (!isTimeSeriesTable(table)) return null;

  // Identify time column
  let timeColIdx = -1;
  for (let i = 0; i < table.columns.length; i++) {
    const colName = table.columns[i];
    const samples = table.rows.slice(0, 10).map((r) => r[i]);
    if (isTemporalColumn(colName, samples)) {
      timeColIdx = i;
      break;
    }
  }
  if (timeColIdx === -1) {
    timeColIdx = 0;
  }

  const timeColName = table.columns[timeColIdx];

  // Identify numeric metric columns
  const metricColIndices: number[] = [];
  const metricKeys: string[] = [];

  for (let i = 0; i < table.columns.length; i++) {
    if (i === timeColIdx) continue;
    const samples = table.rows.slice(0, 15).map((r) => r[i]);
    if (isNumericColumn(samples)) {
      metricColIndices.push(i);
      metricKeys.push(table.columns[i]);
    }
  }

  if (metricKeys.length === 0) return null;

  // Map rows into points
  const rawPoints: Array<{ label: string; [key: string]: any }> = table.rows
    .map((row) => {
      const label = row[timeColIdx] !== null ? String(row[timeColIdx]) : '';
      const point: Record<string, any> = { label };
      for (let m = 0; m < metricColIndices.length; m++) {
        const colIdx = metricColIndices[m];
        const key = metricKeys[m];
        point[key] = parseNumericValue(row[colIdx]);
      }
      return point as { label: string; [key: string]: any };
    })
    .filter((p) => p.label !== '');

  if (rawPoints.length < 2) return null;

  // Calculate default stats for the primary metric
  const primaryMetric = metricKeys[0];
  const primarySeries = rawPoints.map((p) => ({
    ...p,
    value: typeof p[primaryMetric] === 'number' ? p[primaryMetric] : 0,
  }));

  const { processedPoints, stats } = calculateTrendLine(primarySeries);

  const statsByMetric: Record<string, TrendStatistics> = {
    [primaryMetric]: stats,
  };

  // Precalculate stats for other metrics
  for (let i = 1; i < metricKeys.length; i++) {
    const mKey = metricKeys[i];
    const mSeries = rawPoints.map((p) => ({
      ...p,
      value: typeof p[mKey] === 'number' ? p[mKey] : 0,
    }));
    statsByMetric[mKey] = calculateTrendLine(mSeries).stats;
  }

  return {
    title: table.title,
    timeKey: timeColName,
    metricKeys,
    points: processedPoints,
    statsByMetric,
  };
}

/**
 * Match a ReportChart to an underlying time-series table in the report.
 */
export function matchChartToTimeSeriesTable(
  chart: ReportChart,
  tables: ReportTable[] = []
): ReportTable | null {
  if (!tables || tables.length === 0) return null;

  const chartTitleNorm = (chart.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const chartFileNorm = (chart.file || '')
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || '';

  // 1. Direct file or title match
  for (const table of tables) {
    if (!isTimeSeriesTable(table)) continue;
    const tableTitleNorm = table.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      tableTitleNorm === chartTitleNorm ||
      tableTitleNorm === chartFileNorm ||
      chartFileNorm.includes(tableTitleNorm) ||
      tableTitleNorm.includes(chartFileNorm)
    ) {
      return table;
    }
  }

  // 2. Token overlap match
  const chartTokens = (chart.title + ' ' + chart.file)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);

  for (const table of tables) {
    if (!isTimeSeriesTable(table)) continue;
    const tableTokens = table.title.toLowerCase().split(/[^a-z0-9]+/);
    const matches = chartTokens.filter((t) => tableTokens.includes(t));
    if (matches.length >= 1) {
      return table;
    }
  }

  // 3. If chart type is 'line' or title mentions trend/time, pick first available time series table
  const isTrendChart =
    chart.type === 'line' ||
    /(trend|time|growth|monthly|yearly|daily|progress|history|over time)/i.test(chart.title + ' ' + (chart.caption || ''));
  if (isTrendChart) {
    const firstTimeSeries = tables.find(isTimeSeriesTable);
    if (firstTimeSeries) return firstTimeSeries;
  }

  return null;
}
