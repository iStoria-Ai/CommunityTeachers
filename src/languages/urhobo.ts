import { LanguageConfig } from './types';

export const urhoboConfig: LanguageConfig = {
  id: 'urhobo',
  name: 'Urhobo',
  code: 'urh',
  subdomain: 'urhobo',
  domainUrl: 'https://urhobo.communityteachers.info/',
  libraryUrl: 'https://urhobo.communityteachers.info/library/',

  // Strictly isolated storage namespace: never touches edo_* keys
  storagePrefix: 'urhobo',

  // Dedicated Urhobo Gateway & Google Drive Folder
  gatewayUrl:
    'https://script.google.com/macros/s/AKfycbyMXnoLituqQVr4DNmIybzn_D3_8-YD0idQ7oHbNa34MW2fgZaYN4pqxAqlQWMf5gLB-w/exec',
  googleDriveFolderId: '1fLh4pArYSyOf6I8yF54AlT3BsMvPP1fS',
  gatewayConfigured: true,

  // Urhobo Orthography & Digraphs
  specialCharacters: ['ẹ', 'ọ', 'rh', 'vw', 'dj', 'gh', 'ch', 'gb', 'kp'],

  // Cultural Identity & Branding
  emblemAsset: 'assets/urhobo-emblem.jpg',
  welcomeHeroAsset: 'assets/urhobo-welcome-hero.jpg',
  greeting: 'Urhobo for Everyone',
  motto: 'Teach a language. Preserve a culture. Build a smarter tomorrow.'
};

