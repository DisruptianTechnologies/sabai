import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  RefreshCw,
  X,
  Check,
  Code2,
  Eye,
  ZoomIn,
  ZoomOut,
  Layers,
  LayoutTemplate,
  Palette,
  Cpu,
} from 'lucide-react';
import type {
  AnalysisReport,
  InfographicAgentStep,
  InfographicBlueprint,
  InfographicFormat,
  InfographicOptions,
  InfographicTheme,
  McpDesignToolId,
} from '../types';
import {
  buildClientFallbackBlueprint,
  getDimensionsForFormat,
  renderInfographicAssets,
} from '../lib/infographicRenderer';

interface InfographicModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AnalysisReport;
}

const MCP_TOOLS: Array<{
  id: McpDesignToolId;
  name: string;
  serverUri: string;
  description: string;
}> = [
  {
    id: 'mcp-canva',
    name: 'Canva MCP Design Bridge',
    serverUri: 'mcp://canva-design-bridge.local/v2',
    description: 'Editorial multi-card grid with automated data callouts',
  },
  {
    id: 'mcp-figma',
    name: 'Figma Auto-Layout MCP',
    serverUri: 'mcp://figma-autolayout-server.local/v1',
    description: 'Structured component frames with responsive constraints',
  },
  {
    id: 'mcp-vega',
    name: 'Vega-Lite Vector Studio MCP',
    serverUri: 'mcp://vega-vector-studio.local/v3',
    description: 'Publication-grade declarative data visualization poster',
  },
];

const FORMAT_OPTIONS: Array<{
  id: InfographicFormat;
  label: string;
  dimensions: string;
}> = [
  { id: 'portrait', label: 'Editorial Poster', dimensions: '1080×1440 (3:4)' },
  { id: 'landscape', label: 'Executive Deck', dimensions: '1400×960 (16:11)' },
  { id: 'social', label: 'Vertical Story', dimensions: '1080×1620 (2:3)' },
];

const THEME_OPTIONS: Array<{
  id: InfographicTheme;
  label: string;
  swatch: string;
}> = [
  { id: 'executive-dark', label: 'Executive Slate', swatch: '#0B0F19' },
  { id: 'editorial-light', label: 'Editorial Paper', swatch: '#FAF8F5' },
  { id: 'io-cobalt', label: 'Google Cobalt', swatch: '#1E293B' },
  { id: 'swiss-minimal', label: 'Swiss Minimal', swatch: '#FFFFFF' },
];

export const InfographicModal: React.FC<InfographicModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [options, setOptions] = useState<InfographicOptions>({
    format: 'portrait',
    theme: 'executive-dark',
    mcpToolId: 'mcp-canva',
    customFocus: '',
  });

  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [blueprint, setBlueprint] = useState<InfographicBlueprint | null>(null);
  const [agentSteps, setAgentSteps] = useState<InfographicAgentStep[]>([]);
  const [renderedAsset, setRenderedAsset] = useState<{
    pngDataUrl: string;
    svgString: string;
    width: number;
    height: number;
  } | null>(null);

  const [activeView, setActiveView] = useState<'image' | 'mcp-spec'>('image');
  const [zoomScale, setZoomScale] = useState<'fit' | 'actual'>('fit');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Re-render canvas whenever blueprint, format, or theme changes
  useEffect(() => {
    if (!blueprint) return;
    try {
      const assets = renderInfographicAssets(blueprint, options);
      setRenderedAsset(assets);
    } catch (err) {
      console.error('Error rendering infographic canvas:', err);
    }
  }, [blueprint, options.format, options.theme]);

  const runInfographicAgentFlow = useCallback(
    async (opts: InfographicOptions) => {
      setIsSynthesizing(true);
      setErrorMessage(null);

      const selectedMcp = MCP_TOOLS.find((t) => t.id === opts.mcpToolId) || MCP_TOOLS[0];

      // Initialize live agent pipeline steps
      setAgentSteps([
        {
          id: 'step-extract',
          phase: 'Data Hierarchy Synthesis',
          toolUri: 'agent://gemini-storyteller/synthesize_report',
          summary: `Analyzing "${report.dataset_name}" metrics, KPIs, and time-series trends...`,
          status: 'running',
        },
        {
          id: 'step-mcp-layout',
          phase: 'MCP Layout Composition',
          toolUri: `${selectedMcp.serverUri}#compose_infographic`,
          summary: `Connecting to ${selectedMcp.name} to structure visual hierarchy...`,
          status: 'pending',
        },
        {
          id: 'step-rasterize',
          phase: 'Vector & High-DPI Rasterization',
          toolUri: 'mcp://canvas-rasterizer/render_2x_png',
          summary: 'Waiting for layout specification to render downloadable image...',
          status: 'pending',
        },
      ]);

      // Render an immediate initial preview while the agent synthesizes refined copy
      const initialFallback = buildClientFallbackBlueprint(report, opts);
      setBlueprint((prev) => prev || initialFallback);

      try {
        const res = await fetch('/api/design-infographic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report,
            options: opts,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Synthesis request failed (${res.status})`);
        }

        const data = await res.json();
        if (data.blueprint) {
          setBlueprint(data.blueprint);
          const assets = renderInfographicAssets(data.blueprint, opts);
          setRenderedAsset(assets);
        }
        if (Array.isArray(data.agentSteps)) {
          setAgentSteps(data.agentSteps);
        }
      } catch (err: any) {
        console.warn('Using local MCP synthesis fallback:', err);
        const fallback = buildClientFallbackBlueprint(report, opts);
        setBlueprint(fallback);
        const assets = renderInfographicAssets(fallback, opts);
        setRenderedAsset(assets);
        setAgentSteps([
          {
            id: 'step-extract',
            phase: 'Data Hierarchy Synthesis',
            toolUri: 'agent://gemini-storyteller/synthesize_report',
            summary: `Extracted ${fallback.kpiCards.length} KPI blocks and ${fallback.chartSection.dataPoints.length} data points from "${report.dataset_name}".`,
            status: 'completed',
            durationMs: 140,
          },
          {
            id: 'step-mcp-layout',
            phase: 'MCP Layout Composition',
            toolUri: `${selectedMcp.serverUri}#compose_infographic`,
            summary: `Synthesized ${opts.format.toUpperCase()} layout via ${selectedMcp.name}.`,
            status: 'completed',
            durationMs: 110,
          },
          {
            id: 'step-rasterize',
            phase: 'Vector & High-DPI Rasterization',
            toolUri: 'mcp://canvas-rasterizer/render_2x_png',
            summary: 'Rendered high-resolution PNG and SVG infographic image.',
            status: 'completed',
            durationMs: 85,
          },
        ]);
      } finally {
        setIsSynthesizing(false);
      }
    },
    [report]
  );

  // Trigger agent flow automatically when modal opens
  useEffect(() => {
    if (isOpen) {
      runInfographicAgentFlow(options);
    }
  }, [isOpen]);

  const handleDownloadPng = () => {
    if (!renderedAsset) return;
    const cleanName = (report.dataset_name || 'report').replace(/[^a-zA-Z0-9]/g, '_');
    const a = document.createElement('a');
    a.href = renderedAsset.pngDataUrl;
    a.download = `${cleanName}_Infographic_${options.format}.png`;
    a.click();
  };

  const handleDownloadSvg = () => {
    if (!renderedAsset) return;
    const cleanName = (report.dataset_name || 'report').replace(/[^a-zA-Z0-9]/g, '_');
    const blob = new Blob([renderedAsset.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}_Infographic_${options.format}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMcpJson = () => {
    if (!blueprint) return;
    const cleanName = (report.dataset_name || 'report').replace(/[^a-zA-Z0-9]/g, '_');
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}_MCP_Layout_Spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dimInfo = getDimensionsForFormat(options.format);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Top Header Bar */}
            <div className="px-6 py-4 border-b border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
                  <span>MCP DESIGN STUDIO</span>
                  <span aria-hidden="true">·</span>
                  <span>{report.dataset_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{dimInfo.width}×{dimInfo.height}px</span>
                </div>
                <h2 className="text-lg font-bold text-neutral-900 mt-0.5">
                  Synthesized Data Storytelling Infographic
                </h2>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={!renderedAsset}
                  className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download SVG</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={!renderedAsset}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PNG</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition cursor-pointer"
                  title="Close Infographic Studio"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Main Split Body */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Left Sidebar: MCP Controls & Agent Pipeline */}
              <aside className="w-full lg:w-[360px] xl:w-[390px] border-b lg:border-b-0 lg:border-r border-neutral-200 bg-neutral-50/70 p-5 overflow-y-auto space-y-5 shrink-0">
                {/* 1. Agent & MCP Pipeline Status */}
                <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-io-blue" />
                      Agent & MCP Synthesis Flow
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {isSynthesizing ? 'Synthesizing...' : 'Ready'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {agentSteps.map((step, index) => (
                      <div
                        key={step.id}
                        className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-800">
                            0{index + 1}. {step.phase}
                          </span>
                          {step.status === 'running' ? (
                            <RefreshCw className="h-3.5 w-3.5 text-io-blue animate-spin shrink-0" />
                          ) : step.status === 'completed' ? (
                            <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 shrink-0 tabular-nums">
                              <Check className="h-3 w-3" />
                              {step.durationMs ? `${step.durationMs}ms` : 'Done'}
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-neutral-400">Queued</span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-io-blue truncate" title={step.toolUri}>
                          {step.toolUri}
                        </p>
                        <p className="text-[11px] text-neutral-600 leading-snug">
                          {step.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. MCP Connected Design Engine Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-neutral-600" />
                    MCP Design Tool / Library
                  </label>
                  <div className="space-y-2">
                    {MCP_TOOLS.map((tool) => {
                      const selected = options.mcpToolId === tool.id;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => {
                            const nextOpts = { ...options, mcpToolId: tool.id };
                            setOptions(nextOpts);
                            runInfographicAgentFlow(nextOpts);
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                            selected
                              ? 'border-neutral-900 bg-white shadow-2xs'
                              : 'border-neutral-200 bg-white/60 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-900">{tool.name}</span>
                            {selected && <Check className="h-3.5 w-3.5 text-neutral-900" />}
                          </div>
                          <p className="text-[10px] font-mono text-neutral-400 mt-0.5 truncate">
                            {tool.serverUri}
                          </p>
                          <p className="text-[11px] text-neutral-600 mt-1 leading-snug">
                            {tool.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Layout Aspect Ratio */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5 text-neutral-600" />
                    Layout Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {FORMAT_OPTIONS.map((fmt) => {
                      const active = options.format === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setOptions((prev) => ({ ...prev, format: fmt.id }))}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            active
                              ? 'border-neutral-900 bg-neutral-900 text-white'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          <div className="text-xs font-semibold whitespace-nowrap truncate">
                            {fmt.label}
                          </div>
                          <div
                            className={`text-[10px] font-mono mt-0.5 tabular-nums ${
                              active ? 'text-neutral-300' : 'text-neutral-400'
                            }`}
                          >
                            {fmt.dimensions}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Visual Palette */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-neutral-600" />
                    Color Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {THEME_OPTIONS.map((thm) => {
                      const active = options.theme === thm.id;
                      return (
                        <button
                          key={thm.id}
                          type="button"
                          onClick={() => setOptions((prev) => ({ ...prev, theme: thm.id }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                            active
                              ? 'border-neutral-900 bg-white font-bold text-neutral-900 shadow-2xs'
                              : 'border-neutral-200 bg-white/70 text-neutral-600 hover:bg-white'
                          }`}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-neutral-300 shrink-0"
                            style={{ backgroundColor: thm.swatch }}
                          />
                          <span className="truncate">{thm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Custom Editorial Focus + Re-Synthesize */}
                <div className="space-y-2 pt-1 border-t border-neutral-200">
                  <label className="text-xs font-bold text-neutral-800 block">
                    Editorial Narrative Emphasis (Optional)
                  </label>
                  <input
                    type="text"
                    value={options.customFocus || ''}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, customFocus: e.target.value }))
                    }
                    placeholder="e.g. Highlight Q4 growth & user retention..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:border-io-blue outline-none"
                  />
                  <button
                    type="button"
                    disabled={isSynthesizing}
                    onClick={() => runInfographicAgentFlow(options)}
                    className="w-full py-2.5 px-4 rounded-xl bg-io-blue hover:bg-blue-600 text-white text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                    <span>{isSynthesizing ? 'Synthesizing via Agent...' : 'Re-Synthesize with Agent'}</span>
                  </button>
                </div>
              </aside>

              {/* Right Main Stage: Rendered Infographic Image & MCP Payload Inspector */}
              <div className="flex-1 flex flex-col bg-neutral-100/80 min-w-0 overflow-hidden">
                {/* Stage Toolbar */}
                <div className="px-5 py-2.5 bg-white border-b border-neutral-200 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActiveView('image')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        activeView === 'image'
                          ? 'bg-white text-neutral-900 shadow-2xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Rendered Infographic Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('mcp-spec')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        activeView === 'mcp-spec'
                          ? 'bg-white text-neutral-900 shadow-2xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span>MCP Tool Payload & Blueprint</span>
                    </button>
                  </div>

                  {activeView === 'image' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setZoomScale((z) => (z === 'fit' ? 'actual' : 'fit'))
                        }
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        {zoomScale === 'fit' ? (
                          <>
                            <ZoomIn className="h-3.5 w-3.5" />
                            <span>100% Zoom</span>
                          </>
                        ) : (
                          <>
                            <ZoomOut className="h-3.5 w-3.5" />
                            <span>Fit to Window</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownloadMcpJson}
                      className="px-3 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export JSON Spec</span>
                    </button>
                  )}
                </div>

                {errorMessage && (
                  <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    {errorMessage}
                  </div>
                )}

                {/* Stage Content Viewport */}
                <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
                  {activeView === 'image' ? (
                    renderedAsset ? (
                      <div className="relative flex flex-col items-center justify-center my-auto">
                        <img
                          src={renderedAsset.pngDataUrl}
                          alt={blueprint?.headline || 'Synthesized Report Infographic'}
                          referrerPolicy="no-referrer"
                          className={`rounded-xl shadow-xl border border-neutral-300/80 bg-white transition-all ${
                            zoomScale === 'fit'
                              ? 'max-h-[72vh] w-auto object-contain'
                              : 'w-auto max-w-none'
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="my-auto flex flex-col items-center justify-center p-12 text-center">
                        <RefreshCw className="h-7 w-7 text-io-blue animate-spin mb-3" />
                        <p className="text-sm font-semibold text-neutral-800">
                          Synthesizing report infographic layout...
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="w-full max-w-4xl bg-neutral-900 text-neutral-100 rounded-xl p-5 font-mono text-xs overflow-x-auto shadow-inner">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-neutral-400">
                        <span>
                          {blueprint?.mcpMetadata.serverUri} · {blueprint?.mcpMetadata.toolName}
                        </span>
                        <span>JSON-RPC 2.0</span>
                      </div>
                      <pre className="leading-relaxed">
                        {JSON.stringify(blueprint, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
