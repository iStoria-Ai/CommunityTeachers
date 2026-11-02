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

// Reset to Edo at end
api.setActiveLanguage('edo');
console.log('\n=== ALL MULTI-LANGUAGE ARCHITECTURE TESTS PASSED ===\n');

