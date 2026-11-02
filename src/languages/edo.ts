import { LanguageConfig } from './types';

export const edoConfig: LanguageConfig = {
  id: 'edo',
  name: 'Edo',
  code: 'bin',
  subdomain: 'edo',
  domainUrl: 'https://edo.communityteachers.info/',
  libraryUrl: 'https://edo.communityteachers.info/library/',

  // Storage Isolation: 100% backward compatible with existing user data
  storagePrefix: 'edo',

  // Live Edo Gateway & Google Drive Folder
  gatewayUrl:
    'https://script.google.com/macros/s/AKfycbwcZHwplY338zxErFhNSKQBg6gDtPi1YLRa6sdrmKCD5DF0zVBIvVasGrT86czJy43w/exec',
  googleDriveFolderId: '1eOYgm0ZyyPiw92NqsWFTYsv_9fZ8Jf2D',
  gatewayConfigured: true,

  // Edo Alphabet & Special Characters
  specialCharacters: ['ẹ', 'ọ', 'vb', 'gh', 'kh', 'mw', 'rh'],

  // Cultural Identity & Visual Branding
  emblemAsset: 'assets/edo-bronze-icon.jpg',
  welcomeHeroAsset: 'assets/edo-welcome-hero.jpg',
  greeting: 'Edo for Everyone',
  motto: 'Teach a language. Preserve a culture. Build a smarter tomorrow.'
};

