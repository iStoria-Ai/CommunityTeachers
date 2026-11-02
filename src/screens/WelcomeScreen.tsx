import React, { useState } from 'react';
import { ArrowRight, QrCode } from 'lucide-react';
import { QRCodeModal } from '../components/QRCodeModal';
import { getActiveLanguage } from '../languages';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
  const [showQr, setShowQr] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const [emblemError, setEmblemError] = useState(false);
  const lang = getActiveLanguage();

  return (
    <div className="edo-screen justify-between overflow-y-auto relative">
      {/* Top Hero Image / Neutral Cultural Banner */}
      <div className="relative w-full flex-[1.18] min-h-[265px] max-h-[470px] shrink-0 overflow-hidden bg-[#EFE8D8]">
        {/* Small QR Icon at top right (Welcome page only) */}
        <button
          type="button"
          onClick={() => setShowQr(true)}
          title={`Open ${lang.name} Library QR Code`}
          aria-label={`Open ${lang.name} Library QR Code`}
          className="absolute top-3.5 right-3.5 z-20 w-10 h-10 rounded-xl bg-white/90 hover:bg-white active:scale-95 border border-[#D5CCB8] shadow-xs flex items-center justify-center text-[#2D3A31] transition"
        >
          <QrCode className="w-5 h-5 stroke-[2.1]" />
        </button>

        {heroError || !lang.welcomeHeroAsset ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#EAE2D2] via-[#E2D8C3] to-[#FAF7F0] p-6 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-white/75 border border-[#D5CCB8] flex items-center justify-center shadow-xs mb-3 text-[#157A4C] font-serif font-bold text-2xl">
              {lang.name.charAt(0)}
            </div>
            <span className="font-serif text-[22px] font-bold text-[#3B463E] tracking-tight">
              {lang.name} Language Studio
            </span>
            <span className="text-[13px] text-[#556358] mt-1 font-medium max-w-[260px] leading-snug">
              Preserving cultural heritage and indigenous language literacy
            </span>
          </div>
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}${lang.welcomeHeroAsset}`}
            alt={`${lang.name} Cultural Heritage`}
            onError={() => setHeroError(true)}
            className="w-full h-full object-cover object-top"
          />
        )}
        {/* Smooth gradient fade into warm cream background */}
        <div
          className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(250, 247, 240, 0) 0%, rgba(250, 247, 240, 0.88) 68%, #FAF7F0 100%)'
          }}
        />
      </div>

      {/* Lower Content Section — Aligned to Shared Mobile Design System (px-5) */}
      <div className="w-full flex-1 px-5 pt-1 pb-5 flex flex-col items-center justify-between text-center z-10">
        <div className="flex flex-col items-center my-auto py-1">
          <span className="font-serif text-[32px] sm:text-[36px] font-bold leading-tight text-[#157A4C] tracking-tight">
            {lang.name}
          </span>
          <h1 className="font-serif text-[36px] sm:text-[40px] font-bold leading-[1.08] text-[#4A2508] tracking-tight mt-1">
            Community Teachers
          </h1>

          <p className="mt-2 text-[15px] sm:text-[16px] leading-[1.45] text-[#333F36] font-medium max-w-[300px]">
            Teach a language.
            <br />
            Preserve a culture.
            <br />
            Build a smarter tomorrow.
          </p>

        </div>

        {/* Single Main Action Button */}
        <div className="w-full flex flex-col items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onGetStarted}
            className={`w-full min-h-[56px] py-3.5 px-6 rounded-2xl ${
              lang.id === 'urhobo'
                ? 'bg-[#0B6638] hover:bg-[#08522D]'
                : 'bg-[#7A3E12] hover:bg-[#68330D]'
            } active:scale-[0.99] text-white font-bold text-[18px] shadow-md flex items-center justify-center gap-2.5 transition-all`}
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5 stroke-[2.6]" />
          </button>

          {/* Cultural Footer Emblem */}
          <div className="flex items-center justify-center gap-2 text-[#465249] text-[13px] font-semibold">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-[#D5CCB8] bg-[#F4EFE6] flex items-center justify-center shrink-0 shadow-2xs">
              {emblemError || !lang.emblemAsset ? (
                <span className="text-[12px] font-bold text-[#157A4C] font-serif">
                  {lang.name.charAt(0)}
                </span>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}${lang.emblemAsset}`}
                  alt=""
                  onError={() => setEmblemError(true)}
                  className="w-full h-full object-cover scale-110"
                />
              )}
            </div>
            <span>{lang.greeting}</span>
          </div>
        </div>
      </div>

      {/* Community Library QR Code Modal */}
      <QRCodeModal
        isOpen={showQr}
        onClose={() => setShowQr(false)}
        type="library"
        targetUrl={lang.libraryUrl}
      />
    </div>
  );
};
