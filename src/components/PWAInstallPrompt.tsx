import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { getActiveLanguage } from '../languages';
import {
  initPWAService,
  subscribePWAState,
  shouldShowInstallInvitation,
  detectMobilePlatform,
  isSafariOnIOS,
  hasDeferredInstallPrompt,
  triggerNativeInstallPrompt,
  dismissInstallPrompt
} from '../services/pwaService';

export const PWAInstallPrompt: React.FC = () => {
  const lang = getActiveLanguage();
  const [visible, setVisible] = useState<boolean>(() => shouldShowInstallInvitation());
  const [platform, setPlatform] = useState(() => detectMobilePlatform());
  const [hasNativePrompt, setHasNativePrompt] = useState<boolean>(() => hasDeferredInstallPrompt());
  const [showAndroidManual, setShowAndroidManual] = useState<boolean>(false);
  const [iconError, setIconError] = useState<boolean>(false);

  useEffect(() => {
    initPWAService();
    const syncState = () => {
      setVisible(shouldShowInstallInvitation());
      setPlatform(detectMobilePlatform());
      setHasNativePrompt(hasDeferredInstallPrompt());
    };
    syncState();

    const unsubscribe = subscribePWAState(syncState);
    window.addEventListener('resize', syncState);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', syncState);
    };
  }, []);

  if (!visible) {
    return null;
  }

  const appTitle = `${lang.name} Community Teachers`;
  const baseUrl = (import.meta as any)?.env?.BASE_URL || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const iconSrc = `${cleanBase}assets/${lang.id}-icon-192.png`;
  const isUrhobo = lang.id === 'urhobo';
  const primaryBtnClass = isUrhobo
    ? 'bg-[#0B6638] hover:bg-[#08522D]'
    : 'bg-[#157A4C] hover:bg-[#11643E]';

  const handleDismiss = () => {
    dismissInstallPrompt(lang.storagePrefix);
    setVisible(false);
  };

  const handleAndroidInstall = async () => {
    if (hasDeferredInstallPrompt()) {
      const outcome = await triggerNativeInstallPrompt(lang.storagePrefix);
      if (outcome === 'accepted' || outcome === 'dismissed') {
        setVisible(false);
        return;
      }
    }
    setShowAndroidManual(true);
  };

  const isIOS = platform === 'ios';
  const inSafari = isSafariOnIOS();

  return (
    <div
      role="dialog"
      aria-label={`Install ${appTitle}`}
      className="fixed inset-x-0 bottom-0 z-40 px-3.5 pt-2 pointer-events-none"
      style={{
        paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom, 0.875rem))'
      }}
    >
      <div className="pointer-events-auto w-full max-w-[380px] mx-auto rounded-2xl bg-[#FAF7F0] border-2 border-[#D5CCB8] shadow-2xl p-3.5 text-[#1C241E]">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#D5CCB8] bg-white flex items-center justify-center shrink-0 shadow-2xs">
              {iconError ? (
                <span className="font-serif font-bold text-lg text-[#157A4C]">
                  {lang.name.charAt(0)}
                </span>
              ) : (
                <img
                  src={iconSrc}
                  alt={appTitle}
                  onError={() => setIconError(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 text-left">
              <h3 className="font-bold text-[14.5px] leading-snug text-[#18241B] truncate">
                Install {appTitle}
              </h3>
              <p className="text-[12px] text-[#465249] font-medium leading-tight mt-0.5">
                {isIOS
                  ? 'Add to your iPhone Home Screen in Safari'
                  : 'Open full-screen from your Home Screen'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install invitation for 14 days"
            title="Dismiss for 14 days"
            className="w-7 h-7 rounded-lg bg-[#EFE8D8] hover:bg-[#E4DCC8] text-[#333F36] flex items-center justify-center shrink-0 transition"
          >
            <X className="w-4 h-4 stroke-[2.3]" />
          </button>
        </div>

        {/* Platform-Specific Instructions / Action */}
        {isIOS ? (
          <div className="mt-2.5 rounded-xl bg-white border border-[#E2D8C6] p-2.5 text-left space-y-1.5 text-[12px] text-[#263129]">
            {!inSafari && (
              <div className="flex items-center gap-2 text-[#7A3E12] font-semibold">
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>First open this website in Safari</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Share className="w-3.5 h-3.5 text-[#157A4C] shrink-0" />
              <span>
                1. In <strong>Safari</strong>, tap the <strong>Share</strong> button
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PlusSquare className="w-3.5 h-3.5 text-[#157A4C] shrink-0" />
              <span>
                2. Tap <strong>Add to Home Screen</strong>
              </span>
            </div>
            <div className="pl-5 text-[11.5px] text-[#4B584E]">
              3. Keep <strong>Open as Web App</strong> enabled (where available) and tap{' '}
              <strong>Add</strong>.
            </div>
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-[12px] font-semibold text-[#556358] hover:text-[#1C241E] px-2 py-0.5"
              >
                Not now
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-col gap-2">
            {(showAndroidManual || !hasNativePrompt) && (
              <div className="rounded-xl bg-white border border-[#E2D8C6] px-2.5 py-2 text-left text-[12px] text-[#263129] leading-snug">
                Tap your browser menu <strong>(⋮)</strong> and choose{' '}
                <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAndroidInstall}
                className={`flex-1 min-h-[40px] py-2 px-3.5 rounded-xl ${primaryBtnClass} active:scale-[0.99] text-white font-bold text-[13.5px] shadow-xs flex items-center justify-center gap-2 transition`}
              >
                <Download className="w-4 h-4 stroke-[2.3]" />
                <span>Install App</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="min-h-[40px] py-2 px-3 rounded-xl bg-white hover:bg-[#F3EDE0] border border-[#D5CCB8] text-[#333F36] font-semibold text-[12.5px] transition"
              >
                Not now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

