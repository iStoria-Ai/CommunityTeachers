import { LanguageConfig, LanguageId } from './types';
import { edoConfig } from './edo';
import { urhoboConfig } from './urhobo';

export * from './types';
export { edoConfig } from './edo';
export { urhoboConfig } from './urhobo';

const LANGUAGES: Record<LanguageId, LanguageConfig> = {
  edo: edoConfig,
  urhobo: urhoboConfig
};

/**
 * Resolves active community language.
 *
 * 1. Build-time / runtime environment: VITE_COMMUNITY_LANGUAGE=urhobo | edo
 * 2. Hostname detection: urhobo.communityteachers.info vs edo.communityteachers.info
 * 3. Default: Edo (preserves existing Edo setup 100%)
 */
export function resolveLanguage(): LanguageConfig {
  try {
    const envLang = (import.meta as any)?.env?.VITE_COMMUNITY_LANGUAGE?.toLowerCase();
    if (envLang && LANGUAGES[envLang as LanguageId]) {
      return LANGUAGES[envLang as LanguageId];
    }
  } catch (_) {}

  if (typeof window !== 'undefined') {
    if (window.location?.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const queryLang = (params.get('lang') || params.get('language'))?.toLowerCase();
        if (queryLang && LANGUAGES[queryLang as LanguageId]) {
          return LANGUAGES[queryLang as LanguageId];
        }
      } catch (_) {}
    }
    if (window.location?.port) {
      if (window.location.port === '5174') {
        return LANGUAGES.urhobo;
      }
      if (window.location.port === '5173') {
        return LANGUAGES.edo;
      }
    }
    if (window.location?.hostname) {
      const host = window.location.hostname.toLowerCase();
      if (host.startsWith('urhobo') || host.includes('urhobo')) {
        return LANGUAGES.urhobo;
      }
      if (host.startsWith('edo') || host.includes('edo')) {
        return LANGUAGES.edo;
      }
    }
  }

  return LANGUAGES.edo;
}

let activeLanguage = resolveLanguage();

export function getActiveLanguage(): LanguageConfig {
  return activeLanguage;
}

export function setActiveLanguage(id: LanguageId): void {
  if (LANGUAGES[id]) {
    activeLanguage = LANGUAGES[id];
  }
}

export function getLanguageConfig(id: LanguageId): LanguageConfig {
  return LANGUAGES[id] || LANGUAGES.edo;
}

