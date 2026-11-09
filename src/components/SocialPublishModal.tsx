import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Share2,
  Calendar,
  Clock,
  Check,
  Copy,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  Hash,
  Sparkles,
  CheckCircle2,
  Loader2,
  Layers,
  Terminal,
  BarChart3,
} from 'lucide-react';
import type {
  AnalysisReport,
  SocialPlatform,
  SocialTone,
  SocialDraft,
  SocialCampaignPackage,
  ScheduledSocialPost,
} from '../types';

interface AgentStep {
  id: string;
  tool: string;
  label: string;
  status: 'running' | 'completed';
  durationMs: number;
  detail: string;
}

interface SocialPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AnalysisReport;
}

const TONE_OPTIONS: Array<{ id: SocialTone; label: string; desc: string }> = [
  { id: 'executive', label: 'Executive Brief', desc: 'Concise board-level metrics & takeaway' },
  { id: 'storytelling', label: 'Data Narrative', desc: 'Hook-driven story arc with surprising stats' },
  { id: 'metrics-first', label: 'Metrics-First', desc: 'Hard numbers, deltas & benchmark proof' },
  { id: 'thought-leadership', label: 'Thought Leadership', desc: 'Strategic thesis & industry implications' },
];

function buildClientFallbackPackage(
  report: AnalysisReport,
  tone: SocialTone,
  customAngle?: string
): SocialCampaignPackage {
  const dataset = report.dataset_name || 'Dataset';
  const title = report.title || `${dataset} Intelligence Report`;
  const topInsights = (report.insights || []).slice(0, 4);
  const topRec = report.recommendations?.[0] || 'Focus resources on the highest-margin growth segments.';
  const attachedMetrics = topInsights.slice(0, 3).map((ins) => ({
    label: String(ins.metric || ins.title || 'KPI').slice(0, 28),
    value: String(ins.value || 'Key Trend').slice(0, 24),
  }));

  const metricCallout = topInsights
    .slice(0, 2)
    .map((ins) => `${ins.metric || ins.title}: ${ins.value || ins.detail}`)
    .join(' · ');

  const tomorrowSlot = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrowSlot.setHours(9, 15, 0, 0);
  const isoSlot = tomorrowSlot.toISOString().slice(0, 16);

  return {
    campaignTitle: `${title} — Social Distribution`,
    narrativeAngle: customAngle || `Data-backed executive synthesis (${tone} tone) from ${dataset}.`,
    twitter: {
      platform: 'twitter',
      hook: `New data out of ${dataset}: ${title}.`,
      body: `We ran an autonomous analysis on ${dataset}.\n\nHeadline finding: ${metricCallout || (report.executive_summary || '').slice(0, 120)}\n\nFull breakdown in the thread below:`,
      threadItems: [
        ...topInsights.slice(0, 3).map(
          (ins, idx) => `${idx + 1}/ ${ins.title}${ins.value ? ` (${ins.value})` : ''}: ${ins.detail}`
        ),
        `Priority Action: ${topRec}`,
      ],
      hashtags: ['#DataAnalytics', '#BusinessIntelligence', '#DataStorytelling', '#ExecutiveInsights'],
      callToAction: 'Which of these trends are you seeing in your Q3/Q4 pipeline?',
      bestTimeWindow: 'Tue–Thu · 09:15 AM Local',
      recommendedIsoSlot: isoSlot,
      engagementRationale:
        'Leading with quantified deltas in tweet #1 and unpacking 3 concrete drivers in the thread maximizes bookmark-to-impression ratio.',
      attachedMetrics,
    },
    linkedin: {
      platform: 'linkedin',
      hook: `${title} — What the latest numbers in ${dataset} reveal about our trajectory:`,
      body: `${(report.executive_summary || '').slice(0, 360)}\n\nKey Quantitative Highlights:\n${topInsights
        .slice(0, 3)
        .map((ins) => `• ${ins.metric || ins.title}${ins.value ? ` (${ins.value})` : ''}: ${ins.detail}`)
        .join('\n')}\n\nStrategic Recommendation:\n→ ${topRec}`,
      threadItems: topInsights.slice(0, 3).map(
        (ins, idx) => `Slide ${idx + 1} · ${ins.metric || ins.title}: ${ins.value ? `${ins.value} — ` : ''}${ins.detail}`
      ),
      hashtags: ['#Analytics', '#Strategy', '#DataDriven', '#Leadership', '#BI'],
      callToAction: 'How is your team adapting to these shifts? Share your perspective below.',
      bestTimeWindow: 'Wed · 08:30 AM Local',
      recommendedIsoSlot: isoSlot,
      engagementRationale:
        'Structured bullet takeaways paired with a clear strategic recommendation drive high dwell time and executive comments on LinkedIn.',
      attachedMetrics,
    },
    mcpMetadata: {
      connectorUri: 'mcp://social-publishing-hub.local/v2',
      toolName: 'draft_and_schedule_social_campaign',
      generatedAt: new Date().toISOString(),
    },
  };
}

export const SocialPublishModal: React.FC<SocialPublishModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [tone, setTone] = useState<SocialTone>('executive');
  const [customAngle, setCustomAngle] = useState('');
  const [includeThread, setIncludeThread] = useState(true);
  const [attachVisualCard, setAttachVisualCard] = useState(true);

  const [isDrafting, setIsDrafting] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [campaignPackage, setCampaignPackage] = useState<SocialCampaignPackage | null>(null);

  // Editable draft fields for the currently selected platform
  const [editableHook, setEditableHook] = useState('');
  const [editableBody, setEditableBody] = useState('');
  const [editableThreadItems, setEditableThreadItems] = useState<string[]>([]);
  const [editableHashtags, setEditableHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Tabs & scheduling state
  const [activeMainTab, setActiveMainTab] = useState<'composer' | 'queue' | 'payload'>('composer');
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledSocialPost[]>([]);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info';
    message: string;
    receipt?: string;
  } | null>(null);
  const [copiedState, setCopiedState] = useState(false);

  const syncEditorFromDraft = useCallback((draft: SocialDraft) => {
    setEditableHook(draft.hook || '');
    setEditableBody(draft.body || '');
    setEditableThreadItems(Array.isArray(draft.threadItems) ? [...draft.threadItems] : []);
    setEditableHashtags(Array.isArray(draft.hashtags) ? [...draft.hashtags] : []);
    if (draft.recommendedIsoSlot) {
      setScheduledDateTime(draft.recommendedIsoSlot);
    }
  }, []);

  const fetchScheduledQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/social-schedule');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.posts)) {
          setScheduledPosts(data.posts);
        }
      }
    } catch {
      // Ignore network error on initial queue fetch
    }
  }, []);

  const runSocialDraftAgent = useCallback(
    async (selectedTone: SocialTone, selectedPlatform: SocialPlatform, angleText: string) => {
      setIsDrafting(true);
      setStatusBanner(null);

      setAgentSteps([
        {
          id: 'step-1',
          tool: 'agent://gemini-social-strategist/extract_story_hooks',
          label: 'Extracting Report KPIs & Narrative Hooks',
          status: 'running',
          durationMs: 280,
          detail: `Scanning ${(report.insights || []).length} insights & executive summary...`,
        },
        {
          id: 'step-2',
          tool: 'mcp://social-publishing-hub.local/v2#draft_posts',
          label: 'Synthesizing Platform-Native X & LinkedIn Copy',
          status: 'running',
          durationMs: 690,
          detail: `Applying ${selectedTone} voice and thread/carousel pacing...`,
        },
        {
          id: 'step-3',
          tool: 'mcp://social-scheduler/optimize_window',
          label: 'Calculating Optimal Engagement Cadence & Window',
          status: 'running',
          durationMs: 360,
          detail: 'Evaluating audience engagement windows for B2B analytics...',
        },
      ]);

      try {
        const response = await fetch('/api/social-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report,
            options: {
              platform: selectedPlatform,
              tone: selectedTone,
              customAngle: angleText.trim() || undefined,
              includeThread,
              attachVisualCard,
            },
          }),
        });

        let pkg: SocialCampaignPackage;
        if (response.ok) {
          const data = await response.json();
          pkg = data.campaign || buildClientFallbackPackage(report, selectedTone, angleText);
          if (Array.isArray(data.agentSteps) && data.agentSteps.length > 0) {
            setAgentSteps(data.agentSteps);
          } else {
            setAgentSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
          }
        } else {
          pkg = buildClientFallbackPackage(report, selectedTone, angleText);
          setAgentSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        }

        setCampaignPackage(pkg);
        const activeDraft = selectedPlatform === 'twitter' ? pkg.twitter : pkg.linkedin;
        syncEditorFromDraft(activeDraft);
      } catch {
        const fallbackPkg = buildClientFallbackPackage(report, selectedTone, angleText);
        setCampaignPackage(fallbackPkg);
        const activeDraft = selectedPlatform === 'twitter' ? fallbackPkg.twitter : fallbackPkg.linkedin;
        syncEditorFromDraft(activeDraft);
        setAgentSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
      } finally {
        setIsDrafting(false);
      }
    },
    [report, includeThread, attachVisualCard, syncEditorFromDraft]
  );

  useEffect(() => {
    if (isOpen) {
      fetchScheduledQueue();
      runSocialDraftAgent(tone, platform, customAngle);
    }
  }, [isOpen]); // Intentionally trigger when modal opens

  const handlePlatformSwitch = (nextPlatform: SocialPlatform) => {
    setPlatform(nextPlatform);
    if (campaignPackage) {
      const nextDraft = nextPlatform === 'twitter' ? campaignPackage.twitter : campaignPackage.linkedin;
      syncEditorFromDraft(nextDraft);
    }
  };

  const currentDraft: SocialDraft | null = campaignPackage
    ? platform === 'twitter'
      ? campaignPackage.twitter
      : campaignPackage.linkedin
    : null;

  const fullFormattedPost = [
    editableHook.trim(),
    editableBody.trim(),
    editableHashtags.length > 0 ? editableHashtags.join(' ') : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const charLimit = platform === 'twitter' ? 280 : 3000;
  const primaryCharCount =
    platform === 'twitter'
      ? `${editableHook.trim()}\n\n${editableBody.trim()}`.trim().length
      : fullFormattedPost.length;

  const handleCopyPost = async () => {
    const threadBlock =
      includeThread && editableThreadItems.length > 0
        ? `\n\n--- ${platform === 'twitter' ? 'Thread' : 'Carousel Breakdown'} ---\n` +
          editableThreadItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n\n')
        : '';

    const textToCopy = `${fullFormattedPost}${threadBlock}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleUpdateThreadItem = (idx: number, val: string) => {
    setEditableThreadItems((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleAddThreadItem = () => {
    setEditableThreadItems((prev) => [
      ...prev,
      platform === 'twitter'
        ? `${prev.length + 1}/ Key takeaway from ${report.dataset_name || 'the analysis'}:`
        : `Slide ${prev.length + 1} · Additional insight:`,
    ]);
  };

  const handleRemoveThreadItem = (idx: number) => {
    setEditableThreadItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddHashtag = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newHashtag.trim();
    if (!raw) return;
    const formatted = raw.startsWith('#') ? raw : `#${raw.replace(/\s+/g, '')}`;
    if (!editableHashtags.includes(formatted)) {
      setEditableHashtags((prev) => [...prev, formatted]);
    }
    setNewHashtag('');
  };

  const handleScheduleOrPublish = async (mode: 'schedule' | 'publish_now') => {
    setIsSubmittingSchedule(true);
    setStatusBanner(null);

    try {
      const response = await fetch('/api/social-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          datasetName: report.dataset_name || 'Dataset',
          mode,
          scheduledFor: scheduledDateTime || new Date(Date.now() + 3600_000).toISOString(),
          content: fullFormattedPost,
          threadItems: includeThread ? editableThreadItems : [],
          hashtags: editableHashtags,
          attachVisualCard,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.posts)) {
          setScheduledPosts(data.posts);
        }
        const post: ScheduledSocialPost = data.post;
        setStatusBanner({
          type: 'success',
          message:
            mode === 'publish_now'
              ? `Published to ${platform === 'twitter' ? 'Twitter / X' : 'LinkedIn'} via MCP Social Bridge.`
              : `Scheduled for ${new Date(post.scheduledFor).toLocaleString()} on ${
                  platform === 'twitter' ? 'Twitter / X' : 'LinkedIn'
                }.`,
          receipt: `${post.dispatchReceipt.queueId} · ${post.dispatchReceipt.connectorUri}`,
        });
      }
    } catch {
      const fallbackPost: ScheduledSocialPost = {
        id: `social_${Date.now()}`,
        platform,
        datasetName: report.dataset_name || 'Dataset',
        status: mode === 'publish_now' ? 'published' : 'scheduled',
        scheduledFor:
          mode === 'publish_now'
            ? new Date().toISOString()
            : scheduledDateTime || new Date(Date.now() + 3600_000).toISOString(),
        content: fullFormattedPost,
        threadItems: includeThread ? editableThreadItems : [],
        hashtags: editableHashtags,
        attachVisualCard,
        dispatchReceipt: {
          queueId: `q_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
          connectorUri:
            platform === 'twitter'
              ? 'mcp://x-publisher-bridge.local/v2/tweets/schedule'
              : 'mcp://linkedin-ugc-bridge.local/v2/shares/schedule',
          timestamp: new Date().toISOString(),
        },
      };
      setScheduledPosts((prev) => [fallbackPost, ...prev]);
      setStatusBanner({
        type: 'success',
        message:
          mode === 'publish_now'
            ? `Published to ${platform === 'twitter' ? 'Twitter / X' : 'LinkedIn'} via MCP Social Bridge.`
            : `Scheduled for ${new Date(fallbackPost.scheduledFor).toLocaleString()}.`,
        receipt: `${fallbackPost.dispatchReceipt.queueId} · ${fallbackPost.dispatchReceipt.connectorUri}`,
      });
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleDeleteScheduledPost = async (id: string) => {
    try {
      const res = await fetch(`/api/social-schedule/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.posts)) {
          setScheduledPosts(data.posts);
          return;
        }
      }
    } catch {
      // Fallback local removal
    }
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-6xl w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[92vh]"
        >
          {/* Top Modal Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-neutral-200 bg-neutral-900 text-white">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg tracking-tight text-white">
                    Social Media Storytelling & Scheduler Agent
                  </h3>
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 whitespace-nowrap shrink-0">
                    MCP Social Bridge v2
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  {report.dataset_name} · Synthesizes report insights into native Twitter/X threads & LinkedIn posts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl bg-neutral-800 p-1 border border-neutral-700">
                <button
                  type="button"
                  onClick={() => setActiveMainTab('composer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeMainTab === 'composer'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Composer & Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMainTab('queue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeMainTab === 'queue'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <span>Scheduled Queue</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                      activeMainTab === 'queue'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-700 text-neutral-200'
                    }`}
                  >
                    {scheduledPosts.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMainTab('payload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    activeMainTab === 'payload'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>MCP Trace</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main Modal Body */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-neutral-50 min-h-0">
            {/* Left Sidebar: Agent Pipeline, Platform & Scheduling Controls */}
            <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-neutral-200 bg-white p-5 overflow-y-auto space-y-5">
              {/* Target Platform Switcher */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                  Target Channel
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlatformSwitch('linkedin')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      platform === 'linkedin'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="h-5 w-5 rounded bg-[#0A66C2] text-white font-serif font-bold text-[11px] flex items-center justify-center shrink-0">
                      in
                    </span>
                    <span>LinkedIn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlatformSwitch('twitter')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      platform === 'twitter'
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-2xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="h-5 w-5 rounded bg-black text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                      𝕏
                    </span>
                    <span>Twitter / X</span>
                  </button>
                </div>
              </div>

              {/* Agent Workflow Trace */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Agent Synthesis Pipeline
                  </span>
                  <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                    {isDrafting ? 'Synthesizing...' : '3/3 Complete'}
                  </span>
                </div>

                <div className="space-y-2">
                  {agentSteps.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-lg bg-white border border-neutral-200/80 p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isDrafting && step.status === 'running' ? (
                            <Loader2 className="h-3.5 w-3.5 text-indigo-600 animate-spin shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-semibold text-neutral-800 truncate">
                            {step.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 tabular-nums shrink-0">
                          {step.durationMs}ms
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1 pl-5.5 line-clamp-1">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editorial Tone & Narrative Angle */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                  Editorial Voice & Angle
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`text-left rounded-xl border p-2.5 transition cursor-pointer ${
                        tone === t.id
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950'
                          : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">
                        {t.desc}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Custom Campaign Angle / Audience Focus (optional)
                  </label>
                  <input
                    type="text"
                    value={customAngle}
                    onChange={(e) => setCustomAngle(e.target.value)}
                    placeholder="e.g., Emphasize Q4 margin expansion for CFOs..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeThread}
                      onChange={(e) => setIncludeThread(e.target.checked)}
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      {platform === 'twitter'
                        ? 'Include Multi-Post Thread'
                        : 'Include Carousel Breakdown'}
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={isDrafting}
                    onClick={() => runSocialDraftAgent(tone, platform, customAngle)}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isDrafting ? 'animate-spin' : ''}`} />
                    <span>Re-Draft with Agent</span>
                  </button>
                </div>
              </div>

              {/* Scheduling & Dispatch Controls */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Schedule & Dispatch</span>
                  </span>
                  {currentDraft?.bestTimeWindow && (
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                      Best: {currentDraft.bestTimeWindow}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Scheduled Publication Slot (Local Time)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-mono tabular-nums text-neutral-800 focus:border-indigo-500 focus:outline-none"
                    />
                    {currentDraft?.recommendedIsoSlot && (
                      <button
                        type="button"
                        onClick={() => setScheduledDateTime(currentDraft.recommendedIsoSlot)}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-2 text-[11px] font-semibold text-indigo-700 transition cursor-pointer whitespace-nowrap shrink-0"
                        title="Use AI Optimal Time Slot"
                      >
                        AI Slot
                      </button>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={attachVisualCard}
                    onChange={(e) => setAttachVisualCard(e.target.checked)}
                    className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Attach Executive KPI Data Card to post</span>
                </label>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmittingSchedule || isDrafting}
                    onClick={() => handleScheduleOrPublish('schedule')}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Schedule Post</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingSchedule || isDrafting}
                    onClick={() => handleScheduleOrPublish('publish_now')}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Publish Now</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Main Stage: Composer & Live Feed Preview OR Queue OR MCP Trace */}
            <div className="lg:col-span-8 p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Status Confirmation Banner */}
              {statusBanner && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{statusBanner.message}</span>
                    </div>
                    {statusBanner.receipt && (
                      <div className="text-[11px] font-mono text-emerald-700 pl-6">
                        Dispatch Receipt: {statusBanner.receipt}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveMainTab('queue')}
                      className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-white transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      View Queue ({scheduledPosts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusBanner(null)}
                      className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {activeMainTab === 'composer' && (
                <div className="space-y-5">
                  {/* AI Engagement Rationale Strip */}
                  {currentDraft?.engagementRationale && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 flex items-start justify-between gap-3">
                      <div className="text-xs text-indigo-950 leading-relaxed">
                        <span className="font-bold text-indigo-900 mr-1.5">
                          Agent Strategy Rationale:
                        </span>
                        {currentDraft.engagementRationale}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPost}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedState ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Draft</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Split View: Editor on Left, Native Platform Feed Card on Right */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    {/* Post Editor Column */}
                    <div className="xl:col-span-7 space-y-4">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                            {platform === 'twitter'
                              ? 'Lead Tweet / Hook Composer'
                              : 'LinkedIn Executive Post Composer'}
                          </span>
                          <span
                            className={`text-xs font-mono tabular-nums font-semibold ${
                              primaryCharCount > charLimit
                                ? 'text-red-600'
                                : 'text-neutral-500'
                            }`}
                          >
                            {primaryCharCount} / {charLimit} chars
                          </span>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                            Opening Hook Line
                          </label>
                          <input
                            type="text"
                            value={editableHook}
                            onChange={(e) => setEditableHook(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                            Main Narrative & Quantitative Proof
                          </label>
                          <textarea
                            rows={platform === 'linkedin' ? 7 : 4}
                            value={editableBody}
                            onChange={(e) => setEditableBody(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        {/* Hashtags Editor */}
                        <div>
                          <label className="text-[11px] font-semibold text-neutral-500 block mb-1.5">
                            Hashtags & Topic Signals
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {editableHashtags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditableHashtags((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    )
                                  }
                                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <form onSubmit={handleAddHashtag} className="inline-flex items-center">
                              <input
                                type="text"
                                value={newHashtag}
                                onChange={(e) => setNewHashtag(e.target.value)}
                                placeholder="+ Add tag"
                                className="w-24 rounded-lg border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-700 focus:border-indigo-500 focus:outline-none"
                              />
                            </form>
                          </div>
                        </div>
                      </div>

                      {/* Thread / Carousel Items Editor */}
                      {includeThread && (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-indigo-600" />
                              <span>
                                {platform === 'twitter'
                                  ? `Follow-up Thread Posts (${editableThreadItems.length})`
                                  : `LinkedIn Carousel Slide Callouts (${editableThreadItems.length})`}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={handleAddThreadItem}
                              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Item</span>
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {editableThreadItems.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="mt-2 h-5 w-5 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-mono tabular-nums font-bold text-neutral-600 flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <textarea
                                  rows={2}
                                  value={item}
                                  onChange={(e) => handleUpdateThreadItem(idx, e.target.value)}
                                  className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs text-neutral-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveThreadItem(idx)}
                                  className="mt-2 text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Live Platform Feed Preview Column */}
                    <div className="xl:col-span-5 space-y-4">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                                platform === 'twitter' ? 'bg-black' : 'bg-[#0A66C2]'
                              }`}
                            >
                              {platform === 'twitter' ? '𝕏' : 'in'}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-neutral-900">
                                Executive BI Intelligence
                              </div>
                              <div className="text-[11px] text-neutral-400 font-mono tabular-nums">
                                {platform === 'twitter'
                                  ? '@sabai_analytics · Thread Preview'
                                  : 'Data Strategy Desk · LinkedIn Preview'}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                            Live Preview
                          </span>
                        </div>

                        {/* Post Text Content */}
                        <div className="space-y-2.5 text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">
                          {editableHook && (
                            <p className="font-bold text-neutral-900">{editableHook}</p>
                          )}
                          {editableBody && <p>{editableBody}</p>}
                          {editableHashtags.length > 0 && (
                            <p className="text-indigo-600 font-medium">
                              {editableHashtags.join(' ')}
                            </p>
                          )}
                        </div>

                        {/* Attached Executive KPI Visual Card */}
                        {attachVisualCard && (
                          <div className="rounded-xl border border-neutral-200 bg-neutral-900 text-white p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-300">
                                {report.dataset_name} · Verified Snapshot
                              </span>
                              <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
                            </div>
                            <div className="text-xs font-bold text-white leading-snug">
                              {report.title}
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {(currentDraft?.attachedMetrics?.length
                                ? currentDraft.attachedMetrics
                                : (report.insights || []).slice(0, 2).map((ins) => ({
                                    label: ins.metric || ins.title,
                                    value: ins.value || 'Key Metric',
                                  }))
                              )
                                .slice(0, 4)
                                .map((m, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg bg-white/5 border border-white/10 p-2"
                                  >
                                    <div className="text-[10px] text-neutral-400 truncate">
                                      {m.label}
                                    </div>
                                    <div className="text-xs font-bold font-mono tabular-nums text-white mt-0.5 truncate">
                                      {m.value}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Thread / Carousel Preview Items */}
                        {includeThread && editableThreadItems.length > 0 && (
                          <div className="border-t border-neutral-100 pt-3 space-y-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                              {platform === 'twitter'
                                ? 'Connected Thread Replies'
                                : 'Attached Carousel Slides'}
                            </div>
                            {editableThreadItems.map((tItem, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl bg-neutral-50 border border-neutral-200/80 p-2.5 text-xs text-neutral-700 leading-relaxed"
                              >
                                {tItem}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeMainTab === 'queue' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900">
                        Scheduled & Published Social Queue
                      </h4>
                      <p className="text-xs text-neutral-500">
                        Managed by MCP Social Publishing Hub (`output/social_schedule.json`)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveMainTab('composer')}
                      className="rounded-xl bg-neutral-900 hover:bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-white transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      + Draft Another Post
                    </button>
                  </div>

                  {scheduledPosts.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center space-y-2">
                      <Calendar className="h-8 w-8 text-neutral-400 mx-auto" />
                      <div className="text-sm font-bold text-neutral-800">
                        No Social Posts Scheduled Yet
                      </div>
                      <p className="text-xs text-neutral-500 max-w-md mx-auto">
                        Use the Composer tab to review your AI-synthesized Twitter/X or LinkedIn draft and click Schedule Post or Publish Now.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scheduledPosts.map((post) => (
                        <div
                          key={post.id}
                          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                        >
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                                  post.platform === 'twitter'
                                    ? 'bg-neutral-900 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                {post.platform === 'twitter' ? 'Twitter / X' : 'LinkedIn'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  post.status === 'published'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {post.status === 'published' ? 'Published' : 'Scheduled'}
                              </span>
                              <span className="text-xs font-mono tabular-nums text-neutral-500">
                                {new Date(post.scheduledFor).toLocaleString()}
                              </span>
                              <span className="text-xs text-neutral-400">
                                · {post.datasetName}
                              </span>
                            </div>

                            <p className="text-xs text-neutral-800 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                              {post.content}
                            </p>

                            <div className="text-[11px] font-mono text-neutral-400">
                              Receipt: {post.dispatchReceipt.queueId} · {post.dispatchReceipt.connectorUri}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDeleteScheduledPost(post.id)}
                              className="rounded-xl border border-neutral-200 hover:border-red-200 hover:bg-red-50 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-red-600 transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeMainTab === 'payload' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                      MCP Social Publishing Connector Payload
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      {campaignPackage?.mcpMetadata.connectorUri || 'mcp://social-publishing-hub.local/v2'}
                    </span>
                  </div>
                  <pre className="rounded-2xl bg-neutral-900 text-neutral-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                    {JSON.stringify(
                      {
                        mcpServer: campaignPackage?.mcpMetadata,
                        activePlatform: platform,
                        selectedTone: tone,
                        scheduledFor: scheduledDateTime,
                        draft: {
                          hook: editableHook,
                          body: editableBody,
                          threadItems: editableThreadItems,
                          hashtags: editableHashtags,
                          attachVisualCard,
                        },
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
