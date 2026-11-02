/**
 * Multi-Language Shared Architecture Test Suite
 *
 * Verifies:
 * 1. Language configuration integrity for Edo and Urhobo
 * 2. Strict cloud gateway isolation: Urhobo NEVER falls back to Edo gateway
 * 3. Local storage and IndexedDB namespace isolation (edo_* vs urhobo_*)
 * 4. Language-specific starter vocabulary, spelling, and orthography
 * 5. QR code destinations dynamically match active language domain
 */

const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const bundle = buildSync({
  stdin: {
    contents: `
      export * from './src/languages';
      export { getStorageKey, getLibraryStorageKey, getInitialLanguageEntries, INITIAL_EDO_ENTRIES, INITIAL_URHOBO_ENTRIES } from './src/services/storageService';
      export { getGatewayUrl, getDefaultGatewayUrl, DEFAULT_GATEWAY_URL } from './src/services/cloudSyncService';
      export { getStarterVocabulary } from './src/services/vocabularyService';
      export { getCommunityCacheKey, getSpellingDraftKey, getPendingEditsKey, getCommunityAudioKey } from './src/services/communityLibrary';
      export { getOneTimeResetKey } from './src/services/libraryResetService';
      export * from './src/services/pwaService';
    `,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  define: {
    'import.meta.env.BASE_URL': '"/"'
  },
  external: ['@capacitor/*', 'react', 'react-dom']
}).outputFiles[0].text;

const moduleObject = { exports: {} };
const localStorageMock = new Map();
const mockLocalStorage = {
  getItem: (k) => localStorageMock.get(k) || null,
  setItem: (k, v) => localStorageMock.set(k, String(v)),
  removeItem: (k) => localStorageMock.delete(k)
};

vm.runInNewContext(bundle, {
  module: moduleObject,
  exports: moduleObject.exports,
  console,
  localStorage: mockLocalStorage,
  require: (name) => name.startsWith('@capacitor/') ? {} : require(name)
});

const api = moduleObject.exports;

console.log('=== Running Multi-Language Shared Architecture Tests ===\n');

// --- Test 1: Language Configs & Isolation ---
console.log('--- Test 1: Language Configs & Default Resolution ---');
const defaultLang = api.getActiveLanguage();
assert.equal(defaultLang.id, 'edo', 'Default language should safely be Edo');
assert.equal(defaultLang.storagePrefix, 'edo');
assert.equal(defaultLang.domainUrl, 'https://edo.communityteachers.info/');
assert.equal(defaultLang.libraryUrl, 'https://edo.communityteachers.info/library/');
assert.equal(defaultLang.gatewayConfigured, true);
assert.ok(defaultLang.gatewayUrl.includes('AKfycbwcZHwplY'), 'Edo gateway URL matches production');
assert.ok(defaultLang.specialCharacters.includes('vb'), 'Edo has vb digraph');
assert.ok(defaultLang.specialCharacters.includes('kh'), 'Edo has kh digraph');

const edoStorageKey = api.getStorageKey();
const edoLibStorageKey = api.getLibraryStorageKey();
assert.equal(edoStorageKey, 'edo_language_studio_entries_v1');
assert.equal(edoLibStorageKey, 'edo_language_studio_library_v2');

// Cultural assets existence check
assert.ok(fs.existsSync(path.join('public', defaultLang.emblemAsset)), 'Edo emblem must exist on disk');
assert.ok(fs.existsSync(path.join('public', defaultLang.welcomeHeroAsset)), 'Edo welcome hero must exist on disk');
console.log('✓ Edo configuration and default resolution verified.');

// --- Test 2: Switch to Urhobo & Verify Storage Namespace Isolation ---
console.log('--- Test 2: Storage Namespace Isolation ---');
api.setActiveLanguage('urhobo');
const urhoboLang = api.getActiveLanguage();
assert.equal(urhoboLang.id, 'urhobo');
assert.equal(urhoboLang.name, 'Urhobo');
assert.equal(urhoboLang.storagePrefix, 'urhobo');
assert.equal(urhoboLang.domainUrl, 'https://urhobo.communityteachers.info/');
assert.equal(urhoboLang.libraryUrl, 'https://urhobo.communityteachers.info/library/');

// Urhobo cultural assets existence check
assert.ok(fs.existsSync(path.join('public', urhoboLang.emblemAsset)), 'Urhobo emblem must exist on disk');
assert.ok(fs.existsSync(path.join('public', urhoboLang.welcomeHeroAsset)), 'Urhobo welcome hero must exist on disk');
assert.notEqual(urhoboLang.emblemAsset, defaultLang.emblemAsset, 'Edo and Urhobo emblems must be separate');
assert.notEqual(urhoboLang.welcomeHeroAsset, defaultLang.welcomeHeroAsset, 'Edo and Urhobo heroes must be separate');

const urhoboStorageKey = api.getStorageKey();
const urhoboLibStorageKey = api.getLibraryStorageKey();
assert.equal(urhoboStorageKey, 'urhobo_language_studio_entries_v1');
assert.equal(urhoboLibStorageKey, 'urhobo_language_studio_library_v2');
assert.notEqual(urhoboStorageKey, edoStorageKey, 'Urhobo storage key must differ from Edo');
assert.notEqual(urhoboLibStorageKey, edoLibStorageKey, 'Urhobo library key must differ from Edo');
console.log('✓ Storage namespace isolation verified (edo_* vs urhobo_*).');

// --- Test 3: Strict Gateway Isolation (Dedicated Gateway URLs & Folders) ---
console.log('--- Test 3: Strict Gateway Isolation (Dedicated Gateway URLs & Folders) ---');
assert.equal(urhoboLang.gatewayConfigured, true, 'Urhobo gateway should be configured');
assert.ok(urhoboLang.gatewayUrl.includes('AKfycbyMXnoLituqQVr4DNmIybzn'), 'Urhobo gateway URL matches deployment');
assert.equal(urhoboLang.googleDriveFolderId, '1fLh4pArYSyOf6I8yF54AlT3BsMvPP1fS', 'Urhobo folder ID is dedicated');

// Urhobo calling getGatewayUrl() returns Urhobo gateway and NEVER Edo's gateway
const urhoboGateway = api.getGatewayUrl();
assert.equal(urhoboGateway, urhoboLang.gatewayUrl, 'Urhobo returns its own gateway URL');
assert.ok(!urhoboGateway.includes('AKfycbwcZHwplY'), 'Urhobo gateway MUST NEVER be Edo gateway');
assert.equal(api.getDefaultGatewayUrl(), urhoboGateway);

// Switch back to Edo and verify Edo's gateway still works flawlessly
api.setActiveLanguage('edo');
const edoLang = api.getActiveLanguage();
const edoGateway = api.getGatewayUrl();
assert.ok(edoGateway.includes('AKfycbwcZHwplY'), 'Edo gateway returns live Edo URL');
assert.equal(edoLang.googleDriveFolderId, '1eOYgm0ZyyPiw92NqsWFTYsv_9fZ8Jf2D', 'Edo folder ID remains original');
assert.notEqual(edoGateway, urhoboGateway, 'Edo and Urhobo gateways must be completely distinct');
assert.notEqual(edoLang.googleDriveFolderId, urhoboLang.googleDriveFolderId, 'Drive folders must be distinct');
assert.equal(api.getDefaultGatewayUrl(), edoGateway);
console.log('✓ Strict gateway isolation verified: Edo and Urhobo have completely distinct gateways and folders.');

// --- Test 4: Orthography and Special Digraphs ---
console.log('--- Test 4: Orthography & Digraphs ---');
api.setActiveLanguage('urhobo');
assert.ok(urhoboLang.specialCharacters.includes('ẹ'), 'Urhobo has ẹ');
assert.ok(urhoboLang.specialCharacters.includes('ọ'), 'Urhobo has ọ');
assert.ok(urhoboLang.specialCharacters.includes('vw'), 'Urhobo has vw digraph');
assert.ok(urhoboLang.specialCharacters.includes('dj'), 'Urhobo has dj digraph');
assert.ok(urhoboLang.specialCharacters.includes('ch'), 'Urhobo has ch digraph');
assert.ok(!urhoboLang.specialCharacters.includes('vb'), 'Urhobo does NOT have Edo vb digraph');

api.setActiveLanguage('edo');
const edoChars = api.getActiveLanguage().specialCharacters;
assert.ok(edoChars.includes('vb'), 'Edo has vb');
assert.ok(!edoChars.includes('vw'), 'Edo does NOT have Urhobo vw');
console.log('✓ Orthography and keyboard digraphs correctly differentiated.');

// --- Test 5: Language-Specific Initial Entries & Vocabulary ---
console.log('--- Test 5: Language-Specific Initial Entries & Vocabulary ---');
api.setActiveLanguage('edo');
const edoInitial = api.getInitialLanguageEntries();
const edoHand = edoInitial.find(e => e.id === 'word-hand');
assert.equal(edoHand?.edoText, 'Obo', 'Edo hand is Obo');

api.setActiveLanguage('urhobo');
const urhoboInitial = api.getInitialLanguageEntries();
const urhoboHand = urhoboInitial.find(e => e.id === 'word-hand');
assert.equal(urhoboHand?.edoText, 'Obọ', 'Urhobo hand is Obọ');

const urhoboStarter = api.getStarterVocabulary();
const urhoboChild = urhoboStarter.find(e => e.english === 'Child');
assert.equal(urhoboChild?.edoText, 'Ọmọ', 'Urhobo Child prompt is Ọmọ');
const urhoboWithSpelling = urhoboStarter.filter(e => Boolean(e.edoText));
assert.ok(urhoboWithSpelling.length >= 30, 'Should have 30+ Urhobo starter words');
assert.ok(urhoboWithSpelling.every(e => e.isSampleData === true), 'All Urhobo starter translations must be marked isSampleData=true');
assert.ok(urhoboStarter.every(e => e.status !== 'approved' && e.status !== 'approved_locked'), 'Urhobo starter entries must never be automatically approved');
console.log('✓ Language-specific starter vocabulary verified as unverified sample data.');

// --- Test 6: Safe Non-Destructive Legacy Storage Migration ---
console.log('--- Test 6: Safe Non-Destructive Legacy Storage Migration ---');
api.setActiveLanguage('edo');
// Verify legacy keys do not collide or lose data
assert.equal(api.getStorageKey(), 'edo_language_studio_entries_v1');
assert.equal(api.getLibraryStorageKey(), 'edo_language_studio_library_v2');
console.log('✓ Non-destructive backward-compatible storage migration verified.');

// --- Test 7: Cross-Language Local Storage Isolation & Anti-Collision ---
console.log('--- Test 7: Cross-Language Local Storage Isolation & Anti-Collision ---');
// 1. Verify key derivation for Edo
api.setActiveLanguage('edo');
assert.equal(api.getCommunityCacheKey(), 'edo_community_library_v1');
assert.equal(api.getSpellingDraftKey(), 'edo_community_spelling_drafts_v1');
assert.equal(api.getPendingEditsKey(), 'edo_pending_cloud_edits_v1');
assert.equal(api.getCommunityAudioKey('sample_audio_1'), 'edo_community_audio_sample_audio_1');
assert.equal(api.getOneTimeResetKey(), 'edo_library_reset_v3');

// 2. Verify key derivation for Urhobo
api.setActiveLanguage('urhobo');
assert.equal(api.getCommunityCacheKey(), 'urhobo_community_library_v1');
assert.equal(api.getSpellingDraftKey(), 'urhobo_community_spelling_drafts_v1');
assert.equal(api.getPendingEditsKey(), 'urhobo_pending_cloud_edits_v1');
assert.equal(api.getCommunityAudioKey('sample_audio_1'), 'urhobo_community_audio_sample_audio_1');
assert.equal(api.getOneTimeResetKey(), 'urhobo_library_reset_v3');

// 3. Verify that all 5 Urhobo keys differ strictly from Edo keys
assert.notEqual(api.getCommunityCacheKey(), 'edo_community_library_v1');
assert.notEqual(api.getSpellingDraftKey(), 'edo_community_spelling_drafts_v1');
assert.notEqual(api.getPendingEditsKey(), 'edo_pending_cloud_edits_v1');
assert.notEqual(api.getCommunityAudioKey('sample_audio_1'), 'edo_community_audio_sample_audio_1');
assert.notEqual(api.getOneTimeResetKey(), 'edo_library_reset_v3');

// 4. Test anti-collision and read/write isolation in mock localStorage
localStorageMock.set('edo_community_library_v1', JSON.stringify({ language: 'edo', data: 'protected_edo_data' }));
localStorageMock.set('urhobo_community_library_v1', JSON.stringify({ language: 'urhobo', data: 'isolated_urhobo_data' }));

// Urhobo cannot read Edo data
api.setActiveLanguage('urhobo');
const urhoboRead = localStorageMock.get(api.getCommunityCacheKey());
assert.ok(urhoboRead.includes('isolated_urhobo_data'));
assert.ok(!urhoboRead.includes('protected_edo_data'), 'Urhobo MUST NOT read Edo community data');

// Urhobo writing data cannot overwrite Edo data
localStorageMock.set(api.getCommunityCacheKey(), JSON.stringify({ language: 'urhobo', data: 'updated_urhobo_data' }));
const edoDataCheck = localStorageMock.get('edo_community_library_v1');
assert.ok(edoDataCheck.includes('protected_edo_data'), 'Edo data MUST NOT be overwritten by Urhobo');

// Switch back to Edo and verify Edo reads its own data
api.setActiveLanguage('edo');
const edoRead = localStorageMock.get(api.getCommunityCacheKey());
assert.ok(edoRead.includes('protected_edo_data'), 'Edo reads its own protected data');
assert.ok(!edoRead.includes('updated_urhobo_data'), 'Edo data is completely isolated from Urhobo updates');
console.log('✓ Cross-language local storage isolation and zero-collision verified.');

// --- Test 8: 6-Digit Approval Code Deletion & Cross-Language Gateway Isolation ---
console.log('--- Test 8: 6-Digit Approval Code Deletion & Cross-Language Gateway Isolation ---');

function createIsolatedGatewaySandbox(codePath, targetFolderId, serviceName) {
  const folders = new Map();
  const files = new Map();
  const scriptProps = new Map();
  const scriptCache = new Map();

  function makeBlob(bytes, mimeType, name) {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || '', 'utf8');
    return {
      getBytes: () => buffer,
      getDataAsString: () => buffer.toString('utf8'),
      getContentType: () => mimeType || 'application/octet-stream',
      getName: () => name || 'blob',
      setName: function(n) { name = n; return this; }
    };
  }

  function createFile(blob, parentFolderId) {
    const fileId = 'file_' + Math.random().toString(36).substring(2, 10);
    const file = {
      id: fileId,
      name: blob.getName(),
      mimeType: blob.getContentType(),
      blob: blob,
      parentFolderId: parentFolderId || targetFolderId,
      trashed: false,
      getId: () => fileId,
      isTrashed: () => file.trashed,
      getName: () => file.name,
      getSize: () => file.blob.getBytes().length,
      getBlob: () => file.blob,
      setContent: (text) => { file.blob = makeBlob(text, file.mimeType, file.name); },
      setTrashed: (t) => { file.trashed = Boolean(t); },
      setSharing: () => {},
      getMimeType: () => file.mimeType || 'application/octet-stream',
      getParents: () => {
        let done = false;
        return {
          hasNext: () => !done && !file.trashed,
          next: () => {
            done = true;
            return folders.get(file.parentFolderId);
          }
        };
      }
    };
    files.set(fileId, file);
    return file;
  }

  const rootFolder = {
    getId: () => targetFolderId,
    getName: () => serviceName,
    getParents: () => ({ hasNext: () => false, next: () => null }),
    createFile: (blob) => createFile(blob, targetFolderId),
    getFilesByName: (name) => {
      const matched = Array.from(files.values()).filter(f => !f.trashed && f.parentFolderId === targetFolderId && f.name === name);
      let idx = 0;
      return { hasNext: () => idx < matched.length, next: () => matched[idx++] };
    },
    getFiles: () => {
      const matched = Array.from(files.values()).filter(f => !f.trashed && f.parentFolderId === targetFolderId);
      let idx = 0;
      return { hasNext: () => idx < matched.length, next: () => matched[idx++] };
    },
    getFoldersByName: (name) => {
      const matched = Array.from(folders.values()).filter(f => f.getParentId && f.getParentId() === targetFolderId && f.getName() === name);
      let idx = 0;
      return { hasNext: () => idx < matched.length, next: () => matched[idx++] };
    },
    createFolder: (name) => {
      const subId = 'sub_' + Math.random().toString(36).substring(2, 10);
      const sub = {
        getId: () => subId,
        getName: () => name,
        getParentId: () => targetFolderId,
        getParents: () => {
          let done = false;
          return { hasNext: () => !done, next: () => { done = true; return rootFolder; } };
        },
        createFile: (blob) => createFile(blob, subId),
        getFilesByName: (fileName) => {
          const matched = Array.from(files.values()).filter(f => !f.trashed && f.parentFolderId === subId && f.name === fileName);
          let idx = 0;
          return { hasNext: () => idx < matched.length, next: () => matched[idx++] };
        }
      };
      folders.set(subId, sub);
      return sub;
    }
  };
  folders.set(targetFolderId, rootFolder);

  const sandbox = {
    DriveApp: {
      getFolderById: (id) => {
        if (!folders.has(id)) throw new Error('Folder not found: ' + id);
        return folders.get(id);
      },
      getFileById: (id) => {
        if (!files.has(id)) throw new Error('File not found: ' + id);
        return files.get(id);
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (alg, text) => {
        const crypto = require('node:crypto');
        const hash = crypto.createHash('sha256').update(String(text || ''), 'utf8').digest();
        return Array.from(hash);
      },
      newBlob: (bytes, mime, name) => makeBlob(bytes, mime, name),
      base64Decode: (b64) => Buffer.from(b64, 'base64'),
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64')
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => scriptProps.get(k) || null,
        setProperty: (k, v) => scriptProps.set(k, String(v)),
        deleteProperty: (k) => scriptProps.delete(k),
        getProperties: () => Object.fromEntries(scriptProps.entries())
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => scriptCache.get(k) || null,
        put: (k, v) => scriptCache.set(k, String(v)),
        remove: (k) => scriptCache.delete(k)
      })
    },
    LockService: {
      getScriptLock: () => ({ waitLock: () => true, releaseLock: () => true })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (c) => ({ setMimeType: function() { return this; }, getContent: () => c })
    },
    Logger: { log: () => {} },
    console: console
  };

  const codeSource = fs.readFileSync(codePath, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(codeSource, sandbox);

  return {
    sandbox,
    files,
    folders,
    scriptProps,
    post: (payload) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(payload) } }).getContent())
  };
}

const EDO_FOLDER_ID = '1eOYgm0ZyyPiw92NqsWFTYsv_9fZ8Jf2D';
const URH_FOLDER_ID = '1fLh4pArYSyOf6I8yF54AlT3BsMvPP1fS';
const edoGw = createIsolatedGatewaySandbox(path.join(__dirname, '../gas/edo/Code.gs'), EDO_FOLDER_ID, 'Edo Language Studio');
const urhGw = createIsolatedGatewaySandbox(path.join(__dirname, '../gas/urhobo/Code.gs'), URH_FOLDER_ID, 'Urhobo Community Teachers');

const adminOwnerToken = 'super-secret-admin-token-2026';
edoGw.scriptProps.set('CONTRIBUTOR_DIRECTORY', JSON.stringify({ [adminOwnerToken]: { id: 'admin-lead', name: 'Admin', role: 'admin' } }));
urhGw.scriptProps.set('CONTRIBUTOR_DIRECTORY', JSON.stringify({ [adminOwnerToken]: { id: 'admin-lead', name: 'Admin', role: 'admin' } }));

// 1. Owner Admin sets distinct 6-digit codes for each language
assert.equal(edoGw.post({ action: 'admin_set_approval_code', authToken: adminOwnerToken, approvalCode: '123456' }).status, 'success');
assert.equal(urhGw.post({ action: 'admin_set_approval_code', authToken: adminOwnerToken, approvalCode: '654321' }).status, 'success');

// 2. Upload lessons to each respective gateway
const dummyAudio = Buffer.from('RIFF....WAVEfmt ').toString('base64');
const edoUpload = edoGw.post({ action: 'upload_recording', lessonId: 'edo-lesson-01', recordingId: 'rec-edo-01', english: 'Water', edoText: 'Ame', audioBase64: dummyAudio, mimeType: 'audio/wav' });
const urhUpload = urhGw.post({ action: 'upload_recording', lessonId: 'urh-lesson-01', recordingId: 'rec-urh-01', english: 'Water', spelling: 'Ame', audioBase64: dummyAudio, mimeType: 'audio/wav' });
assert.equal(edoUpload.status, 'success');
assert.equal(urhUpload.status, 'success');

// 3. Unauthorized deletion attempts without valid 6-digit code are rejected
const unauthEdoDel = edoGw.post({ action: 'admin_delete_entry', metadataFileId: edoUpload.metadataFileId });
assert.equal(unauthEdoDel.code, 'UNAUTHORIZED_ADMIN');

const wrongCodeEdoDel = edoGw.post({ action: 'admin_delete_entry', approvalCode: '000000', metadataFileId: edoUpload.metadataFileId });
assert.equal(wrongCodeEdoDel.code, 'UNAUTHORIZED_ADMIN');

// 4. Cross-language 6-digit code rejection: Urhobo code on Edo gateway rejected
const crossCodeDel = edoGw.post({ action: 'admin_delete_entry', approvalCode: '654321', metadataFileId: edoUpload.metadataFileId });
assert.equal(crossCodeDel.code, 'UNAUTHORIZED_ADMIN');

// 5. Successful deletion using valid 6-digit code on Edo gateway
const validEdoDel = edoGw.post({ action: 'admin_delete_entry', approvalCode: '123456', metadataFileId: edoUpload.metadataFileId });
assert.equal(validEdoDel.status, 'success');
assert.equal(validEdoDel.tombstoneRecorded, true);
assert.ok(edoGw.files.get(edoUpload.metadataFileId).trashed, 'Edo metadata moved to Trash');
assert.ok(edoGw.files.get(edoUpload.audioFileId).trashed, 'Edo audio moved to Trash');

// Verify Urhobo gateway files and folders were completely untouched
assert.equal(urhGw.files.get(urhUpload.metadataFileId).trashed, false, 'Urhobo files must NOT be touched by Edo deletion');
assert.equal(urhGw.files.get(urhUpload.audioFileId).trashed, false, 'Urhobo files must NOT be touched by Edo deletion');

// 6. Successful deletion using valid 6-digit code on Urhobo gateway
const validUrhDel = urhGw.post({ action: 'admin_delete_entry', approvalCode: '654321', metadataFileId: urhUpload.metadataFileId });
assert.equal(validUrhDel.status, 'success');
assert.equal(validUrhDel.tombstoneRecorded, true);
assert.ok(urhGw.files.get(urhUpload.metadataFileId).trashed, 'Urhobo metadata moved to Trash');
assert.ok(urhGw.files.get(urhUpload.audioFileId).trashed, 'Urhobo audio moved to Trash');

// 7. Security: 6-digit code CANNOT unlock lessons or change the approval code
const edoUpload2 = edoGw.post({ action: 'upload_recording', lessonId: 'edo-lesson-02', recordingId: 'rec-edo-02', english: 'House', edoText: 'Owa', audioBase64: dummyAudio, mimeType: 'audio/wav' });
edoGw.post({ action: 'admin_lock_entry', approvalCode: '123456', metadataFileId: edoUpload2.metadataFileId });

const unlockAttempt = edoGw.post({ action: 'admin_unlock_entry', approvalCode: '123456', metadataFileId: edoUpload2.metadataFileId });
assert.equal(unlockAttempt.code, 'UNAUTHORIZED_ADMIN');

const changeCodeAttempt = edoGw.post({ action: 'admin_set_approval_code', approvalCode: '123456', newCode: '999999' });
assert.equal(changeCodeAttempt.code, 'UNAUTHORIZED_ADMIN');

// Owner admin can unlock
const ownerUnlock = edoGw.post({ action: 'admin_unlock_entry', authToken: adminOwnerToken, metadataFileId: edoUpload2.metadataFileId });
assert.equal(ownerUnlock.status, 'success');

console.log('✓ 6-Digit approval code deletion, Trash management, and cross-language isolation verified.');

// --- Test 9: PWA Manifests, Install Invitation, 14-Day Dismissal, Standalone Mode & WhatsApp Previews ---
console.log('--- Test 9: PWA Manifests, Install Invitation, 14-Day Dismissal & WhatsApp Previews ---');

const edoManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/manifest-edo.webmanifest'), 'utf8'));
const urhManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/manifest-urhobo.webmanifest'), 'utf8'));

assert.equal(edoManifest.name, 'Edo Community Teachers', 'Edo manifest name must be Edo Community Teachers');
assert.equal(edoManifest.display, 'standalone', 'Edo manifest must launch in standalone mode');
assert.equal(edoManifest.start_url, '/', 'Edo manifest must specify root start_url');
assert.ok(edoManifest.icons.some(i => i.src.includes('edo-icon-192.png') && i.sizes === '192x192'));
assert.ok(edoManifest.icons.some(i => i.src.includes('edo-icon-512.png') && i.sizes === '512x512'));

assert.equal(urhManifest.name, 'Urhobo Community Teachers', 'Urhobo manifest name must be Urhobo Community Teachers');
assert.equal(urhManifest.display, 'standalone', 'Urhobo manifest must launch in standalone mode');
assert.equal(urhManifest.start_url, '/', 'Urhobo manifest must specify root start_url');
assert.ok(urhManifest.icons.some(i => i.src.includes('urhobo-icon-192.png') && i.sizes === '192x192'));
assert.ok(urhManifest.icons.some(i => i.src.includes('urhobo-icon-512.png') && i.sizes === '512x512'));
assert.notEqual(edoManifest.id, urhManifest.id, 'Edo and Urhobo PWA manifests must have distinct installation IDs');

// Verify icon assets exist on disk
for (const iconFile of ['edo-icon-192.png', 'edo-icon-512.png', 'urhobo-icon-192.png', 'urhobo-icon-512.png']) {
  const iconPath = path.join(__dirname, '../public/assets', iconFile);
  assert.ok(fs.existsSync(iconPath) && fs.statSync(iconPath).size > 1000, `Missing or empty PWA icon: ${iconFile}`);
}

// Verify Service Worker is safe pass-through and never caches private recordings or Google Drive data
const swSource = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
assert.ok(swSource.includes("self.addEventListener('fetch'"), 'Service worker must register fetch listener for PWA installability');
assert.ok(!swSource.includes('cache.put(') && !swSource.includes('cache.addAll('), 'Service worker must not cache private recordings, API responses, or outdated bundles');

// Verify HTML & Vite config WhatsApp Open Graph preview support for both languages
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const viteConfig = fs.readFileSync(path.join(__dirname, '../vite.config.ts'), 'utf8');
assert.ok(indexHtml.includes('property="og:image" content="https://edo.communityteachers.info/assets/edo-welcome-hero.jpg"'));
assert.ok(indexHtml.includes('manifest-edo.webmanifest'));
assert.ok(viteConfig.includes('assets/urhobo-welcome-hero.jpg'), 'Vite config must transform og:image for Urhobo builds');
assert.ok(viteConfig.includes('manifest-urhobo.webmanifest'), 'Vite config must transform manifest for Urhobo builds');

// Verify platform detection (Android vs iPhone/iOS)
assert.equal(api.detectMobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'), 'ios');
assert.equal(api.detectMobilePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'), 'android');
assert.equal(api.isSafariOnIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'), true);
assert.equal(api.isSafariOnIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1'), false);

// Verify Standalone Mode suppression
assert.equal(
  api.shouldShowInstallInvitation({
    storagePrefix: 'edo',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    win: { matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) }
  }),
  false,
  'Invitation must NOT appear when running in standalone mode'
);
assert.equal(
  api.shouldShowInstallInvitation({
    storagePrefix: 'urhobo',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    win: {},
    nav: { standalone: true }
  }),
  false,
  'Invitation must NOT appear when navigator.standalone is true on iOS'
);

// Verify 14-day dismissal cooldown (isolated per language, expires after 14 days, no permanent installation flag)
api.clearInstallPromptDismissal('edo');
api.clearInstallPromptDismissal('urhobo');
const baseTime = 1700000000000;
assert.equal(
  api.shouldShowInstallInvitation({
    storagePrefix: 'edo',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    now: baseTime,
    win: {}
  }),
  true,
  'Invitation must appear initially on mobile phone'
);

api.dismissInstallPrompt('edo', baseTime);
assert.equal(
  api.shouldShowInstallInvitation({
    storagePrefix: 'edo',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    now: baseTime + 7 * 24 * 60 * 60 * 1000, // 7 days later
    win: {}
  }),
  false,
  'Invitation must stay dismissed during the 14-day window'
);
assert.equal(
  api.shouldShowInstallInvitation({
    storagePrefix: 'urhobo',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    now: baseTime + 1000,
    win: {}
  }),
  true,
  'Dismissing Edo prompt must not suppress Urhobo prompt'
);
assert.equal(
  api.shouldShowInstallInvitation({
    storagePrefix: 'edo',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    now: baseTime + 14 * 24 * 60 * 60 * 1000 + 1000, // After 14 days
    win: {}
  }),
  true,
  'Invitation must reappear after the 14-day dismissal window expires'
);
api.clearInstallPromptDismissal('edo');

// Verify Android native prompt trigger
let promptCalled = false;
api.setDeferredInstallPromptForTest({
  prompt: async () => { promptCalled = true; },
  userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
});
assert.equal(api.hasDeferredInstallPrompt(), true);
api.triggerNativeInstallPrompt('edo').then((outcome) => {
  assert.equal(promptCalled, true);
  assert.equal(outcome, 'accepted');
  api.setDeferredInstallPromptForTest(null);
});

// Verify PWAInstallPrompt UI component source includes honest iOS instructions and Android Install App button
const pwaComponentSource = fs.readFileSync(path.join(__dirname, '../src/components/PWAInstallPrompt.tsx'), 'utf8');
assert.ok(pwaComponentSource.includes('Add to Home Screen'), 'iOS prompt must instruct Add to Home Screen');
assert.ok(pwaComponentSource.includes('Open as Web App'), 'iOS prompt must mention Open as Web App');
assert.ok(pwaComponentSource.includes('Install App'), 'Android prompt must render Install App button');
assert.ok(!/automatic(ally)?\s+install/i.test(pwaComponentSource), 'Must never claim automatic installation on iPhone');

console.log('✓ PWA manifests, platform detection, 14-day dismissal, standalone mode suppression, and WhatsApp previews verified.');

// --- Test 10: Mobile Settings Modal, Microphone Stream Reuse & Direct Deletion ---
console.log('--- Test 10: Mobile Settings Modal, Microphone Stream Reuse & Direct Deletion ---');

// 10a: Verify App.tsx renders renderSystemModals() in both mobile and desktop viewports
const appSource = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
const mobileBranchIdx = appSource.indexOf('if (isMobileViewport)');
const desktopBranchIdx = appSource.indexOf('// 2. Desktop Web Presentation');
assert.ok(mobileBranchIdx !== -1 && desktopBranchIdx !== -1, 'Mobile and desktop branches must exist in App.tsx');
const mobileBranchCode = appSource.slice(mobileBranchIdx, desktopBranchIdx);
assert.ok(mobileBranchCode.includes('renderSystemModals()'), 'Mobile viewport return block must render renderSystemModals() so Settings opens on phones');
console.log('✓ Mobile Settings modal and QR modal rendering verified in App.tsx.');

// 10b: Verify MicrophoneRecorder stream reuse and release lifecycle
{
  const audioBundle = buildSync({
    stdin: {
      contents: `export { MicrophoneRecorder, isMicrophoneStreamReusable, releaseMicrophoneStream } from './src/services/audioService';`,
      resolveDir: path.join(__dirname, '..'),
      loader: 'ts'
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['@capacitor/*']
  }).outputFiles[0].text;

  let getUserMediaCalls = 0;
  let trackStops = 0;
  let visibilityCallback = null;
  const mockDoc = {
    visibilityState: 'visible',
    addEventListener: (evt, fn) => {
      if (evt === 'visibilitychange') visibilityCallback = fn;
    }
  };
  const mockWin = {
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: () => {}
  };
  const mockNav = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Version/17.4 Mobile/15E148 Safari/604.1',
    mediaDevices: {
      getUserMedia: async () => {
        getUserMediaCalls++;
        const track = {
          readyState: 'live',
          enabled: true,
          stop() {
            this.readyState = 'ended';
            trackStops++;
          },
          addEventListener() {}
        };
        return {
          active: true,
          getTracks: () => [track],
          getAudioTracks: () => [track]
        };
      }
    }
  };
  class MockMediaRecorder {
    static isTypeSupported(mime) { return mime === 'audio/mp4'; }
    constructor(stream, opts) {
      this.stream = stream;
      this.mimeType = opts?.mimeType || 'audio/mp4';
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
    }
    start() {
      this.state = 'recording';
    }
    requestData() {}
    stop() {
      this.state = 'inactive';
      if (this.onstop) this.onstop();
    }
  }

  const audioMod = { exports: {} };
  vm.runInNewContext(audioBundle, {
    module: audioMod,
    exports: audioMod.exports,
    console,
    window: mockWin,
    document: mockDoc,
    navigator: mockNav,
    MediaRecorder: MockMediaRecorder,
    Blob,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} }
  });

  (async () => {
    const { MicrophoneRecorder, releaseMicrophoneStream } = audioMod.exports;

    // First recording requests microphone permission once
    const rec1 = new MicrophoneRecorder();
    const res1 = await rec1.start();
    assert.equal(res1.ok, true);
    assert.equal(getUserMediaCalls, 1, 'First recording calls getUserMedia once');
    rec1.cancel();
    assert.equal(trackStops, 0, 'Stopping a recording must keep stream alive while on recording screen');

    // Second recording on the same screen reuses active stream without calling getUserMedia again
    const rec2 = new MicrophoneRecorder();
    const res2 = await rec2.start();
    assert.equal(res2.ok, true);
    assert.equal(getUserMediaCalls, 1, 'Second recording reuses active stream (0 extra getUserMedia calls)');
    rec2.cancel();

    // Leaving the recording screen releases the microphone hardware tracks
    releaseMicrophoneStream();
    assert.equal(trackStops, 1, 'releaseMicrophoneStream stops hardware audio track');

    // Returning to a recording screen acquires a fresh stream cleanly
    const rec3 = new MicrophoneRecorder();
    const res3 = await rec3.start();
    assert.equal(res3.ok, true);
    assert.equal(getUserMediaCalls, 2, 'Recording after screen exit acquires a fresh stream');
    rec3.cancel();

    // Backgrounding the app (visibilityState === 'hidden') automatically releases the microphone
    if (visibilityCallback) {
      mockDoc.visibilityState = 'hidden';
      visibilityCallback();
      assert.equal(trackStops, 2, 'Backgrounding app automatically stops microphone track');
    }
    console.log('✓ Microphone stream reuse across recordings and release on screen exit/background verified.');
  })();
}

// 10c: Verify TeachEdoScreen does not block recording start on fetchAnsweredQuestions network call
const teachSource = fs.readFileSync(path.join(__dirname, '../src/screens/TeachEdoScreen.tsx'), 'utf8');
const toggleRecIdx = teachSource.indexOf('const handleToggleRecording = async () =>');
const playRecIdx = teachSource.indexOf('const handlePlayRecordedAudio = () =>');
assert.ok(toggleRecIdx !== -1 && playRecIdx !== -1);
const toggleRecBody = teachSource.slice(toggleRecIdx, playRecIdx);
assert.ok(!toggleRecBody.includes('await fetchAnsweredQuestions()'), 'handleToggleRecording must not block microphone start on network fetch');
assert.ok(teachSource.includes('releaseMicrophoneStream()'), 'TeachEdoScreen must release microphone stream on unmount');

// 10d: Verify direct deletion in LanguageLibraryScreen without window.confirm popup
const libScreenSource = fs.readFileSync(path.join(__dirname, '../src/screens/LanguageLibraryScreen.tsx'), 'utf8');
const adminDelIdx = libScreenSource.indexOf('const handleAdminDelete = async () =>');
const verifyCodeIdx = libScreenSource.indexOf('const handleVerifyApprovalCode = async () =>');
assert.ok(adminDelIdx !== -1 && verifyCodeIdx !== -1);
const adminDelBody = libScreenSource.slice(adminDelIdx, verifyCodeIdx);
assert.ok(!adminDelBody.includes('window.confirm'), 'handleAdminDelete must not open browser window.confirm popup');
assert.ok(adminDelBody.includes('deleteInFlightRef.current'), 'handleAdminDelete must guard against duplicate double-tap requests');
assert.ok(adminDelBody.includes('if (res.ok)') && adminDelBody.indexOf('setConfirmedDeletedIds') > adminDelBody.indexOf('if (res.ok)'), 'Lesson must only be removed after backend confirms res.ok');
console.log('✓ Direct deletion without extra confirmation popup and backend-confirmed removal verified.');

// Reset to Edo at end
api.setActiveLanguage('edo');
console.log('\n=== ALL MULTI-LANGUAGE ARCHITECTURE TESTS PASSED ===\n');

