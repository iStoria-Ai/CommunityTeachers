import React, { useState, useMemo } from 'react';
import {
  X,
  GraduationCap,
  Users,
  Apple,
  Globe,
  Share,
  Check,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { generateQRCode, getQRCodeSvgPath } from '../utils/qrCode';

export type QRModalType = 'teachers' | 'library';

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: QRModalType;
  /** Explicit URL destination (defaults to official production addresses) */
  targetUrl?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  type,
  targetUrl
}) => {
  const [activeGuide, setActiveGuide] = useState<'ios' | 'android' | null>(null);
  const [copied, setCopied] = useState(false);

  const isTeachers = type === 'teachers';
  const resolvedUrl =
    targetUrl ||
    (isTeachers
      ? 'https://edo.communityteachers.info/'
      : 'https://edo.communityteachers.info/library/');

  // Generate crisp QR SVG path memoized on the target URL
  const qrSvg = useMemo(() => {
    const data = generateQRCode(resolvedUrl);
    return getQRCodeSvgPath(data, 7, 14);
  }, [resolvedUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(resolvedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (_) {
      // Fallback: window.open
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[390px] max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FAF7F0] border border-[#E0D8C6] p-5 sm:p-6 shadow-2xl flex flex-col gap-3.5 select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {isTeachers ? (
              <div className="w-8 h-8 rounded-lg bg-[#F2E8DC] border border-[#E2D2C0] flex items-center justify-center shrink-0 text-[#B87A1E]">
                <Users className="w-5 h-5 fill-current" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#E6F4ED] border border-[#C2E4D2] flex items-center justify-center shrink-0 text-[#D4A318]">
                <GraduationCap className="w-5 h-5 fill-current" />
              </div>
            )}
            <h2
              id="qr-modal-title"
              className="text-[20px] font-bold text-[#18241B] tracking-tight leading-tight truncate"
            >
              {isTeachers ? 'Community Teachers' : 'Community Library'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#EFE9DA] hover:bg-[#E2DAC7] active:scale-90 flex items-center justify-center text-[#3A453D] transition shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-[14px] text-[#556259] font-medium leading-snug">
          Scan to open on your phone or tablet
        </p>

        {/* QR Code Container (Crisp White Card) */}
        <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-2xl border border-[#E4DCB] shadow-2xs">
          <div className="w-[190px] h-[190px] sm:w-[205px] sm:h-[205px] flex items-center justify-center">
            <svg
              viewBox={`0 0 ${qrSvg.viewBoxSize} ${qrSvg.viewBoxSize}`}
              className="w-full h-full"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR Code pointing to ${resolvedUrl}`}
            >
              <rect
                x="0"
                y="0"
                width={qrSvg.viewBoxSize}
                height={qrSvg.viewBoxSize}
                fill="#FFFFFF"
              />
              <path d={qrSvg.path} fill="#18241B" />
            </svg>
          </div>
          <span className="mt-1 text-[11px] font-mono text-[#7D8880] truncate max-w-[240px]">
            {resolvedUrl}
          </span>
        </div>

        {/* Themed Branding Pill Box */}
        {isTeachers ? (
          <div className="rounded-2xl p-3.5 sm:p-4 bg-[#5D2C0C] text-white flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#7B3C13] border border-[#934919] flex items-center justify-center shrink-0 text-[#F5C242]">
              <Users className="w-6 h-6 fill-current" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] font-bold text-white leading-tight">
                Community Teachers
              </span>
              <span className="text-[13px] text-[#F3E5D8] leading-snug mt-0.5">
                Build to create a better tomorrow.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-3.5 sm:p-4 bg-[#135E35] text-white flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#187542] border border-[#238B52] flex items-center justify-center shrink-0 text-[#F5C242]">
              <GraduationCap className="w-6 h-6 fill-current" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] font-bold text-white leading-tight">
                Community Library
              </span>
              <span className="text-[13px] text-[#E0F2E9] leading-snug mt-0.5">
                Learn not to forget your culture.
              </span>
            </div>
          </div>
        )}

        {/* Get the App Section */}
        <div className="flex flex-col items-center pt-0.5">
          <h3 className="text-[16px] font-bold text-[#18241B] leading-tight">
            Get the App
          </h3>
          <p className="text-[12px] text-[#556259] leading-tight mt-0.5 text-center">
            You can also install this as an app on your phone or tablet.
          </p>

          {/* 3 Platform Install Cards */}
          <div className="grid grid-cols-3 gap-2 w-full mt-2.5">
            {/* Apple iPhone / iPad */}
            <button
              type="button"
              onClick={() => setActiveGuide(activeGuide === 'ios' ? null : 'ios')}
              className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 text-center ${
                activeGuide === 'ios'
                  ? 'bg-white border-[#18241B] shadow-xs'
                  : 'bg-[#F2ECE0] hover:bg-[#ECE4D5] border-[#DFD6C4]'
              }`}
            >
              <Apple className="w-6 h-6 text-[#18241B] fill-current" />
              <span className="text-[11px] font-semibold text-[#18241B] leading-tight">
                Install on iPhone / iPad
              </span>
            </button>

            {/* Android */}
            <button
              type="button"
              onClick={() => setActiveGuide(activeGuide === 'android' ? null : 'android')}
              className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 text-center ${
                activeGuide === 'android'
                  ? 'bg-white border-[#18241B] shadow-xs'
                  : 'bg-[#F2ECE0] hover:bg-[#ECE4D5] border-[#DFD6C4]'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 fill-[#3DDC84]"
                aria-hidden="true"
              >
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1.0002s.4482-1.0002.9993-1.0002c.5516 0 .9997.4486.9997 1.0002 0 .5516-.4481 1.0002-.9997 1.0002m-11.046 0c-.5511 0-.9993-.4486-.9993-1.0002s.4482-1.0002.9993-1.0002c.5516 0 .9997.4486.9997 1.0002 0 .5516-.4481 1.0002-.9997 1.0002m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8 12 8s-3.5902.4116-5.1368 1.4507L4.8409 5.9477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.2867 0 14.7744 0 18.8471h24c0-4.0727-2.6889-7.5604-6.1185-9.5257" />
              </svg>
              <span className="text-[11px] font-semibold text-[#18241B] leading-tight">
                Install on Android
              </span>
            </button>

            {/* Open in Browser */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-[#F2ECE0] hover:bg-[#ECE4D5] border border-[#DFD6C4] flex flex-col items-center justify-center gap-1.5 transition active:scale-90 text-center"
            >
              {copied ? (
                <Check className="w-6 h-6 text-[#157A4C] stroke-[2.5]" />
              ) : (
                <Globe className="w-6 h-6 text-[#18241B]" />
              )}
              <span className="text-[11px] font-semibold text-[#18241B] leading-tight">
                {copied ? 'Link Copied!' : 'Open in Browser'}
              </span>
            </button>
          </div>

          {/* Interactive Browser / PWA Guidance Box */}
          {activeGuide === 'ios' && (
            <div className="mt-3 w-full p-3 rounded-2xl bg-white border border-[#DFD6C4] text-left text-[12px] text-[#2C3830] space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-bold text-[#18241B]">
                <span>How to Install on iPhone / iPad:</span>
                <span className="text-[11px] font-normal text-[#66726A]">Safari</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#46534B]">
                <li>Tap the <strong>Share</strong> button (box with arrow up) at the bottom.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> at the top right to complete installation.</li>
              </ol>
            </div>
          )}

          {activeGuide === 'android' && (
            <div className="mt-3 w-full p-3 rounded-2xl bg-white border border-[#DFD6C4] text-left text-[12px] text-[#2C3830] space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-bold text-[#18241B]">
                <span>How to Install on Android:</span>
                <span className="text-[11px] font-normal text-[#66726A]">Chrome</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#46534B]">
                <li>Tap the <strong>menu</strong> (three dots <strong>⋮</strong>) at the top right.</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Tap <strong>Install</strong> to add it to your apps.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

