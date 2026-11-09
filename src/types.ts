export interface ReportInsight {
  title: string;
  detail: string;
  metric?: string;
  value?: string;
}

export interface ReportChart {
  title: string;
  file: string;
  caption?: string;
  type?: string;
  /** Base64 data URL injected by the server after extracting the PNG from the sandbox. */
  image?: string;
  data?: Array<Record<string, any>>;
  timeKey?: string;
  metricKeys?: string[];
  isTimeSeries?: boolean;
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  caption?: string;
}

export interface AnalysisReport {
  dataset_name: string;
  question: string;
  title: string;
  executive_summary: string;
  insights: ReportInsight[];
  charts: ReportChart[];
  tables: ReportTable[];
  methodology?: string;
  recommendations?: string[];
  generated_at?: string;
}

export type ActivityType =
  | 'info'
  | 'thinking'
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: ActivityType;
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface UploadedFile {
  name: string;
  content?: string;
  gsUri?: string;
  localPath?: string;
  isLocal?: boolean;
  isGcsUri?: boolean;
  size?: number;
  driveId?: string;
  mimeType?: string;
}

export type InfographicFormat = 'portrait' | 'landscape' | 'social';
export type InfographicTheme = 'executive-dark' | 'editorial-light' | 'io-cobalt' | 'swiss-minimal';
export type McpDesignToolId = 'mcp-canva' | 'mcp-figma' | 'mcp-vega';

export interface InfographicOptions {
  format: InfographicFormat;
  theme: InfographicTheme;
  mcpToolId: McpDesignToolId;
  customFocus?: string;
}

export interface InfographicAgentStep {
  id: string;
  phase: string;
  toolUri: string;
  summary: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  durationMs?: number;
}

export interface InfographicBlueprint {
  headline: string;
  subheadline: string;
  storyArc: string;
  heroStat: {
    label: string;
    value: string;
    delta: string;
    context: string;
  };
  kpiCards: Array<{
    metric: string;
    value: string;
    insight: string;
    trend: 'up' | 'down' | 'neutral';
  }>;
  chartSection: {
    title: string;
    subtitle: string;
    chartType: 'line' | 'bar' | 'area';
    isTimeSeries: boolean;
    trendSummary?: string;
    dataPoints: Array<{
      label: string;
      value: number;
      formattedValue: string;
    }>;
  };
  keyTakeaways: Array<{
    index: string;
    title: string;
    detail: string;
  }>;
  strategicActions: string[];
  footerNote: string;
  mcpMetadata: {
    serverUri: string;
    toolName: string;
    protocolVersion: string;
    layoutEngine: string;
    synthesizedAt: string;
    mcpPayload: Record<string, unknown>;
  };
}

export type SocialPlatform = 'twitter' | 'linkedin';
export type SocialTone = 'executive' | 'storytelling' | 'metrics-first' | 'thought-leadership';

export interface SocialDraftOptions {
  platform: SocialPlatform;
  tone: SocialTone;
  customAngle?: string;
  includeThread: boolean;
  attachVisualCard: boolean;
}

export interface SocialDraft {
  platform: SocialPlatform;
  hook: string;
  body: string;
  threadItems: string[];
  hashtags: string[];
  callToAction: string;
  bestTimeWindow: string;
  recommendedIsoSlot: string;
  engagementRationale: string;
  attachedMetrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface SocialCampaignPackage {
  campaignTitle: string;
  narrativeAngle: string;
  twitter: SocialDraft;
  linkedin: SocialDraft;
  mcpMetadata: {
    connectorUri: string;
    toolName: string;
    generatedAt: string;
  };
}

export interface ScheduledSocialPost {
  id: string;
  platform: SocialPlatform;
  datasetName: string;
  status: 'scheduled' | 'published';
  scheduledFor: string;
  content: string;
  threadItems: string[];
  hashtags: string[];
  attachVisualCard: boolean;
  dispatchReceipt: {
    queueId: string;
    connectorUri: string;
    timestamp: string;
  };
}

declare global {
  interface Window {
    gapi: any;
    google?: any;
  }
  const google: any;
}
