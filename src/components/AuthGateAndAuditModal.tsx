import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Mail,
  KeyRound,
  User as UserIcon,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  LogOut,
  AlertCircle,
  BarChart3,
  Table2,
} from 'lucide-react';
import type { AnalysisReport } from '../types';
import {
  googleSignIn,
  emailPasswordSignInOrUp,
  syncLoginEntriesToGoogleSheet,
  getAccessToken,
  getActiveSpreadsheetInfo,
  type AuthenticatedAnalyst,
  type LoginAuditEntry,
} from '../lib/authAndSheets';

export const OfficialGoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="gsi-material-button w-full flex items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800 shadow-2xs transition cursor-pointer disabled:opacity-50"
  >
    <div className="gsi-material-button-icon h-5 w-5 shrink-0">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        style={{ display: 'block', width: '20px', height: '20px' }}
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </div>
    <span className="gsi-material-button-contents whitespace-nowrap">{label}</span>
  </button>
);

interface AnalysisAuthGateProps {
  report: AnalysisReport | null;
  datasetName: string;
  question: string;
  isRunning?: boolean;
  stage?: string;
  onAuthenticated: (
    analyst: AuthenticatedAnalyst,
    sheetSyncResult?: { spreadsheetId: string; spreadsheetUrl: string }
  ) => void;
}

export const AnalysisAuthGate: React.FC<AnalysisAuthGateProps> = ({
  report,
  datasetName,
  question,
  isRunning = false,
  stage = '',
  onAuthenticated,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consentSheetsSync, setConsentSheetsSync] = useState(true);
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recordLoginAndSyncToSheet = async (
    analyst: AuthenticatedAnalyst,
    hasGoogleToken: boolean
  ) => {
    // 1. Save login detail to server MCP Audit Log
    const auditRes = await fetch('/api/auth/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: analyst.uid,
        email: analyst.email,
        displayName: analyst.displayName,
        authProvider: analyst.provider,
        datasetName: report?.dataset_name || datasetName || 'Uploaded Dataset',
        question: report?.question || question || 'Data Analysis Inquiry',
        syncedToSheet: false,
      }),
    });

    let createdEntry: LoginAuditEntry | null = null;
    if (auditRes.ok) {
      const data = await auditRes.json();
      createdEntry = data.entry || null;
    }

    // 2. If user consented and we have a Google Sheets OAuth token, append row directly to Google Sheets
    let sheetSyncResult: { spreadsheetId: string; spreadsheetUrl: string } | undefined;
    if (consentSheetsSync && hasGoogleToken && createdEntry) {
      try {
        const res = await syncLoginEntriesToGoogleSheet(
          [createdEntry],
          customSheetInput.trim() || undefined
        );
        sheetSyncResult = {
          spreadsheetId: res.spreadsheetId,
          spreadsheetUrl: res.spreadsheetUrl,
        };
      } catch (sheetErr) {
        console.warn('Google Sheets auto-sync warning:', sheetErr);
      }
    }

    onAuthenticated(analyst, sheetSyncResult);
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { analyst } = await googleSignIn();
      await recordLoginAndSyncToSheet(analyst, true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { analyst } = await emailPasswordSignInOrUp(
        authMode,
        email,
        password,
        displayName
      );
      await recordLoginAndSyncToSheet(analyst, Boolean(getAccessToken()));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const insightCount = report?.insights?.length || 4;
  const chartCount = report?.charts?.length || 2;
  const tableCount = report?.tables?.length || 2;

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
      {/* Top Banner */}
      <div className="bg-[#090d16] text-white px-6 py-5 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Log In to Unlock Your Analysis Report
              </h2>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap shrink-0">
                {isRunning ? stage || 'Analyzing...' : 'Report Ready'}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              SABAI Foundation · Zero-Cost MCP Identity Vault & Google Sheets Login Audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
          <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Auto-logs login details to Google Sheets</span>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Teaser Preview of the Locked Analysis */}
        <div className="lg:col-span-6 p-6 sm:p-8 bg-neutral-50/80 border-b lg:border-b-0 lg:border-r border-neutral-200 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-io-blue">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Prepared for: {report?.dataset_name || datasetName || 'Dataset'}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 leading-snug">
              {report?.title || `Executive Intelligence Report: ${datasetName || 'Dataset'}`}
            </h3>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2 shadow-2xs">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Submitted Inquiry / Prompt
              </div>
              <p className="text-xs sm:text-sm font-medium text-neutral-800 leading-relaxed">
                “{report?.question || question || 'Summarize key trends and statistical drivers.'}”
              </p>
            </div>

            {/* Locked Metrics Summary Strip */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 text-center">
                <div className="text-xl font-extrabold font-mono tabular-nums text-neutral-900">
                  {insightCount}
                </div>
                <div className="text-[11px] text-neutral-500 font-medium mt-0.5">
                  KPI Insights
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 text-center">
                <div className="text-xl font-extrabold font-mono tabular-nums text-io-blue flex items-center justify-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>{chartCount}</span>
                </div>
                <div className="text-[11px] text-neutral-500 font-medium mt-0.5">
                  Trend Charts
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 text-center">
                <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 flex items-center justify-center gap-1">
                  <Table2 className="h-4 w-4" />
                  <span>{tableCount}</span>
                </div>
                <div className="text-[11px] text-neutral-500 font-medium mt-0.5">
                  Data Tables
                </div>
              </div>
            </div>

            {/* Blurred / Redacted Preview Snippet */}
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-4 relative overflow-hidden">
              <div className="text-xs font-bold text-neutral-700 mb-1">
                Executive AI Takeaway (Locked Preview)
              </div>
              <p className="text-xs text-neutral-500 select-none blur-[3px] leading-relaxed">
                {report?.executive_summary ||
                  'The autonomous analysis identified statistically significant trends across key segments, strong linear regression fit (R²), and actionable strategic recommendations ready for interactive inspection.'}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
                <Lock className="h-3.5 w-3.5" />
                <span>Sign in on the right to view full report, charts, infographics & PDF export</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-200 pt-4">
            <strong>Why sign in?</strong> SABAI Foundation maintains an open-access audit log in Google Sheets to track civic dataset utilization and preserve your analysis session at zero cost.
          </div>
        </div>

        {/* Right Column: Google Sign-In & Email/Password MCP Auth Form */}
        <div className="lg:col-span-6 p-6 sm:p-8 bg-white flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                Authenticate to View Your Results
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Choose Google Sign-In (recommended for instant Google Sheets logging) or Email & Password.
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Option 1: Official Sign in with Google */}
            <div className="space-y-2">
              <OfficialGoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                label="Sign in with Google & Sync to Sheets"
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-neutral-200" />
              <span className="shrink-0 mx-3 text-[11px] font-mono uppercase text-neutral-400">
                Or Email & Password (MCP Auth)
              </span>
              <div className="flex-grow border-t border-neutral-200" />
            </div>

            {/* Option 2: Simple Email & Password Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    authMode === 'signin'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authMode === 'signup' && (
                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Full Name / Organization
                  </label>
                  <div className="relative">
                    <UserIcon className="h-3.5 w-3.5 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Asha Verma · Civic Researcher"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:bg-white focus:border-io-blue focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.org"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:bg-white focus:border-io-blue focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                  Password (min 6 characters)
                </label>
                <div className="relative">
                  <KeyRound className="h-3.5 w-3.5 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:bg-white focus:border-io-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Optional Target Google Sheet ID/URL */}
              <div className="pt-1">
                <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                  Target Google Sheet URL or ID (Optional — auto-creates if blank)
                </label>
                <input
                  type="text"
                  value={customSheetInput}
                  onChange={(e) => setCustomSheetInput(e.target.value)}
                  placeholder="Leave blank to auto-create 'SABAI Foundation - Login & Analysis Audit Log'"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono text-neutral-800 focus:bg-white focus:border-io-blue focus:outline-none"
                />
              </div>

              {/* Explicit Permission Confirmation for Google Sheets Mutation */}
              <label className="flex items-start gap-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentSheetsSync}
                  onChange={(e) => setConsentSheetsSync(e.target.checked)}
                  className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="leading-snug text-[11px]">
                  <strong>Permission to Log to Google Sheets:</strong> I confirm that my login detail (email, timestamp, and dataset title) may be appended to the SABAI Foundation Google Sheets Audit Log.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-neutral-900 hover:bg-neutral-800 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Authenticating & Unlocking Report...'
                  : authMode === 'signin'
                    ? 'Sign In & Unlock Analysis'
                    : 'Create Account & Unlock Analysis'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AuthAndSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthenticatedAnalyst | null;
  onUserChange: (user: AuthenticatedAnalyst | null) => void;
  currentDatasetName?: string;
  currentQuestion?: string;
}

export const AuthAndSheetsModal: React.FC<AuthAndSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  currentDatasetName = 'Workspace Session',
  currentQuestion = 'Direct Sign-In',
}) => {
  const [auditLogs, setAuditLogs] = useState<LoginAuditEntry[]>([]);
  const [customSheetId, setCustomSheetId] = useState(
    getActiveSpreadsheetInfo().spreadsheetId || ''
  );
  const [sheetUrl, setSheetUrl] = useState<string | null>(
    getActiveSpreadsheetInfo().spreadsheetUrl
  );
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmSyncModal, setConfirmSyncModal] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/audit-log');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
          const firstWithUrl = data.logs.find((l: LoginAuditEntry) => l.spreadsheetUrl);
          if (firstWithUrl?.spreadsheetUrl && !sheetUrl) {
            setSheetUrl(firstWithUrl.spreadsheetUrl);
          }
        }
      }
    } catch {
      // Ignore error
    }
  }, [sheetUrl]);

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
    }
  }, [isOpen, fetchAuditLogs]);

  const handleConnectGoogleAndSync = async () => {
    setIsSyncingSheets(true);
    setSyncMessage(null);
    setConfirmSyncModal(false);
    try {
      let activeToken = getAccessToken();
      let activeUser = currentUser;

      if (!activeToken) {
        const { analyst } = await googleSignIn();
        activeUser = analyst;
        onUserChange(analyst);
        activeToken = getAccessToken();
      }

      if (!activeToken) {
        throw new Error('Could not obtain Google Sheets permission token.');
      }

      const unsynced = auditLogs.filter((l) => !l.syncedToSheet);
      const entriesToSync =
        unsynced.length > 0 ? unsynced : auditLogs.slice(0, 5);

      const res = await syncLoginEntriesToGoogleSheet(
        entriesToSync,
        customSheetId.trim() || undefined
      );

      setSheetUrl(res.spreadsheetUrl);
      setCustomSheetId(res.spreadsheetId);
      setSyncMessage({
        type: 'success',
        text: `Synced ${res.appendedCount} login record(s) to Google Sheet tab "${res.sheetTabName}".`,
      });
      await fetchAuditLogs();
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err?.message || 'Failed to sync login records to Google Sheets.',
      });
    } finally {
      setIsSyncingSheets(false);
    }
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
          className="bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 bg-[#090d16] text-white border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    Identity Vault & Google Sheets Login Audit Log
                  </h3>
                  <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    MCP Auth Bridge
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Every user login and unlocked analysis is recorded and synced to Google Sheets
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50">
            { !currentUser ? (
              <AnalysisAuthGate
                report={null}
                datasetName={currentDatasetName}
                question={currentQuestion}
                onAuthenticated={(analyst, sheetSync) => {
                  onUserChange(analyst);
                  if (sheetSync?.spreadsheetUrl) {
                    setSheetUrl(sheetSync.spreadsheetUrl);
                    setCustomSheetId(sheetSync.spreadsheetId);
                  }
                  fetchAuditLogs();
                }}
              />
            ) : (
              <>
                {/* Active User & Google Sheets Connection Bar */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-2xl bg-neutral-900 text-amber-400 flex items-center justify-center font-bold text-base shrink-0">
                      {currentUser.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900">
                          {currentUser.displayName}
                        </span>
                        <span className="text-xs font-mono text-neutral-500">
                          ({currentUser.email})
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {currentUser.provider}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Analysis access unlocked · Login audit active
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {sheetUrl && (
                      <a
                        href={sheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800 transition whitespace-nowrap shrink-0"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        <span>Open Live Google Sheet</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmSyncModal(true)}
                      disabled={isSyncingSheets}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                      <span>
                        {getAccessToken()
                          ? 'Sync Audit Log to Google Sheets'
                          : 'Connect Google & Sync to Sheets'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Explicit Confirmation Dialog for Mutating/Writing to Google Sheets */}
                {confirmSyncModal && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-amber-700" />
                          <span>Confirm Google Sheets Update</span>
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          This action will append {auditLogs.filter((l) => !l.syncedToSheet).length || auditLogs.slice(0, 5).length} login audit record(s) to{' '}
                          <strong>
                            {customSheetId.trim()
                              ? `Google Sheet (${customSheetId.trim().slice(0, 24)}...)`
                              : "'SABAI Foundation - Login & Analysis Audit Log'"}
                          </strong>
                          . Do you want to proceed?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleConnectGoogleAndSync}
                        className="rounded-xl bg-neutral-900 hover:bg-neutral-800 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        Confirm & Write to Google Sheet
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmSyncModal(false)}
                        className="rounded-xl border border-amber-300 bg-white hover:bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {syncMessage && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
                      syncMessage.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    <span className="font-medium">{syncMessage.text}</span>
                    <button
                      type="button"
                      onClick={() => setSyncMessage(null)}
                      className="text-xs font-bold underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Spreadsheet ID Configuration */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
                  <label className="text-xs font-bold text-neutral-700 block">
                    Target Google Sheet ID or URL (Leave blank to auto-create in your Google Drive)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={customSheetId}
                      onChange={(e) => setCustomSheetId(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/... or Spreadsheet ID"
                      className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-mono text-neutral-800 focus:bg-white focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Note: For Firebase Console Email/Password setup, you can enable the Email/Password sign-in provider in the Firebase Console under Authentication → Sign-in method. Meanwhile, the zero-cost MCP Identity Vault seamlessly authenticates Email & Password users out of the box.
                  </p>
                </div>

                {/* Recorded Login Audit Table */}
                <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-2xs">
                  <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                      Recorded User Logins & Unlocked Analyses ({auditLogs.length})
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      Columns: Timestamp · Email · Name · Provider · Dataset · Sheet Status
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-600 font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Timestamp</th>
                          <th className="px-4 py-2.5">User Email</th>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Auth Method</th>
                          <th className="px-4 py-2.5">Dataset / Analysis</th>
                          <th className="px-4 py-2.5">Google Sheet Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                              No login events recorded yet.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-neutral-50/70">
                              <td className="px-4 py-2.5 font-mono tabular-nums text-neutral-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 font-mono font-semibold text-neutral-900">
                                {log.email}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-700">
                                {log.displayName}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">
                                {log.authProvider}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-700 max-w-[200px] truncate">
                                {log.datasetName}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                {log.syncedToSheet ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Saved to Sheet</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                    Queued for Sheet Sync
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
