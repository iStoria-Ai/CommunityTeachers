import React, { useState, useEffect } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import {
  getVocabularyImageUrl,
  getImageStatus,
  retryImageDownload,
  enqueueImageDiscovery,
  subscribeImageUpdates,
  isImageServiceReadOnly,
  ImageStatus
} from '../services/imageService';
import { normalizeEnglish } from '../services/vocabularyService';

interface WordIllustrationProps {
  id?: string;
  english?: string;
  illustrationKey?: string;
  imageUrl?: string;
  category?: string;
  icon?: string;
  emoji?: string;
  size?: 'sm' | 'md' | 'lg' | 'card';
  className?: string;
  allowOnlineDiscovery?: boolean;
  skipLocalCache?: boolean;
  /** Read-only display (Children's Library): no reload button, no discovery, no saves. */
  readOnly?: boolean;
  onRetry?: () => void;
}

export const WordIllustration: React.FC<WordIllustrationProps> = ({
  id,
  english,
  illustrationKey,
  imageUrl: initialImageUrl,
  category,
  size = 'lg',
  className = '',
  allowOnlineDiscovery = false,
  skipLocalCache = false,
  readOnly = false,
  onRetry
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() =>
    getVocabularyImageUrl({ id, english, illustrationKey, imageUrl: initialImageUrl, skipLocalCache })
  );
  const [status, setStatus] = useState<ImageStatus>(() =>
    getImageStatus({ id, english, illustrationKey, imageUrl: initialImageUrl, skipLocalCache })
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const canRepair = !readOnly && !isImageServiceReadOnly();

  // Sync when props change
  useEffect(() => {
    setIsLoaded(false);
    setLoadError(false);
    const standardUrl = getVocabularyImageUrl({ id, english, illustrationKey, imageUrl: initialImageUrl, skipLocalCache });
    const currStatus = getImageStatus({ id, english, illustrationKey, imageUrl: initialImageUrl, skipLocalCache });
    setResolvedUrl(standardUrl);
    setStatus(currStatus);

    // Missing or placeholder-only picture: queue quiet background discovery (Studio only)
    if (canRepair && allowOnlineDiscovery && !initialImageUrl && english && english.trim().toLowerCase() !== 'yam' && currStatus !== 'ready') {
      enqueueImageDiscovery(english, category, id);
    }
  }, [id, english, illustrationKey, initialImageUrl, category, allowOnlineDiscovery, skipLocalCache, canRepair]);

  // Subscribe to background image updates so this specific card updates automatically without reloading
  useEffect(() => {
    if (!english) return;
    const norm = normalizeEnglish(english);
    return subscribeImageUpdates((updatedNorm, url, newStatus) => {
      if (norm === updatedNorm) {
        if (url) {
          setLoadError(false);
          setIsLoaded(false);
          setResolvedUrl(url);
          setStatus('ready');
        } else if (newStatus) {
          setStatus(newStatus);
        }
      }
    });
  }, [english]);

  const sizeClasses = {
    sm: 'w-10 h-10 rounded-xl',
    card: 'w-full h-full rounded-xl',
    md: 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl',
    lg: 'w-32 h-32 sm:w-36 sm:h-36 rounded-3xl'
  }[size];

  const handleImageError = () => {
    // Only this card is affected; a failed load never deletes or replaces any stored image.
    setLoadError(true);
    setIsLoaded(true);
    setStatus(prev => (prev === 'downloading' ? prev : 'failed'));
  };

  const handleRetryClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!english || !canRepair) return;
    setStatus('downloading');
    if (onRetry) {
      onRetry();
    }
    const url = await retryImageDownload(english, category, id);
    if (url) {
      setLoadError(false);
      setIsLoaded(false);
      setResolvedUrl(url);
      setStatus('ready');
    } else {
      setStatus('failed');
    }
  };

  const altText = english ? `Picture representing ${english}` : 'Vocabulary illustration';
  const showImage = Boolean(resolvedUrl) && !loadError;
  const showStatusIcon = canRepair && status !== 'ready';

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 select-none bg-[#F4EFE6] border border-[#E2D8C6] shadow-xs ${sizeClasses} ${className}`}
    >
      {showImage && (
        <img
          src={resolvedUrl}
          alt={altText}
          loading={size === 'sm' ? 'lazy' : 'eager'}
          onError={handleImageError}
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {!showImage && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
          <span className="text-[11px] font-semibold text-center text-[#68766E] leading-tight break-words max-w-full">
            {english || 'No picture'}
          </span>
        </div>
      )}

      {showImage && !isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#F4EFE6] to-[#EBE4D5] animate-pulse" />
      )}

      {/* Image status (independent of the audio green dot): downloading -> spinner, missing / failed -> grey reload */}
      {showStatusIcon && (
        <div className="absolute bottom-1 right-1">
          {status === 'downloading' ? (
            <div
              title="Downloading picture…"
              className="w-5 h-5 rounded-full bg-white/90 shadow-2xs flex items-center justify-center"
            >
              <Loader2 className="w-3.5 h-3.5 text-[#68766E] animate-spin" />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRetryClick}
              title="Reload picture"
              aria-label="Reload picture"
              className="w-5 h-5 rounded-full bg-white/90 hover:bg-white shadow-2xs flex items-center justify-center text-[#68766E] hover:text-[#18241B] transition active:scale-90"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
