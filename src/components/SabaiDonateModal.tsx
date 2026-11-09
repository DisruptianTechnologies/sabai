import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import {
  X,
  Heart,
  QrCode,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Globe2,
  Sparkles,
  CheckCircle2,
  Building2,
} from 'lucide-react';

interface SabaiDonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentNetwork = 'upi' | 'global';

interface DonationPreset {
  id: string;
  usd: number;
  inr: number;
  label: string;
  impact: string;
}

const DONATION_PRESETS: DonationPreset[] = [
  {
    id: 'tier-1',
    usd: 10,
    inr: 500,
    label: 'Citizen Supporter',
    impact: 'Funds open data literacy guides for 5 students',
  },
  {
    id: 'tier-2',
    usd: 25,
    inr: 2000,
    label: 'Transparency Advocate',
    impact: 'Supports public dataset cleaning & RTI indexing',
  },
  {
    id: 'tier-3',
    usd: 50,
    inr: 5000,
    label: 'Civic Data Fellow',
    impact: 'Sponsors community data-storytelling workshops',
  },
  {
    id: 'tier-4',
    usd: 100,
    inr: 10000,
    label: 'Foundation Patron',
    impact: 'Sustains open-access AI analytics infrastructure',
  },
];

const INITIATIVE_FUNDS = [
  {
    id: 'access-info',
    title: 'Better Access to Public Information',
    desc: 'Digitizing, auditing, and opening civic datasets for public scrutiny',
  },
  {
    id: 'data-literacy',
    title: 'Public Data Awareness & Literacy',
    desc: 'Training educators, journalists, and citizens in visual data storytelling',
  },
  {
    id: 'open-ai-infra',
    title: 'Open Civic Analytics Infrastructure',
    desc: 'Keeping SABAI Data Storytelling free and accessible for nonprofits',
  },
];

const OFFICIAL_UPI_QR_IMAGE = '/assets/aistudio/sabai_foundation_qr_code_2c6d9e01.jpeg';
const OFFICIAL_UPI_ID = '81k1byfou2ce@mahb';

export const SabaiDonateModal: React.FC<SabaiDonateModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [network, setNetwork] = useState<PaymentNetwork>('upi');
  const [upiQrDisplayMode, setUpiQrDisplayMode] = useState<'official_card' | 'dynamic_amount'>('official_card');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('tier-2');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedFund, setSelectedFund] = useState<string>('access-info');
  const [donorName, setDonorName] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUri, setCopiedUri] = useState<boolean>(false);
  const [pledgeConfirmed, setPledgeConfirmed] = useState<{
    receiptId: string;
    timestamp: string;
    amountDisplay: string;
  } | null>(null);

  const activePreset =
    DONATION_PRESETS.find((p) => p.id === selectedPresetId) || DONATION_PRESETS[1];

  const numericAmount = customAmount.trim()
    ? Math.max(1, parseFloat(customAmount) || 0)
    : network === 'upi'
      ? activePreset.inr
      : activePreset.usd;

  const currencySymbol = network === 'upi' ? '₹' : '$';
  const currencyCode = network === 'upi' ? 'INR' : 'USD';
  const amountDisplay = `${currencySymbol}${numericAmount.toLocaleString()}`;

  const activeFundObj =
    INITIATIVE_FUNDS.find((f) => f.id === selectedFund) || INITIATIVE_FUNDS[0];

  // Build standard scannable QR payload using official SABAI Foundation UPI ID (81k1byfou2ce@mahb)
  const qrPayloadUri =
    network === 'upi'
      ? `upi://pay?pa=${OFFICIAL_UPI_ID}&pn=${encodeURIComponent(
          'SABAI FOUNDATION'
        )}&am=${numericAmount}&cu=INR&tn=${encodeURIComponent(
          `SABAI Foundation - ${activeFundObj.title}`
        )}`
      : `https://sabaifoundation.org/donate?program=${encodeURIComponent(
          selectedFund
        )}&amount=${numericAmount}&currency=${currencyCode}&org=SABAI_Foundation`;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    QRCode.toDataURL(qrPayloadUri, {
      width: 360,
      margin: 2,
      color: {
        dark: '#090d16',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        // Ignore QR generation error
      });

    return () => {
      active = false;
    };
  }, [isOpen, qrPayloadUri]);

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(
        network === 'upi' ? OFFICIAL_UPI_ID : qrPayloadUri
      );
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const displayedQrSrc =
    network === 'upi' && upiQrDisplayMode === 'official_card'
      ? OFFICIAL_UPI_QR_IMAGE
      : qrDataUrl;

  const handleDownloadQrVoucher = useCallback(() => {
    const sourceImageUrl = displayedQrSrc || OFFICIAL_UPI_QR_IMAGE;
    if (!sourceImageUrl) return;

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top Gold Accent Bar
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 14);

    // Header Branding
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('SABAI FOUNDATION · OFFICIAL CONTRIBUTION QR PASS', 60, 78);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('Society for Awareness and', 60, 130);
    ctx.fillText('Better Access to Information', 60, 174);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Program: ${activeFundObj.title}`, 60, 224);
    ctx.fillText(`Contribution Pledge: ${amountDisplay} (${currencyCode})`, 60, 258);

    // White QR Container Card
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(190, 295, 520, 560, 28);
    ctx.fill();

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      // Preserve aspect ratio inside the 480x520 box
      const boxW = 480;
      const boxH = 520;
      const scale = Math.min(boxW / qrImg.width, boxH / qrImg.height);
      const drawW = qrImg.width * scale;
      const drawH = qrImg.height * scale;
      const drawX = 190 + (520 - drawW) / 2;
      const drawY = 295 + (560 - drawH) / 2;
      ctx.drawImage(qrImg, drawX, drawY, drawW, drawH);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        network === 'upi'
          ? `UPI ID: ${OFFICIAL_UPI_ID}`
          : 'sabaifoundation.org/donate',
        canvas.width / 2,
        910
      );

      ctx.fillStyle = '#64748b';
      ctx.font = '18px sans-serif';
      ctx.fillText(
        'Scan with any UPI app or mobile camera to support open data literacy & civic access.',
        canvas.width / 2,
        955
      );

      ctx.fillStyle = '#fbbf24';
      ctx.font = '16px monospace';
      ctx.fillText(
        `Generated ${new Date().toISOString().slice(0, 10)} · SABAI Data Storytelling Platform`,
        canvas.width / 2,
        1085
      );

      const link = document.createElement('a');
      link.download = `SABAI_Foundation_Donate_QR_${numericAmount}_${currencyCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = sourceImageUrl;
  }, [displayedQrSrc, activeFundObj.title, amountDisplay, currencyCode, network, numericAmount]);

  const handleConfirmPledge = () => {
    const receiptId = `SABAI-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setPledgeConfirmed({
      receiptId,
      timestamp: new Date().toLocaleTimeString(),
      amountDisplay,
    });
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
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[92vh]"
        >
          {/* Top Modal Header */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 bg-[#090d16] text-white border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                <Heart className="h-5 w-5 fill-amber-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg tracking-tight text-white">
                    Support SABAI Foundation
                  </h3>
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 whitespace-nowrap shrink-0">
                    Promoter Initiative
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Society for Awareness and Better Access to Information
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
              aria-label="Close donate modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 bg-neutral-50">
            {/* Left Column: Mission, Tiers & Allocation */}
            <div className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-neutral-200 bg-white">
              {/* Promoter Mission Statement */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800">
                  <Building2 className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>SABAI Foundation Mission</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  <strong>Society for Awareness and Better Access to Information (SABAI)</strong> promotes open civic data intelligence, statistical literacy, and transparent public-interest storytelling. Every contribution directly funds free public access and training.
                </p>
              </div>

              {/* Payment Mode Switcher */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                  1. Choose Contribution Rail
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNetwork('upi');
                      setCustomAmount('');
                    }}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                      network === 'upi'
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <QrCode className="h-4 w-4 text-amber-400" />
                    <span>Instant UPI QR (₹ INR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNetwork('global');
                      setCustomAmount('');
                    }}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                      network === 'global'
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <Globe2 className="h-4 w-4 text-sky-400" />
                    <span>Global Grant QR ($ USD)</span>
                  </button>
                </div>
              </div>

              {/* Preset Amount Selector */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                  2. Select Impact Tier
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {DONATION_PRESETS.map((preset) => {
                    const isSelected = !customAmount.trim() && selectedPresetId === preset.id;
                    const amt = network === 'upi' ? `₹${preset.inr.toLocaleString()}` : `$${preset.usd}`;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          setCustomAmount('');
                        }}
                        className={`text-left rounded-2xl border p-3 transition cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-400/50'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-base font-extrabold font-mono tabular-nums text-neutral-900">
                            {amt}
                          </span>
                          <span className="text-[11px] font-bold text-amber-800">
                            {preset.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-1 line-clamp-1">
                          {preset.impact}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount & Donor Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                      Custom Amount ({currencySymbol} {currencyCode})
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={`Enter custom ${currencyCode} amount...`}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono tabular-nums text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                      Supporter Name (Optional for Pass)
                    </label>
                    <input
                      type="text"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="Citizen / Organization name"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Program Allocation */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                  3. Direct Your Impact
                </span>
                <div className="space-y-2">
                  {INITIATIVE_FUNDS.map((fund) => (
                    <label
                      key={fund.id}
                      onClick={() => setSelectedFund(fund.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                        selectedFund === fund.id
                          ? 'border-neutral-900 bg-neutral-900/5'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sabai_fund"
                        checked={selectedFund === fund.id}
                        onChange={() => setSelectedFund(fund.id)}
                        className="mt-0.5 text-neutral-900 focus:ring-neutral-900"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900">
                          {fund.title}
                        </div>
                        <div className="text-[11px] text-neutral-600 mt-0.5">
                          {fund.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Live Scannable QR Code Card & Actions */}
            <div className="lg:col-span-5 p-6 flex flex-col justify-between bg-neutral-100/80 space-y-5">
              <div className="rounded-3xl bg-[#090d16] text-white p-5 shadow-xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                      SABAI FOUNDATION · QR GATEWAY
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      Scan & Pay · {amountDisplay}
                    </div>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                </div>

                {/* UPI QR Mode Switcher: Official Bank QR Card vs Pre-filled Amount QR */}
                {network === 'upi' && (
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-900 p-1 border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setUpiQrDisplayMode('official_card')}
                      className={`rounded-lg py-1.5 px-2 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        upiQrDisplayMode === 'official_card'
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Official Bank QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpiQrDisplayMode('dynamic_amount')}
                      className={`rounded-lg py-1.5 px-2 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        upiQrDisplayMode === 'dynamic_amount'
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Pre-filled {amountDisplay} QR
                    </button>
                  </div>
                )}

                {/* Official SABAI Foundation Scan & Pay UPI QR Code / Dynamic QR */}
                <div className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
                  {displayedQrSrc ? (
                    <img
                      src={displayedQrSrc}
                      alt={`SABAI Foundation UPI QR Code (${OFFICIAL_UPI_ID})`}
                      className="w-56 h-64 sm:w-60 sm:h-68 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-xs text-neutral-400 font-mono">
                      Generating QR...
                    </div>
                  )}
                  <div className="mt-2 text-[11px] font-mono font-bold text-neutral-800 tabular-nums text-center">
                    {amountDisplay} · {activeFundObj.title.slice(0, 30)}
                  </div>
                </div>

                {/* Payment Identifier Strip */}
                <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">
                      {network === 'upi' ? 'Official Foundation UPI ID' : 'Direct Contribution Link'}
                    </div>
                    <div className="text-xs font-mono text-amber-300 truncate">
                      {network === 'upi' ? OFFICIAL_UPI_ID : 'sabaifoundation.org/donate'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUri}
                    className="flex items-center gap-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 text-[11px] font-semibold text-white transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedUri ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy UPI ID</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadQrVoucher}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2.5 text-xs font-semibold text-white transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 text-sky-400" />
                    <span>Save QR Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmPledge}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-2.5 text-xs font-bold text-neutral-950 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Log Contribution</span>
                  </button>
                </div>
              </div>

              {/* Pledge Receipt Confirmation */}
              {pledgeConfirmed ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Thank You for Supporting SABAI Foundation!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Pledge of <strong className="font-mono">{pledgeConfirmed.amountDisplay}</strong>{donorName ? ` by ${donorName}` : ''} logged for <strong>{activeFundObj.title}</strong>.
                  </p>
                  <div className="text-[10px] font-mono text-emerald-700 tabular-nums">
                    Receipt ID: {pledgeConfirmed.receiptId} · {pledgeConfirmed.timestamp}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500 leading-relaxed text-center px-2">
                  Scan the QR code with any mobile camera or UPI app, or download the official QR pass for institutional reimbursement.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
