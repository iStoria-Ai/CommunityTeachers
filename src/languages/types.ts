export type LanguageId = 'edo' | 'urhobo';

export interface LanguageConfig {
  id: LanguageId;
  name: string;
  code: string;
  subdomain: string;
  domainUrl: string;
  libraryUrl: string;

  // Storage Isolation
  storagePrefix: string;

  // Cloud Gateway & Google Drive Isolation
  gatewayUrl: string;
  googleDriveFolderId?: string;
  gatewayConfigured: boolean;

  // Orthography & Alphabet
  specialCharacters: readonly string[];

  // Cultural Identity & Branding
  emblemAsset: string;
  welcomeHeroAsset: string;
  greeting: string;
  motto: string;
}

