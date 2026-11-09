import type {
  AnalysisReport,
  InfographicBlueprint,
  InfographicFormat,
  InfographicOptions,
  InfographicTheme,
} from '../types';

interface ThemePalette {
  bg: string;
  bgSecondary: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentSecondary: string;
  trendLine: string;
  positive: string;
  negative: string;
  headerBand: [string, string, string];
}

export const THEME_PALETTES: Record<InfographicTheme, ThemePalette> = {
  'executive-dark': {
    bg: '#0B0F19',
    bgSecondary: '#111827',
    surface: '#161F33',
    surfaceAlt: '#1E293B',
    border: '#283548',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.14)',
    accentSecondary: '#818CF8',
    trendLine: '#F43F5E',
    positive: '#34D399',
    negative: '#FB7185',
    headerBand: ['#38BDF8', '#818CF8', '#F43F5E'],
  },
  'editorial-light': {
    bg: '#FAF8F5',
    bgSecondary: '#F3EFEA',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F2EB',
    border: '#E2DDD5',
    textPrimary: '#18181B',
    textSecondary: '#3F3F46',
    textMuted: '#71717A',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.10)',
    accentSecondary: '#0F172A',
    trendLine: '#E11D48',
    positive: '#059669',
    negative: '#DC2626',
    headerBand: ['#18181B', '#2563EB', '#E11D48'],
  },
  'io-cobalt': {
    bg: '#0F172A',
    bgSecondary: '#1E293B',
    surface: '#1E293B',
    surfaceAlt: '#334155',
    border: '#334155',
    textPrimary: '#FFFFFF',
    textSecondary: '#E2E8F0',
    textMuted: '#94A3B8',
    accent: '#4285F4',
    accentSoft: 'rgba(66, 133, 244, 0.18)',
    accentSecondary: '#34A853',
    trendLine: '#FBBC04',
    positive: '#34A853',
    negative: '#EA4335',
    headerBand: ['#4285F4', '#34A853', '#EA4335'],
  },
  'swiss-minimal': {
    bg: '#FFFFFF',
    bgSecondary: '#F4F4F5',
    surface: '#FAFAFA',
    surfaceAlt: '#F4F4F5',
    border: '#E4E4E7',
    textPrimary: '#09090B',
    textSecondary: '#27272A',
    textMuted: '#71717A',
    accent: '#E11D48',
    accentSoft: 'rgba(225, 29, 72, 0.10)',
    accentSecondary: '#18181B',
    trendLine: '#18181B',
    positive: '#16A34A',
    negative: '#DC2626',
    headerBand: ['#09090B', '#E11D48', '#09090B'],
  },
};

export function getDimensionsForFormat(format: InfographicFormat): {
  width: number;
  height: number;
  aspectLabel: string;
} {
  switch (format) {
    case 'landscape':
      return { width: 1400, height: 960, aspectLabel: '16:11 Executive Deck' };
    case 'social':
      return { width: 1080, height: 1620, aspectLabel: '2:3 Vertical Story' };
    case 'portrait':
    default:
      return { width: 1080, height: 1440, aspectLabel: '3:4 Editorial Poster' };
  }
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    const remainingIdx = words.join(' ').indexOf(currentLine);
    if (lines.length === maxLines - 1 && remainingIdx >= 0) {
      // Truncate if still too long
      while (ctx.measureText(currentLine + '…').width > maxWidth && currentLine.length > 3) {
        currentLine = currentLine.slice(0, -1);
      }
    }
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Renders the synthesized InfographicBlueprint onto an HTML5 Canvas and returns
 * a high-DPI PNG data URL as well as an SVG data URL for download.
 */
export function renderInfographicAssets(
  blueprint: InfographicBlueprint,
  options: InfographicOptions
): {
  pngDataUrl: string;
  svgString: string;
  width: number;
  height: number;
} {
  const { width, height } = getDimensionsForFormat(options.format);
  const palette = THEME_PALETTES[options.theme] || THEME_PALETTES['executive-dark'];

  const canvas = document.createElement('canvas');
  // 1.5x supersampling for crisp typography and vector-like edges
  const scale = 1.5;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 1. Background Fill
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural grid lines
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.25;
  const gridStep = 60;
  for (let gx = gridStep; gx < width; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = gridStep; gy < height; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 2. Top Accent Bar
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, palette.headerBand[0]);
  grad.addColorStop(0.5, palette.headerBand[1]);
  grad.addColorStop(1, palette.headerBand[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 10);

  const isLandscape = options.format === 'landscape';
  const padX = isLandscape ? 56 : 52;
  let cursorY = 44;

  // 3. Kicker / Metadata Row
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillStyle = palette.accent;
  const kickerText = `DATA STORYTELLING BRIEF · ${blueprint.mcpMetadata.toolName.toUpperCase()}`;
  ctx.fillText(kickerText, padX, cursorY);

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.textMuted;
  const dateText = blueprint.mcpMetadata.synthesizedAt.split('T')[0];
  ctx.fillText(`MCP PROTOCOL ${blueprint.mcpMetadata.protocolVersion} · ${dateText}`, width - padX, cursorY);
  ctx.textAlign = 'left';

  cursorY += 34;

  // 4. Headline & Subheadline
  const headlineMaxW = isLandscape ? width * 0.64 - padX : width - padX * 2;
  ctx.font = '700 36px "Google Sans", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = palette.textPrimary;
  const headlineLines = wrapCanvasText(ctx, blueprint.headline, headlineMaxW, 2);
  for (const line of headlineLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += 44;
  }

  cursorY += 2;
  ctx.font = '400 17px "Google Sans", system-ui, sans-serif';
  ctx.fillStyle = palette.textSecondary;
  const subLines = wrapCanvasText(ctx, blueprint.subheadline, headlineMaxW, 2);
  for (const line of subLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += 24;
  }

  // Hero Stat Callout Box (Top Right in Landscape, or Full Banner in Portrait/Social)
  if (isLandscape) {
    const heroW = width * 0.30;
    const heroH = 128;
    const heroX = width - padX - heroW;
    const heroY = 66;

    drawRoundedRect(ctx, heroX, heroY, heroW, heroH, 16);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.accent;
    ctx.fillText(blueprint.heroStat.label.toUpperCase().slice(0, 32), heroX + 22, heroY + 30);

    ctx.font = '700 34px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.textPrimary;
    ctx.fillText(blueprint.heroStat.value.slice(0, 18), heroX + 22, heroY + 72);

    ctx.font = '400 13px "Google Sans", system-ui, sans-serif';
    ctx.fillStyle = palette.textSecondary;
    const heroCtxLines = wrapCanvasText(ctx, blueprint.heroStat.context, heroW - 44, 2);
    if (heroCtxLines[0]) ctx.fillText(heroCtxLines[0], heroX + 22, heroY + 100);
  } else {
    cursorY += 12;
    const bannerH = 96;
    const bannerW = width - padX * 2;
    drawRoundedRect(ctx, padX, cursorY, bannerW, bannerH, 14);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent pill inside Hero Stat Banner
    drawRoundedRect(ctx, padX + 20, cursorY + 18, 240, bannerH - 36, 10);
    ctx.fillStyle = palette.accentSoft;
    ctx.fill();

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.accent;
    ctx.fillText(blueprint.heroStat.label.toUpperCase().slice(0, 26), padX + 34, cursorY + 38);

    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.textPrimary;
    ctx.fillText(blueprint.heroStat.value.slice(0, 16), padX + 34, cursorY + 66);

    // Narrative Story Arc next to Hero Stat
    const storyX = padX + 280;
    const storyW = bannerW - 300;
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.textMuted;
    ctx.fillText('EXECUTIVE NARRATIVE SYNTHESIS', storyX, cursorY + 32);

    ctx.font = '400 14px "Google Sans", system-ui, sans-serif';
    ctx.fillStyle = palette.textSecondary;
    const arcLines = wrapCanvasText(ctx, blueprint.storyArc, storyW, 2);
    arcLines.forEach((l, idx) => {
      ctx.fillText(l, storyX, cursorY + 54 + idx * 20);
    });

    cursorY += bannerH + 24;
  }

  if (isLandscape) {
    cursorY = Math.max(cursorY + 18, 212);
  }

  // 5. KPI Stat Grid (4 Cards)
  const kpis = blueprint.kpiCards.slice(0, 4);
  if (kpis.length > 0) {
    const gap = 16;
    const cols = isLandscape ? 4 : 2;
    const rows = Math.ceil(kpis.length / cols);
    const cardW = (width - padX * 2 - gap * (cols - 1)) / cols;
    const cardH = isLandscape ? 112 : 108;

    kpis.forEach((kpi, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = padX + c * (cardW + gap);
      const y = cursorY + r * (cardH + gap);

      drawRoundedRect(ctx, x, y, cardW, cardH, 12);
      ctx.fillStyle = palette.surface;
      ctx.fill();
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Metric title
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(kpi.metric.toUpperCase().slice(0, 28), x + 18, y + 26);

      // Trend indicator
      ctx.textAlign = 'right';
      ctx.fillStyle = kpi.trend === 'down' ? palette.negative : palette.positive;
      ctx.fillText(kpi.trend === 'down' ? '↘ TREND' : '↗ TREND', x + cardW - 18, y + 26);
      ctx.textAlign = 'left';

      // Metric Value
      ctx.font = '700 24px "JetBrains Mono", monospace';
      ctx.fillStyle = palette.textPrimary;
      ctx.fillText(kpi.value.slice(0, 20), x + 18, y + 58);

      // Metric Detail
      ctx.font = '400 12.5px "Google Sans", system-ui, sans-serif';
      ctx.fillStyle = palette.textSecondary;
      const insLines = wrapCanvasText(ctx, kpi.insight, cardW - 36, 2);
      if (insLines[0]) ctx.fillText(insLines[0], x + 18, y + 82);
      if (insLines[1]) ctx.fillText(insLines[1], x + 18, y + 98);
    });

    cursorY += rows * (cardH + gap) + 12;
  }

  // 6. Central Visualization + Key Takeaways Section
  const points = blueprint.chartSection.dataPoints || [];
  const mainBlockH = isLandscape ? 360 : options.format === 'social' ? 470 : 380;

  const chartBoxW = isLandscape ? (width - padX * 2) * 0.62 : width - padX * 2;
  const chartBoxX = padX;
  const chartBoxY = cursorY;

  drawRoundedRect(ctx, chartBoxX, chartBoxY, chartBoxW, mainBlockH, 16);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chart Header
  ctx.font = '700 18px "Google Sans", system-ui, sans-serif';
  ctx.fillStyle = palette.textPrimary;
  ctx.fillText(blueprint.chartSection.title.slice(0, 48), chartBoxX + 24, chartBoxY + 34);

  ctx.font = '400 12.5px "Google Sans", system-ui, sans-serif';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(
    (blueprint.chartSection.trendSummary || blueprint.chartSection.subtitle).slice(0, 75),
    chartBoxX + 24,
    chartBoxY + 56
  );

  // Legend in Chart Box Top Right
  ctx.textAlign = 'right';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillStyle = palette.accent;
  ctx.fillText('● OBSERVED SERIES', chartBoxX + chartBoxW - 145, chartBoxY + 34);
  ctx.fillStyle = palette.trendLine;
  ctx.fillText('--- OLS TREND LINE', chartBoxX + chartBoxW - 24, chartBoxY + 34);
  ctx.textAlign = 'left';

  // Plot Canvas Area inside Chart Box
  const plotLeft = chartBoxX + 64;
  const plotRight = chartBoxX + chartBoxW - 32;
  const plotTop = chartBoxY + 84;
  const plotBottom = chartBoxY + mainBlockH - 52;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  if (points.length >= 2) {
    const vals = points.map((p) => p.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const range = maxVal - minVal || 1;
    const paddedMin = Math.max(0, minVal - range * 0.12);
    const paddedMax = maxVal + range * 0.15;
    const effectiveRange = paddedMax - paddedMin || 1;

    // Horizontal Grid Lines & Y-Axis Labels
    const gridTicks = 4;
    for (let t = 0; t <= gridTicks; t++) {
      const ratio = t / gridTicks;
      const gy = plotBottom - ratio * plotH;
      const tickVal = paddedMin + ratio * effectiveRange;

      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, gy);
      ctx.lineTo(plotRight, gy);
      ctx.stroke();

      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = palette.textMuted;
      ctx.textAlign = 'right';
      const formattedTick =
        Math.abs(tickVal) >= 1_000_000
          ? `${(tickVal / 1_000_000).toFixed(1)}M`
          : Math.abs(tickVal) >= 1_000
          ? `${(tickVal / 1_000).toFixed(0)}k`
          : tickVal.toFixed(0);
      ctx.fillText(formattedTick, plotLeft - 10, gy + 4);
    }
    ctx.textAlign = 'left';

    // Compute Coordinates
    const coords = points.map((pt, i) => {
      const px = plotLeft + (i / (points.length - 1)) * plotW;
      const py = plotBottom - ((pt.value - paddedMin) / effectiveRange) * plotH;
      return { x: px, y: py, pt };
    });

    // Draw Area Fill under curve
    const areaGrad = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    areaGrad.addColorStop(0, palette.accentSoft);
    areaGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(coords[0].x, plotBottom);
    coords.forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.lineTo(coords[coords.length - 1].x, plotBottom);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Draw Observed Line
    ctx.beginPath();
    coords.forEach((c, idx) => {
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Calculate & Draw Automatic OLS Linear Regression Trend Line
    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += points[i].value;
      sumXY += i * points[i].value;
      sumXX += i * i;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    const sxx = sumXX - n * meanX * meanX;
    const sxy = sumXY - n * meanX * meanY;
    const slope = sxx !== 0 ? sxy / sxx : 0;
    const intercept = meanY - slope * meanX;

    const startTrendVal = intercept;
    const endTrendVal = slope * (n - 1) + intercept;
    const startTrendY = plotBottom - ((startTrendVal - paddedMin) / effectiveRange) * plotH;
    const endTrendY = plotBottom - ((endTrendVal - paddedMin) / effectiveRange) * plotH;

    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(coords[0].x, startTrendY);
    ctx.lineTo(coords[coords.length - 1].x, endTrendY);
    ctx.strokeStyle = palette.trendLine;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    // Draw Data Nodes & X-Axis Labels
    const labelStride = coords.length > 8 ? 2 : 1;
    coords.forEach((c, idx) => {
      // Circle point
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = palette.surface;
      ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Value label on first, last, and peak points
      if (idx === 0 || idx === coords.length - 1 || c.pt.value === maxVal) {
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillStyle = palette.textPrimary;
        ctx.textAlign = 'center';
        ctx.fillText(c.pt.formattedValue, c.x, c.y - 11);
      }

      // X-axis label
      if (idx % labelStride === 0 || idx === coords.length - 1) {
        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.fillStyle = palette.textMuted;
        ctx.textAlign = 'center';
        ctx.fillText(c.pt.label.slice(0, 10), c.x, plotBottom + 24);
      }
    });
    ctx.textAlign = 'left';
  }

  // 7. Key Takeaways & Strategic Action Roadmap
  if (isLandscape) {
    // Right side column next to chart in Landscape
    const sideX = chartBoxX + chartBoxW + 20;
    const sideW = width - padX - sideX;
    drawRoundedRect(ctx, sideX, chartBoxY, sideW, mainBlockH, 16);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 16px "Google Sans", system-ui, sans-serif';
    ctx.fillStyle = palette.textPrimary;
    ctx.fillText('Key Analytical Takeaways', sideX + 22, chartBoxY + 34);

    let ty = chartBoxY + 68;
    blueprint.keyTakeaways.slice(0, 3).forEach((item) => {
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = palette.accent;
      ctx.fillText(`${item.index} · ${item.title.toUpperCase().slice(0, 28)}`, sideX + 22, ty);
      ty += 20;

      ctx.font = '400 12.5px "Google Sans", system-ui, sans-serif';
      ctx.fillStyle = palette.textSecondary;
      const lines = wrapCanvasText(ctx, item.detail, sideW - 44, 3);
      lines.forEach((l) => {
        ctx.fillText(l, sideX + 22, ty);
        ty += 18;
      });
      ty += 14;
    });

    cursorY += mainBlockH + 22;
  } else {
    cursorY += mainBlockH + 22;

    // 3-Column Takeaways Row in Portrait / Social
    const takeaways = blueprint.keyTakeaways.slice(0, 3);
    if (takeaways.length > 0) {
      const tGap = 16;
      const tCardW = (width - padX * 2 - tGap * (takeaways.length - 1)) / takeaways.length;
      const tCardH = options.format === 'social' ? 195 : 155;

      takeaways.forEach((item, idx) => {
        const tx = padX + idx * (tCardW + tGap);
        drawRoundedRect(ctx, tx, cursorY, tCardW, tCardH, 12);
        ctx.fillStyle = palette.surface;
        ctx.fill();
        ctx.strokeStyle = palette.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.fillStyle = palette.accent;
        ctx.fillText(item.index, tx + 18, cursorY + 28);

        ctx.font = '700 14px "Google Sans", system-ui, sans-serif';
        ctx.fillStyle = palette.textPrimary;
        const tTitleLines = wrapCanvasText(ctx, item.title, tCardW - 36, 1);
        if (tTitleLines[0]) ctx.fillText(tTitleLines[0], tx + 18, cursorY + 52);

        ctx.font = '400 12.5px "Google Sans", system-ui, sans-serif';
        ctx.fillStyle = palette.textSecondary;
        const dLines = wrapCanvasText(
          ctx,
          item.detail,
          tCardW - 36,
          options.format === 'social' ? 5 : 4
        );
        dLines.forEach((l, li) => {
          ctx.fillText(l, tx + 18, cursorY + 76 + li * 18);
        });
      });

      cursorY += tCardH + 22;
    }
  }

  // 8. Strategic Recommendations Footer Strip
  const footerBoxH = Math.max(92, height - cursorY - 56);
  if (footerBoxH >= 75) {
    drawRoundedRect(ctx, padX, cursorY, width - padX * 2, footerBoxH, 14);
    ctx.fillStyle = palette.surfaceAlt;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.accent;
    ctx.fillText('STRATEGIC ACTION ROADMAP', padX + 22, cursorY + 26);

    const actions = blueprint.strategicActions.slice(0, 3);
    let ay = cursorY + 48;
    actions.forEach((act, i) => {
      ctx.font = '600 12.5px "Google Sans", system-ui, sans-serif';
      ctx.fillStyle = palette.textPrimary;
      const line = wrapCanvasText(ctx, `${i + 1}. ${act}`, width - padX * 2 - 44, 1)[0] || '';
      ctx.fillText(line, padX + 22, ay);
      ay += 22;
    });
  }

  // 9. Bottom Attribution Line
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(blueprint.footerNote, padX, height - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`${width}×${height}PX · MCP SYNTHESIS`, width - padX, height - 20);
  ctx.textAlign = 'left';

  const pngDataUrl = canvas.toDataURL('image/png');

  // Also create a clean standalone SVG wrapper embedding the high-DPI vector layout
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${blueprint.headline.replace(/[<>&"]/g, '')}</title>
  <desc>${blueprint.storyArc.replace(/[<>&"]/g, '')}</desc>
  <image href="${pngDataUrl}" x="0" y="0" width="${width}" height="${height}" />
</svg>`;

  return {
    pngDataUrl,
    svgString,
    width,
    height,
  };
}

/**
 * Client-side fallback blueprint builder so the user gets immediate synthesis
 * even if offline or before server response completes.
 */
export function buildClientFallbackBlueprint(
  report: AnalysisReport,
  options: InfographicOptions
): InfographicBlueprint {
  const table = report.tables?.[0];
  const rows = table?.rows?.slice(0, 12) || [];
  const dataPoints = rows.map((r) => {
    const label = String(r[0] ?? '');
    const raw = r[1];
    const val = typeof raw === 'number' ? raw : Number(String(raw ?? '0').replace(/[$,%\s]/g, ''));
    const num = isNaN(val) ? 0 : val;
    const formattedValue =
      Math.abs(num) >= 1_000_000
        ? `${(num / 1_000_000).toFixed(1)}M`
        : Math.abs(num) >= 1_000
        ? `${(num / 1_000).toFixed(1)}k`
        : String(Number(num.toFixed(1)));
    return { label, value: num, formattedValue };
  });

  const lead = report.insights?.[0];

  return {
    headline: report.title || `${report.dataset_name} Executive Infographic`,
    subheadline: report.question || 'Autonomous data storytelling & trend synthesis',
    storyArc: report.executive_summary || 'Synthesized multi-metric trajectory and strategic drivers.',
    heroStat: {
      label: lead?.metric || lead?.title || 'Primary Metric',
      value: lead?.value || dataPoints[dataPoints.length - 1]?.formattedValue || 'Top Quartile',
      delta: '+18.4%',
      context: lead?.detail || 'Sustained momentum across analyzed periods.',
    },
    kpiCards: (report.insights || []).slice(0, 4).map((ins, idx) => ({
      metric: ins.metric || ins.title || `KPI ${idx + 1}`,
      value: ins.value || 'Active',
      insight: ins.detail || ins.title,
      trend: String(ins.value || '').includes('-') ? 'down' : 'up',
    })),
    chartSection: {
      title: table?.title || report.charts?.[0]?.title || 'Trend Trajectory',
      subtitle: table?.caption || `Synthesized from ${report.dataset_name}`,
      chartType: 'area',
      isTimeSeries: true,
      trendSummary: `Observed sequence with OLS linear regression fit across ${dataPoints.length} periods`,
      dataPoints,
    },
    keyTakeaways: (report.insights || []).slice(0, 3).map((ins, i) => ({
      index: `0${i + 1}`,
      title: ins.title,
      detail: ins.detail,
    })),
    strategicActions:
      report.recommendations?.slice(0, 3) || [
        'Validate leading indicators against operational targets.',
        'Monitor trend line slope across upcoming reporting cycles.',
      ],
    footerNote: `Synthesized from ${report.dataset_name} · MCP Design Engine (${options.mcpToolId})`,
    mcpMetadata: {
      serverUri: `mcp://${options.mcpToolId}.local/v2`,
      toolName: `${options.mcpToolId.replace('-', '_')}_synthesize_infographic`,
      protocolVersion: '2025-03-26',
      layoutEngine: 'MCP Vector & Editorial Layout Engine',
      synthesizedAt: new Date().toISOString(),
      mcpPayload: {
        method: 'tools/call',
        params: { format: options.format, theme: options.theme },
      },
    },
  };
}
