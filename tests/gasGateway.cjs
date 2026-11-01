/**
 * Comprehensive Test Harness for Edo Language Studio Google Apps Script (gas/Code.gs)
 *
 * Mocks the Google Apps Script environment:
 * - DriveApp (Folders, Files, FileIterator, Parent relationships)
 * - PropertiesService (ScriptProperties for CONTRIBUTOR_DIRECTORY)
 * - CacheService (ScriptCache with TTL simulation for rate limiting)
 * - LockService (ScriptLock)
 * - Utilities (base64Encode, base64Decode, newBlob, getUuid)
 * - ContentService (createTextOutput, JSON MimeType)
 * - Logger (log output tracking)
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const TARGET_FOLDER_ID = '1eOYgm0ZyyPiw92NqsWFTYsv_9fZ8Jf2D';

function createMockDrive() {
  const folders = new Map();
  const files = new Map();

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
      parentFolderId: parentFolderId || TARGET_FOLDER_ID,
      trashed: false,
      getId: () => fileId,
      isTrashed: () => file.trashed,
      getName: () => file.name,
      getSize: () => file.blob.getBytes().length,
      getBlob: () => file.blob,
      setContent: (text) => {
        file.blob = makeBlob(text, file.mimeType, file.name);
      },
      setTrashed: (t) => {
        file.trashed = Boolean(t);
      },
      setSharing: () => {},
      getMimeType: () => file.mimeType || 'application/octet-stream',
      getParents: () => {
        let done = false;
        return {
          hasNext: () => !done && !file.trashed,
          next: () => {
            done = true;
            const parent = folders.get(file.parentFolderId);
            return parent || {
              getId: () => file.parentFolderId,
              getName: () => 'Edo Language Studio',
              getParents: () => ({ hasNext: () => false, next: () => null })
            };
          }
        };
      }
    };
    files.set(fileId, file);
    return file;
  }

  function makeFolder(id, name, parentId = null) {
    const fObj = {
      getId: () => id,
      getName: () => name,
      getParentId: () => parentId,
      getParents: () => {
        let done = false;
        return {
          hasNext: () => !done && parentId !== null,
          next: () => {
            done = true;
            return folders.get(parentId);
          }
        };
      },
      createFile: (blob) => createFile(blob, id),
      createFolder: (subName) => {
        const subId = 'folder-' + Math.random().toString(36).substring(2, 9);
        const subFolder = makeFolder(subId, subName, id);
        folders.set(subId, subFolder);
        return subFolder;
      },
      getFoldersByName: (subName) => {
        const matching = Array.from(folders.values()).filter(f => f.getParentId() === id && f.getName() === subName);
        let idx = 0;
        return {
          hasNext: () => idx < matching.length,
          next: () => matching[idx++]
        };
      },
      getFilesByName: (fileName) => {
        const matching = Array.from(files.values()).filter(f => !f.trashed && f.parentFolderId === id && f.name === fileName);
        let idx = 0;
        return {
          hasNext: () => idx < matching.length,
          next: () => matching[idx++]
        };
      },
      getFiles: () => {
        const all = Array.from(files.values()).filter(f => !f.trashed && f.parentFolderId === id);
        let idx = 0;
        return {
          hasNext: () => idx < all.length,
          next: () => all[idx++]
        };
      }
    };
    return fObj;
  }

  const rootFolder = makeFolder(TARGET_FOLDER_ID, 'Edo Language Studio', null);
  folders.set(TARGET_FOLDER_ID, rootFolder);

  const driveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
    Permission: { VIEW: 'VIEW' },
    getFolderById: (id) => {
      const f = folders.get(id);
      if (!f) throw new Error('Folder not found: ' + id);
      return f;
    },
    getFileById: (id) => {
      const file = files.get(id);
      if (!file || file.trashed) throw new Error('File not found: ' + id);
      return file;
    }
  };

  return { driveApp, files, makeBlob };
}

function runTests() {
  console.log('=== Running Automated Tests on gas/Code.gs ===\n');

  const { driveApp, files, makeBlob } = createMockDrive();

  // Mock CacheService with TTL map
  const cacheStore = new Map();
  const cacheService = {
    getScriptCache: () => ({
      get: (key) => cacheStore.get(key) || null,
      put: (key, val, ttl) => cacheStore.set(key, String(val)),
      remove: (key) => cacheStore.delete(key)
    })
  };

  // Mock PropertiesService
  const scriptPropertiesStore = new Map();
  const propertiesService = {
    getScriptProperties: () => ({
      getProperties: () => Object.fromEntries(scriptPropertiesStore),
      getProperty: (k) => scriptPropertiesStore.get(k) || null,
      setProperty: (k, v) => scriptPropertiesStore.set(k, String(v)),
      deleteProperty: (k) => scriptPropertiesStore.delete(k)
    })
  };

  // Configure admin token and registered directory
  const adminToken = 'ADMIN-SUPER-SECRET-2026';
  const speakerToken = 'SPEAKER-SECRET-2026';
  scriptPropertiesStore.set('CONTRIBUTOR_DIRECTORY', JSON.stringify({
    [adminToken]: { id: 'admin-01', name: 'Project Lead', role: 'admin' },
    [speakerToken]: { id: 'speaker-01', name: 'Registered Speaker', role: 'speaker' }
  }));

  // Mock Utilities
  const utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algorithm, text) => Array.from(require('node:crypto').createHash('sha256').update(text).digest()),
    base64Decode: (b64) => {
      if (!/^[A-Za-z0-9+/=]+$/.test(b64.trim())) {
        throw new Error('Invalid base64 string');
      }
      return Buffer.from(b64, 'base64');
    },
    base64Encode: (bytes) => {
      const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      return buf.toString('base64');
    },
    newBlob: (bytes, mime, name) => makeBlob(bytes, mime, name),
    getUuid: () => 'uuid-' + Math.random().toString(36).substring(2, 10)
  };

  // Mock LockService
  const lockService = {
    getScriptLock: () => ({
      hasLock: () => false,
      waitLock: () => true,
      releaseLock: () => true
    })
  };

  // Mock ContentService
  const contentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (content) => ({
      mimeType: null,
      setMimeType: function(m) { this.mimeType = m; return this; },
      getContent: () => content
    })
  };

  // Mock Logger
  const logs = [];
  const logger = {
    log: (msg) => {
      logs.push(msg);
      // console.log('  [GAS Logger]', msg);
    }
  };

  // Setup VM sandbox with Code.gs code
  const codeGsSource = fs.readFileSync(path.join(__dirname, '../gas/Code.gs'), 'utf8');
  const JPEG_BYTES = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(300, 7)]);
  const fetchCalls = [];
  const fetchResponses = new Map(); // url -> { code, bytes }
  const urlFetchApp = {
    fetch: (url, opts) => {
      fetchCalls.push({ url, opts });
      const configured = fetchResponses.get(url) || { code: 200, bytes: JPEG_BYTES };
      return {
        getResponseCode: () => configured.code,
        getContent: () => configured.bytes,
        getBlob: () => makeBlob(configured.bytes, 'image/jpeg', 'mock_image.jpg')
      };
    }
  };
  const sandbox = {
    DriveApp: driveApp,
    PropertiesService: propertiesService,
    CacheService: cacheService,
    LockService: lockService,
    Utilities: utilities,
    UrlFetchApp: urlFetchApp,
    ContentService: contentService,
    HtmlService: {
      createHtmlOutput: (html) => ({
        getContent: () => html,
        setTitle: function() { return this; }
      })
    },
    Logger: logger,
    console: console
  };

  vm.createContext(sandbox);
  vm.runInContext(codeGsSource, sandbox);

  // 1. Run the built-in 12-step self-test suite (runFullGatewaySelfTest)
  console.log('--- Step 1: Running in-script self-test suite (runFullGatewaySelfTest) ---');
  sandbox.runFullGatewaySelfTest();
  assert(logs.some(l => l.includes('ALL TESTS PASSED SUCCESSFULLY')), 'In-script self-test failed');
  console.log('✓ All 12 in-script gateway verification tests passed successfully.\n');

  // 2. Token-Free Automatic Upload Tests (Community Contributor)
  console.log('--- Step 2: Testing Token-Free Automatic Upload (Community Mode) ---');
  const dummyWav = Buffer.from('RIFF....WAVEfmt ....data....');
  const dummyWavB64 = dummyWav.toString('base64');

  const communityPayload = {
    action: 'upload_recording',
    authToken: '', // No token provided!
    lessonId: 'word-water',
    recordingId: 'rec-water-001',
    english: 'Water',
    edoText: 'Ame',
    audioBase64: dummyWavB64,
    mimeType: 'audio/wav',
    durationSec: 2,
    permissions: { playback: 'granted', aiVoiceTraining: 'denied' }
  };

  const uploadRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify(communityPayload) }
  }).getContent());

  assert.equal(uploadRes.status, 'success', 'Token-free upload must succeed');
  assert.equal(uploadRes.duplicate, false);
  assert.equal(uploadRes.recordingStatus, 'spelling_submitted');
  assert(uploadRes.audioFileId, 'Audio file ID must be returned');
  assert(uploadRes.metadataFileId, 'Metadata file ID must be returned');
  console.log('✓ Token-free voice recording upload with spelling succeeded.');

  // Verify companion metadata stored in Drive
  const metaFile = driveApp.getFileById(uploadRes.metadataFileId);
  const metadata = JSON.parse(metaFile.getBlob().getDataAsString());
  assert.equal(metadata.englishWord, 'Water');
  assert.equal(metadata.edoSpelling, 'Ame');
  assert.equal(metadata.audioFileId, uploadRes.audioFileId);
  assert.equal(metadata.permissions.playback, 'granted');
  assert.equal(metadata.permissions.aiVoiceTraining, 'denied', 'AI training must strictly be denied');
  assert.equal(metadata.voiceContributor.role, 'community_contributor');
  console.log('✓ Companion metadata correctly structured with community_contributor attribution and explicit AI training consent denial.');

  // 3. Duplicate Idempotency Check for Community Uploads
  console.log('--- Step 3: Testing Idempotency & Duplicate Prevention ---');
  const duplicateRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify(communityPayload) }
  }).getContent());
  assert.equal(duplicateRes.status, 'success');
  assert.equal(duplicateRes.duplicate, true, 'Submitting identical recording must be flagged duplicate');
  assert.equal(duplicateRes.audioFileId, uploadRes.audioFileId, 'Must return existing audio ID without re-creating');
  console.log('✓ Duplicate upload handled idempotently without file duplication.');

  // 4. Token-Free Voice Upload Needing Spelling (Person A alone)
  console.log('--- Step 4: Testing Person A Upload Needing Spelling ---');
  const needsSpellingPayload = {
    action: 'upload_recording',
    authToken: '',
    lessonId: 'word-food',
    recordingId: 'rec-food-001',
    english: 'Food',
    edoText: '', // Empty spelling
    audioBase64: dummyWavB64,
    mimeType: 'audio/wav',
    durationSec: 1.5,
    permissions: { playback: 'granted', aiVoiceTraining: 'denied' }
  };
  const needsSpellingRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify(needsSpellingPayload) }
  }).getContent());
  assert.equal(needsSpellingRes.status, 'success');
  assert.equal(needsSpellingRes.recordingStatus, 'needs_spelling');
  console.log('✓ Recording with blank spelling set to "needs_spelling".');

  // 5. Shared Queue Retrieval (Person B)
  console.log('--- Step 5: Testing Person B Queue Retrieval ---');
  const queueRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ action: 'get_needs_spelling' }) }
  }).getContent());
  assert.equal(queueRes.status, 'success');
  assert(queueRes.items.some(i => i.recordingId === 'rec-food-001'), 'Food recording must appear in queue');
  console.log(`✓ Person B queue retrieved ${queueRes.count} pending item(s).`);

  // 6. Community Audio Playback Stream (Person B listens)
  console.log('--- Step 6: Testing Audio Playback Streaming ---');
  const streamRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ action: 'stream_audio', fileId: needsSpellingRes.audioFileId }) }
  }).getContent());
  assert.equal(streamRes.status, 'success');
  assert(streamRes.audioDataUrl.startsWith('data:audio/wav;base64,'), 'Data URL returned for playback');
  console.log('✓ Audio playback stream verified for Person B.');

  // 7. Community Spelling Submission (Person B writes Edo text)
  console.log('--- Step 7: Testing Person B Spelling Submission ---');
  const submitSpellingRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'submit_spelling',
      metadataFileId: needsSpellingRes.metadataFileId,
      edoSpelling: 'Evbare'
    }) }
  }).getContent());
  assert.equal(submitSpellingRes.status, 'spelling_submitted');
  assert.equal(submitSpellingRes.edoSpelling, 'Evbare');

  // Verify updated metadata
  const updatedMeta = JSON.parse(driveApp.getFileById(needsSpellingRes.metadataFileId).getBlob().getDataAsString());
  assert.equal(updatedMeta.edoSpelling, 'Evbare');
  assert.equal(updatedMeta.status, 'spelling_submitted');
  assert(updatedMeta.spellingContributor, 'Spelling contributor stamped');
  console.log('✓ Person B spelling submission succeeded and updated status to "spelling_submitted".');

  // 8. Concurrency Protection (Prevent double submission)
  console.log('--- Step 8: Testing Concurrency Protection ---');
  const conflictRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'submit_spelling',
      metadataFileId: needsSpellingRes.metadataFileId,
      edoSpelling: 'Evbare Duplicate'
    }) }
  }).getContent());
  assert.equal(conflictRes.code, 'SPELLING_ALREADY_SUBMITTED');
  console.log('✓ Second spelling submission safely rejected with SPELLING_ALREADY_SUBMITTED.');

  const libraryRequest = () => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'get_library' }) } }).getContent());
  const shared = libraryRequest();
  assert.equal(shared.status, 'success');
  assert.equal(shared.items.length, 2);
  assert(shared.items.some(entry => entry.recordingId === 'rec-food-001' && entry.edoText === 'Evbare'));
  assert(shared.answeredQuestionIds.includes('word-water'));
  assert(shared.items.every(entry => !('ownerKeyHash' in entry) && !('authToken' in entry) && !('voiceContributor' in entry)));
  const ownerKey = 'a'.repeat(64);
  const ownedPayload = { ...communityPayload, lessonId: 'custom-owner-test', recordingId: 'rec-owned-test', ownerKey };
  const owned = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(ownedPayload) } }).getContent());
  const changePermissions = key => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'update_recording_permissions', metadataFileId: owned.metadataFileId, ownerKey: key, permissions: { playback: 'denied', aiVoiceTraining: 'denied' } }) } }).getContent());
  assert.equal(changePermissions('b'.repeat(64)).code, 'OWNER_REQUIRED');
  assert.equal(changePermissions(ownerKey).status, 'success');
  assert.equal(libraryRequest().items.find(entry => entry.recordingId === 'rec-owned-test').playbackPermission, 'denied');
  driveApp.getFileById(owned.audioFileId).setTrashed(true);
  driveApp.getFileById(owned.metadataFileId).setTrashed(true);
  const repeatedSpelling = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'submit_spelling', metadataFileId: needsSpellingRes.metadataFileId, edoSpelling: 'Evbare' }) } }).getContent());
  assert.equal(repeatedSpelling.status, 'success', 'Offline spelling retry must be idempotent');

  // Corrections use optimistic revisions and preserve the original audio/history.
  const currentFood = JSON.parse(driveApp.getFileById(needsSpellingRes.metadataFileId).getBlob().getDataAsString());
  const beforeCorrectionIds = new Set(files.keys());
  const correction = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'update_contribution', metadataFileId: needsSpellingRes.metadataFileId, expectedVersion: currentFood.version || 0, mutationId: 'correction-0001', edoText: 'Evbare corrected' }) } }).getContent());
  assert.equal(correction.status, 'success');
  assert.equal(correction.audioFileId, needsSpellingRes.audioFileId);
  const afterCorrection = JSON.parse(driveApp.getFileById(needsSpellingRes.metadataFileId).getBlob().getDataAsString());
  assert.equal(afterCorrection.version, (currentFood.version || 0) + 1, 'Version is incremented in-place');
  assert.equal(afterCorrection.edoSpelling, 'Evbare corrected', 'Spelling is updated in-place');
  const historyFilesAfterEdit = Array.from(files.values()).filter(f => !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.includes('_history_'));
  assert.equal(historyFilesAfterEdit.length, 0, 'Editing spelling must NOT create history JSON files');
  const conflict = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'update_contribution', metadataFileId: needsSpellingRes.metadataFileId, expectedVersion: currentFood.version || 0, mutationId: 'correction-0002', edoText: 'Lost-update attempt' }) } }).getContent());
  assert.equal(conflict.code, 'REVISION_CONFLICT');
  const textId = 'text-' + 'f'.repeat(64);
  const textUpload = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'upsert_text_contribution', lessonId: 'custom-written-flow', recordingId: textId, english: 'Head', edoText: 'Speaker supplied spelling', category: 'word' }) } }).getContent());
  assert.equal(textUpload.status, 'success');
  const attachment = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'update_contribution', metadataFileId: textUpload.metadataFileId, expectedVersion: 0, mutationId: 'attachment-0001', audioBase64: dummyWavB64, mimeType: 'audio/wav', permissions: { playback: 'granted', aiVoiceTraining: 'denied' } }) } }).getContent());
  assert.equal(attachment.status, 'success');
  assert.equal(attachment.metadataFileId, textUpload.metadataFileId);
  const attachedItem = libraryRequest().items.find(entry => entry.cloudMetadataFileId === textUpload.metadataFileId);
  assert.equal(attachedItem.hasAudio, true);
  assert.equal(attachedItem.edoText, 'Speaker supplied spelling');
  assert(libraryRequest().answeredEnglish.includes('head'), 'Custom aliases retire the equivalent starter question');

  // Step 8b: Testing Voice Replacement & Complete Google Drive Old Audio Deletion
  console.log('--- Step 8b: Testing Replacement Voice & Drive Cleanup ---');
  // 1. Initial lesson with recording
  const replaceUpload = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-replacetest',
      recordingId: 'rec-replace-001',
      english: 'Door',
      edoText: 'Ukhegbe',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav',
      durationSec: 3
    }) }
  }).getContent());
  assert.equal(replaceUpload.status, 'success');
  const oldAudioId = replaceUpload.audioFileId;
  const replaceMetaId = replaceUpload.metadataFileId;
  assert.equal(driveApp.getFileById(oldAudioId).isTrashed(), false);

  // Another contributor's unrelated recording
  const otherUpload = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-othertest',
      recordingId: 'rec-other-001',
      english: 'Window',
      edoText: 'Owindo',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav',
      durationSec: 3
    }) }
  }).getContent());
  assert.equal(otherUpload.status, 'success');
  const otherAudioId = otherUpload.audioFileId;
  assert.equal(driveApp.getFileById(otherAudioId).isTrashed(), false);

  // 2. Failed upload test: invalid audio must NOT delete the old working recording
  const failedReplacement = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'update_contribution',
      metadataFileId: replaceMetaId,
      expectedVersion: 0,
      audioBase64: 'short', // invalid size
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(failedReplacement.status, 'error');
  assert.equal(driveApp.getFileById(oldAudioId).isTrashed(), false, 'Failed replacement preserves existing recording');

  // 3. Successful replacement voice upload
  const replacementWavB64 = Buffer.from('RIFF....WAVEfmt ....data....replacement-audio').toString('base64');
  const replaceRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'update_contribution',
      metadataFileId: replaceMetaId,
      expectedVersion: 0,
      mutationId: 'replace-mutation-001',
      audioBase64: replacementWavB64,
      mimeType: 'audio/wav',
      durationSec: 2,
      permissions: { playback: 'granted', aiVoiceTraining: 'denied' }
    }) }
  }).getContent());
  assert.equal(replaceRes.status, 'success');
  assert.equal(replaceRes.verified, true);
  const newAudioId = replaceRes.audioFileId;
  assert(newAudioId && newAudioId !== oldAudioId, 'New audio file must have a new distinct ID');
  assert.equal(replaceRes.previousAudioFileId, oldAudioId, 'Response returns previous audio file ID');

  // 4. Verify Drive cleanup:
  // Previous audio file belonging to that lesson is permanently deleted (trashed)
  assert.equal(files.get(oldAudioId).isTrashed(), true, 'Previous audio file permanently trashed');
  assert.throws(() => driveApp.getFileById(oldAudioId), /File not found/);
  // New audio file is alive and verified
  assert.equal(files.get(newAudioId).isTrashed(), false, 'New audio file is verified and active');
  // Unrelated lesson/contributor audio is NOT deleted
  assert.equal(files.get(otherAudioId).isTrashed(), false, 'Unrelated lesson audio preserved');

  // Verify only 1 audio file exists for word-replacetest_rec-replace-001
  const activeAudioForLesson = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('word-replacetest_rec-replace-001') && !f.name.endsWith('.json')
  );
  assert.equal(activeAudioForLesson.length, 1, 'Exactly one audio file kept for this lesson in Google Drive');
  assert.equal(activeAudioForLesson[0].id, newAudioId);

  // 5. Verify Playback
  const newStream = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ action: 'stream_audio', fileId: newAudioId }) }
  }).getContent());
  assert.equal(newStream.status, 'success');

  const oldStream = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ action: 'stream_audio', fileId: oldAudioId }) }
  }).getContent());
  assert.equal(oldStream.status, 'error', 'Trashed old audio cannot be played');

  // 5b. Verify successive voice replacement (v1 -> v2) also trashes v1 and preserves exactly 1 active audio file
  const replacementWavB64v2 = Buffer.from('RIFF....WAVEfmt ....data....replacement-audio-v2').toString('base64');
  const replaceRes2 = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'update_contribution',
      metadataFileId: replaceMetaId,
      expectedVersion: 1,
      mutationId: 'replace-mutation-002',
      audioBase64: replacementWavB64v2,
      mimeType: 'audio/wav',
      durationSec: 2,
      permissions: { playback: 'granted', aiVoiceTraining: 'denied' }
    }) }
  }).getContent());
  assert.equal(replaceRes2.status, 'success');
  const v2AudioId = replaceRes2.audioFileId;
  assert(v2AudioId && v2AudioId !== newAudioId);
  assert.equal(files.get(oldAudioId).isTrashed(), true, 'Original v0 audio remains trashed');
  assert.equal(files.get(newAudioId).isTrashed(), true, 'Previous v1 audio is now trashed');
  assert.equal(files.get(v2AudioId).isTrashed(), false, 'Latest v2 audio is active');

  // Verify NO history JSON snapshots were created (Simplified Two-File Architecture)
  const historyFiles = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.includes('_history_')
  );
  assert.equal(historyFiles.length, 0, 'No history JSON snapshots created during voice replacements');

  // Verify strictly 1 audio file exists for the lesson in the entire folder
  const activeAudioAfterV2 = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('word-replacetest_rec-replace-001') && !f.name.endsWith('.json')
  );
  assert.equal(activeAudioAfterV2.length, 1, 'Strictly 1 active audio file exists after multiple replacements');
  assert.equal(activeAudioAfterV2[0].id, v2AudioId);

  // Verify strictly 1 metadata JSON file exists for the lesson in the entire folder
  const activeMetaAfterV2 = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('word-replacetest_rec-replace-001') && f.name.endsWith('.json')
  );
  assert.equal(activeMetaAfterV2.length, 1, 'Strictly 1 metadata JSON file exists for the lesson in Google Drive');

  // Verify the entire lesson consists of strictly 2 files in Google Drive: 1 audio + 1 metadata
  const totalLessonFiles = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('word-replacetest_rec-replace-001')
  );
  assert.equal(totalLessonFiles.length, 2, 'Lesson maintains strictly two files in Google Drive (1 audio + 1 metadata)');

  // 6. Verify locking permission: Ordinary user cannot replace audio on approved_locked lesson
  const lockCode = '987654';
  const lockCodeHash = require('node:crypto').createHash('sha256').update(lockCode).digest('hex');
  sandbox.PropertiesService.getScriptProperties().setProperty('TRUSTED_APPROVAL_CODE_HASH', lockCodeHash);
  const lockRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ action: 'admin_lock_entry', approvalCode: lockCode, metadataFileId: replaceMetaId }) }
  }).getContent());
  assert.equal(lockRes.status, 'success');

  // Verify approval/locking did NOT create any history JSON files
  const historyFilesAfterLock = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.includes('_history_')
  );
  assert.equal(historyFilesAfterLock.length, 0, 'Approving and locking must NOT create history JSON files');

  // Verify total files for lesson is still strictly 2 after approval
  const totalLessonFilesAfterLock = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('word-replacetest_rec-replace-001')
  );
  assert.equal(totalLessonFilesAfterLock.length, 2, 'Lesson still maintains strictly two files after approval and locking');

  const lockedReplaceAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'update_contribution',
      metadataFileId: replaceMetaId,
      expectedVersion: 2,
      audioBase64: replacementWavB64,
      mimeType: 'audio/wav',
      permissions: { playback: 'granted' }
    }) }
  }).getContent());
  assert.equal(lockedReplaceAttempt.code, 'ENTRY_LOCKED', 'Ordinary users must not replace locked recordings');
  assert.equal(driveApp.getFileById(v2AudioId).isTrashed(), false, 'Approved audio is preserved');

  // Clean up test records
  driveApp.getFileById(v2AudioId).setTrashed(true);
  driveApp.getFileById(replaceMetaId).setTrashed(true);
  driveApp.getFileById(otherAudioId).setTrashed(true);
  driveApp.getFileById(otherUpload.metadataFileId).setTrashed(true);
  console.log('✓ Replacement recordings, Google Drive cleanup, playback verification, and locked protection verified.');

  // Step 8c: Testing Teach Edo & Help Others Spelling Without Audio Duplication
  console.log('--- Step 8c: Testing Teach Edo & Help Others Spelling Without Audio Duplication ---');

  // 1. Teach Edo: Contributor records voice without spelling
  const teachEdoVoiceOnly = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'move-stand-test',
      recordingId: 'rec-stand-001',
      english: 'Stand',
      edoText: '',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav',
      durationSec: 2
    }) }
  }).getContent());
  assert.equal(teachEdoVoiceOnly.status, 'success');
  assert.equal(teachEdoVoiceOnly.recordingStatus, 'needs_spelling');
  const standAudioId = teachEdoVoiceOnly.audioFileId;
  const standMetaId = teachEdoVoiceOnly.metadataFileId;

  // Verify exactly 1 audio file exists for Stand
  const standAudioFiles1 = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('move-stand-test_') && !f.name.endsWith('.json')
  );
  assert.equal(standAudioFiles1.length, 1, 'Exactly 1 audio file created initially for Stand');

  // 2. Teach Edo: User later writes Edo spelling for Stand ("Otẹ") and submits
  // Gateway MUST update the existing metadata file and NOT create another audio file!
  const teachEdoSpellingLater = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'move-stand-test',
      recordingId: 'rec-stand-002', // different recording ID from later step
      english: 'Stand',
      edoText: 'Otẹ',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav',
      durationSec: 2
    }) }
  }).getContent());
  assert.equal(teachEdoSpellingLater.status, 'success');
  assert.equal(teachEdoSpellingLater.duplicate, true);
  assert.equal(teachEdoSpellingLater.metadataFileId, standMetaId, 'Updated existing metadata file');
  assert.equal(teachEdoSpellingLater.audioFileId, standAudioId, 'Preserved existing audio file ID');

  // Verify that STILL only 1 audio file exists for Stand (NO duplicate audio file!)
  const standAudioFiles2 = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('move-stand-test_') && !f.name.endsWith('.json')
  );
  assert.equal(standAudioFiles2.length, 1, 'Adding spelling later did NOT create a second audio file!');

  // Verify metadata has spelling updated
  const standMetaUpdated = JSON.parse(driveApp.getFileById(standMetaId).getBlob().getDataAsString());
  assert.equal(standMetaUpdated.edoSpelling, 'Otẹ', 'Spelling attached to existing metadata');
  assert.equal(standMetaUpdated.status, 'spelling_submitted');

  // 3. Help Others: Contributor submits spelling for another voice-only entry via update_contribution
  const helpOthersItem = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-jump-test',
      recordingId: 'rec-jump-001',
      english: 'Jump',
      edoText: '',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav',
      durationSec: 2
    }) }
  }).getContent());
  assert.equal(helpOthersItem.status, 'success');
  const jumpAudioId = helpOthersItem.audioFileId;
  const jumpMetaId = helpOthersItem.metadataFileId;

  // Help Others writes spelling via update_contribution (NO audioBase64 in payload)
  const helpOthersSave = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'update_contribution',
      metadataFileId: jumpMetaId,
      expectedVersion: 0,
      mutationId: 'help-others-jump-001',
      edoText: 'Gbe'
    }) }
  }).getContent());
  assert.equal(helpOthersSave.status, 'success');
  assert.equal(helpOthersSave.audioFileId, jumpAudioId, 'Audio file ID preserved');

  // Verify exactly 1 audio file exists for Jump (Help Others created NO audio files)
  const jumpAudioFiles = Array.from(files.values()).filter(f =>
    !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.startsWith('word-jump-test_') && !f.name.endsWith('.json')
  );
  assert.equal(jumpAudioFiles.length, 1, 'Help Others saving spelling created ZERO audio files');

  // 4. Failed upload safety: corrupted audio payload must fail safely without altering existing files
  const failedUpload = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'update_contribution',
      metadataFileId: jumpMetaId,
      expectedVersion: 1,
      audioBase64: 'bad-short-string',
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(failedUpload.status, 'error');
  assert.equal(driveApp.getFileById(jumpAudioId).isTrashed(), false, 'Existing valid audio retained on failed upload');

  // Clean up Step 8c test files
  driveApp.getFileById(standAudioId).setTrashed(true);
  driveApp.getFileById(standMetaId).setTrashed(true);
  driveApp.getFileById(jumpAudioId).setTrashed(true);
  driveApp.getFileById(jumpMetaId).setTrashed(true);
  console.log('✓ Teach Edo and Help Others spelling additions verified without audio duplication.');

  for (const [id, file] of files) if (!beforeCorrectionIds.has(id)) file.setTrashed(true);
  console.log('✓ Revision conflicts, immutable audio history, and spelling-only → complete use the same metadata record.');

  // Live collection totals must fall when files are deleted outside the app.
  const readStats = () => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'get_collection_stats' }) } }).getContent());
  const beforeDelete = readStats();
  assert.equal(beforeDelete.status, 'success');
  assert.equal(beforeDelete.stats.voiceRecordings, 2);
  assert.equal(beforeDelete.stats.wordsCollected, 2);
  const audioFile = driveApp.getFileById(uploadRes.audioFileId);
  audioFile.setTrashed(true);
  const afterDelete = readStats();
  assert.equal(afterDelete.stats.voiceRecordings, 1, 'An orphaned metadata file must not count as a recording');
  assert.equal(afterDelete.stats.wordsCollected, 1);
  assert.equal(afterDelete.stats.fileCount, beforeDelete.stats.fileCount - 1);
  driveApp.getFileById(needsSpellingRes.metadataFileId).setTrashed(true);
  assert.equal(readStats().stats.totalContributions, 0, 'Missing metadata must not count');
  for (const file of files.values()) file.setTrashed(true);
  const ledgerAfterDelete = libraryRequest();
  assert.equal(ledgerAfterDelete.items.length, 0);
  assert(ledgerAfterDelete.answeredQuestionIds.includes('word-water'), 'Deleting files must not reopen an answered question');
  const emptyStats = readStats().stats;
  for (const key of Object.keys(emptyStats)) assert.equal(emptyStats[key], 0, `An emptied Drive must reset ${key}`);
  const folder = driveApp.getFolderById(TARGET_FOLDER_ID);
  folder.createFile(makeBlob('report', 'application/json', 'live-token-free-sync.json'));
  folder.createFile(makeBlob('{broken', 'application/json', 'broken_meta.json'));
  const ignoredStats = readStats().stats;
  assert.equal(ignoredStats.fileCount, 2, 'Report and corrupt files still count as files');
  assert.equal(ignoredStats.totalContributions, 0, 'Report and corrupt files are not learning contributions');
  console.log('✓ Live folder totals reflect audio/metadata deletion and an empty fresh start.');

  // 9. Community Rate Limit Protection
  console.log('--- Step 9: Testing Rate Limit Enforcement ---');
  // Fill window quota
  const currentWindow = Math.floor(Date.now() / (600 * 1000));
  cacheStore.set('rate_community_uploads_' + currentWindow, '30'); // Quota reached

  const rateLimitedRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-spam',
      recordingId: 'rec-spam-001',
      english: 'Spam',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(rateLimitedRes.code, 'RATE_LIMIT_EXCEEDED');
  console.log('✓ Abuse protection triggered: 31st upload rejected with RATE_LIMIT_EXCEEDED.');

  // 10. Privileged/Registered token bypasses community rate limit
  console.log('--- Step 10: Testing Registered Token Rate Limit Immunity ---');
  const registeredRes = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: speakerToken, // Registered speaker token
      lessonId: 'word-privileged',
      recordingId: 'rec-priv-001',
      english: 'Privileged',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(registeredRes.status, 'success', 'Registered token is not blocked by community rate limit');
  console.log('✓ Registered speaker token successfully bypasses community rate limiter.');

  // 11. Administrator Approval & Locking System
  console.log('--- Step 11: Testing Administrator Approval & Locking System ---');
  // Reset rate limit key so community test can upload
  cacheStore.delete('rate_community_uploads_' + currentWindow);
  const uploadForLock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-locktest',
      recordingId: 'rec-lock-001',
      english: 'Lock Test',
      edoText: 'Igho',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(uploadForLock.status, 'success');
  const targetMetaFileId = uploadForLock.metadataFileId;

  // Non-admin attempting to lock must be rejected
  const nonAdminLock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_lock_entry',
      authToken: speakerToken, // speaker, not admin
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(nonAdminLock.code, 'UNAUTHORIZED_ADMIN');

  // Admin locking the entry succeeds
  const adminLock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_lock_entry',
      authToken: adminToken, // verified admin
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(adminLock.status, 'success');
  assert.equal(adminLock.reviewStatus, 'approved_locked');
  assert.equal(adminLock.approvedBy.name, 'Project Lead');
  console.log('✓ Admin successfully locked and approved entry (status: approved_locked).');

  // Verify that subsequent community attempt to modify or overwrite locked entry is rejected with ENTRY_LOCKED
  const lockedUploadAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-locktest',
      recordingId: 'rec-lock-001',
      english: 'Lock Test Tampered',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(lockedUploadAttempt.code, 'ENTRY_LOCKED');
  const lockedEdit = JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action: 'update_contribution', metadataFileId: targetMetaFileId, expectedVersion: 0, edoText: 'Unauthorized edit' }) } }).getContent());
  assert.equal(lockedEdit.code, 'ENTRY_LOCKED');
  console.log('✓ Modification of locked entry correctly blocked with ENTRY_LOCKED.');

  // Admin unlocking the entry succeeds
  const adminUnlock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_unlock_entry',
      authToken: adminToken,
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(adminUnlock.status, 'success');
  assert.equal(adminUnlock.reviewStatus, 'pending_approval');
  console.log('✓ Admin successfully unlocked entry.');

  // --- Step 11b: Testing Trusted Speaker Secret Approval Code System ---
  console.log('--- Step 11b: Testing Trusted Speaker Secret Approval Code System ---');
  const crypto = require('node:crypto');
  const trustedCode = 'EdoElder2026!';
  const trustedCodeHash = crypto.createHash('sha256').update(trustedCode).digest('hex');
  sandbox.PropertiesService.getScriptProperties().setProperty('TRUSTED_APPROVAL_CODE_HASH', trustedCodeHash);

  // 1. Trusted speaker approval locks the lesson
  const trustedLock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_lock_entry',
      approvalCode: trustedCode,
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(trustedLock.status, 'success');
  assert.equal(trustedLock.reviewStatus, 'approved_locked');
  assert.equal(trustedLock.approvedBy.role, 'trusted_approver');
  assert.equal(trustedLock.approvedBy.name, 'Trusted Edo Speaker');
  console.log('✓ Trusted speaker successfully approved and locked lesson using secret approval code.');

  // 2. Trusted speaker CANNOT unlock the lesson (restricted strictly to owner admin)
  const trustedUnlockAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_unlock_entry',
      authToken: trustedCode,
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(trustedUnlockAttempt.code, 'UNAUTHORIZED_ADMIN');
  console.log('✓ Destructive unlock action correctly blocked for trusted approver.');

  // 3. Trusted speaker CANNOT delete the lesson (restricted strictly to owner admin)
  const trustedDeleteAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_delete_entry',
      authToken: trustedCode,
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(trustedDeleteAttempt.code, 'UNAUTHORIZED_ADMIN');
  console.log('✓ Destructive delete action correctly blocked for trusted approver.');

  // 4. Rate-limiting on incorrect approval code guessing attempts
  for (let attempt = 0; attempt < 4; attempt++) {
    const badAttempt = JSON.parse(sandbox.doPost({
      postData: { contents: JSON.stringify({
        action: 'admin_lock_entry',
        approvalCode: 'WrongSecretGuess' + attempt,
        metadataFileId: targetMetaFileId
      }) }
    }).getContent());
    assert.equal(badAttempt.code, 'UNAUTHORIZED_ADMIN');
  }
  // 5th failed attempt should trigger rate limiting lockout
  sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_lock_entry',
      approvalCode: 'WrongSecretGuess4',
      metadataFileId: targetMetaFileId
    }) }
  });
  const lockedOutAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_lock_entry',
      approvalCode: 'WrongSecretGuess5',
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(lockedOutAttempt.code, 'RATE_LIMIT_EXCEEDED');
  assert.match(lockedOutAttempt.message, /Too many incorrect approval attempts/);
  console.log('✓ Guessing protection: Rate limiting locked out invalid approval attempts.');

  // Reset approval fail cache and unlock entry with owner admin token
  sandbox.CacheService.getScriptCache().remove('rate_approval_fail_attempts');
  const finalUnlock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_unlock_entry',
      authToken: adminToken,
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(finalUnlock.status, 'success');

  // --- Step 11c: Owner-Configured Six-Digit Approval Number System ---
  console.log('--- Step 11c: Testing Six-Digit Approval Number System ---');
  // 1. Non-admin cannot set the 6-digit approval code
  const unauthorizedSetCode = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_set_approval_code',
      authToken: speakerToken,
      approvalCode: '482910'
    }) }
  }).getContent());
  assert.equal(unauthorizedSetCode.code, 'UNAUTHORIZED_ADMIN');

  // 2. Owner admin cannot set a non-6-digit code
  const invalidFormatSetCode = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_set_approval_code',
      authToken: adminToken,
      approvalCode: '12345'
    }) }
  }).getContent());
  assert.equal(invalidFormatSetCode.code, 'INVALID_APPROVAL_CODE');

  // 3. Owner admin sets a valid 6-digit approval code
  const validSetCode = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_set_approval_code',
      authToken: adminToken,
      approvalCode: '482910'
    }) }
  }).getContent());
  assert.equal(validSetCode.status, 'success');
  assert.equal(validSetCode.action, 'admin_set_approval_code');

  // 4. Trusted Edo speaker approves and locks lesson using the 6-digit number
  const sixDigitLock = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_lock_entry',
      authToken: '482910',
      approvalCode: '482910',
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(sixDigitLock.status, 'success');
  assert.equal(sixDigitLock.reviewStatus, 'approved_locked');
  assert.equal(sixDigitLock.approvedBy.role, 'trusted_approver');

  // 5. The 6-digit number cannot unlock lessons, delete lessons, or change the 6-digit number
  const sixDigitUnlockAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_unlock_entry',
      authToken: '482910',
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(sixDigitUnlockAttempt.code, 'UNAUTHORIZED_ADMIN');

  const sixDigitDeleteAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_delete_entry',
      authToken: '482910',
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(sixDigitDeleteAttempt.code, 'UNAUTHORIZED_ADMIN');

  const sixDigitChangeCodeAttempt = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_set_approval_code',
      authToken: '482910',
      approvalCode: '999999'
    }) }
  }).getContent());
  assert.equal(sixDigitChangeCodeAttempt.code, 'UNAUTHORIZED_ADMIN');

  // 6. Owner admin can unlock the lesson afterward
  const ownerUnlockAfterSixDigit = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_unlock_entry',
      authToken: adminToken,
      metadataFileId: targetMetaFileId
    }) }
  }).getContent());
  assert.equal(ownerUnlockAfterSixDigit.status, 'success');
  console.log('✓ Six-digit approval number system verified end-to-end.');

  // 12. Auto-Lock After 5 Distinct Verified Listens & Anonymous Deduplication
  console.log('--- Step 12: Testing 5-Listener Auto-Lock & Listener Deduplication ---');
  const autoLockUpload = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'upload_recording',
      authToken: '',
      lessonId: 'word-autolock-01',
      recordingId: 'rec-autolock-01',
      english: 'Auto Lock Test',
      edoSpelling: 'Ebe',
      audioBase64: dummyWavB64,
      mimeType: 'audio/wav'
    }) }
  }).getContent());
  assert.equal(autoLockUpload.status, 'success');
  const autoLockMetaId = autoLockUpload.metadataFileId;

  // Listener 1 plays twice
  const play1 = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'record_playback',
      metadataFileId: autoLockMetaId,
      listenerToken: 'listener-token-uuid-1111'
    }) }
  }).getContent());
  assert.equal(play1.status, 'success');
  assert.equal(play1.playCount, 1);
  assert.equal(play1.distinctListenersCount, 1);
  assert.equal(play1.autoLocked, false);

  const play1Repeat = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'record_playback',
      metadataFileId: autoLockMetaId,
      listenerToken: 'listener-token-uuid-1111'
    }) }
  }).getContent());
  assert.equal(play1Repeat.playCount, 2);
  assert.equal(play1Repeat.distinctListenersCount, 1, 'Duplicate listens from same token must not increment distinct count');
  assert.equal(play1Repeat.autoLocked, false);

  // Listeners 2, 3, 4 play
  for (let i = 2; i <= 4; i++) {
    const playN = JSON.parse(sandbox.doPost({
      postData: { contents: JSON.stringify({
        action: 'record_playback',
        metadataFileId: autoLockMetaId,
        listenerToken: `listener-token-uuid-${i}${i}${i}${i}`
      }) }
    }).getContent());
    assert.equal(playN.distinctListenersCount, i);
    assert.equal(playN.autoLocked, false);
  }

  // Listener 5 plays -> triggers automatic lock!
  const play5 = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'record_playback',
      metadataFileId: autoLockMetaId,
      listenerToken: 'listener-token-uuid-5555'
    }) }
  }).getContent());
  assert.equal(play5.distinctListenersCount, 5);
  assert.equal(play5.autoLocked, false, 'Public listeners cannot approve or lock a lesson');
  assert.equal(play5.reviewStatus, 'pending_approval');
  console.log('✓ 5 distinct listeners verified: entry remains pending administrator approval.');

  // 13. Admin Authoritative Deletion, Tombstone Broadcasting & Curriculum Reopening
  console.log('--- Step 13: Testing Admin Authoritative Deletion & Tombstones ---');
  // Unauthorized deletion attempt with non-admin speaker token
  const unauthDel = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_delete_entry',
      authToken: speakerToken,
      metadataFileId: autoLockMetaId
    }) }
  }).getContent());
  assert.equal(unauthDel.code, 'UNAUTHORIZED_ADMIN');

  // Authorized admin deletion
  const authDel = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({
      action: 'admin_delete_entry',
      authToken: adminToken,
      metadataFileId: autoLockMetaId
    }) }
  }).getContent());
  assert.equal(authDel.status, 'success');
  assert.equal(authDel.tombstoneRecorded, true);

  // Library request confirms deletion and tombstone presence
  const libAfterDel = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ action: 'get_library' }) }
  }).getContent());
  assert(!libAfterDel.items.some(it => it.recordingId === 'rec-autolock-01'), 'Deleted item must be removed from cloud library');
  assert(libAfterDel.tombstones.includes('rec-autolock-01'), 'Tombstone must be broadcast to client devices');
  assert(!libAfterDel.answeredQuestionIds.includes('word-autolock-01'), 'Administrator deletion returns question to available pool when no other contribution answers it');
  console.log('✓ Admin authoritative deletion, tombstones, and question pool return verified.');

  // 14. Shared Google Drive Image Library, Index & Streaming (security-hardened)
  console.log('--- Step 14: Testing Shared Google Drive Image Index & Operations ---');
  const post = (payload) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(payload) } }).getContent());
  const rootFolder = driveApp.getFolderById(TARGET_FOLDER_ID);
  const imagesFolderExists = () => rootFolder.getFoldersByName('Edo Language Studio Images').hasNext();
  const snapshotFiles = () => new Map(Array.from(files.values()).map(f => [f.id, { name: f.name, trashed: f.trashed, bytes: Buffer.from(f.blob.getBytes()).toString('base64') }]));

  // 14a: get_image_index is strictly read-only — creates nothing when the folder is missing
  assert.equal(imagesFolderExists(), false, 'Images folder must not exist before any save');
  const fileCountBeforeIndex = files.size;
  const initialIndexResp = post({ action: 'get_image_index' });
  assert.equal(initialIndexResp.status, 'success');
  assert.equal(typeof initialIndexResp.index.images, 'object');
  assert.equal(Object.keys(initialIndexResp.index.images).length, 0);
  assert.equal(imagesFolderExists(), false, 'get_image_index must never create the Images folder');
  assert.equal(files.size, fileCountBeforeIndex, 'get_image_index must never create files');
  console.log('✓ get_image_index is read-only: no folder or index file created.');

  // 14b: Public direct (base64) uploads are rejected
  const base64Resp = post({ action: 'save_vocabulary_image', english: 'Pig', imageBase64: JPEG_BYTES.toString('base64'), mimeType: 'image/jpeg' });
  assert.equal(base64Resp.status, 'error');
  assert.equal(base64Resp.code, 'UPLOAD_NOT_ALLOWED');
  console.log('✓ Public base64 image upload rejected.');

  // 14c: Non-allow-listed sources are rejected without any network fetch
  const fetchCountBefore = fetchCalls.length;
  for (const badUrl of [
    'https://evil.example.com/pig.jpg',
    'http://upload.wikimedia.org/pig.jpg',
    'https://upload.wikimedia.org.evil.com/pig.jpg',
    'https://user@upload.wikimedia.org/pig.jpg',
    'https://127.0.0.1/pig.jpg',
    'javascript:alert(1)'
  ]) {
    const r = post({ action: 'save_vocabulary_image', english: 'Pig', sourceUrl: badUrl });
    assert.equal(r.status, 'error', 'Must reject ' + badUrl);
    assert.equal(r.code, 'SOURCE_NOT_ALLOWED', 'Must reject ' + badUrl);
  }
  assert.equal(fetchCalls.length, fetchCountBefore, 'Rejected sources must never be fetched');
  assert.equal(imagesFolderExists(), false, 'Rejected saves must not create the Images folder');
  console.log('✓ Non-Wikimedia, plain-http and spoofed hosts rejected without fetching.');

  // 14d: Non-image content and oversized content are rejected
  const htmlUrl = 'https://upload.wikimedia.org/wikipedia/commons/fake_html.jpg';
  fetchResponses.set(htmlUrl, { code: 200, bytes: Buffer.from('<html><body>not an image at all</body></html>') });
  const htmlResp = post({ action: 'save_vocabulary_image', english: 'Cat', sourceUrl: htmlUrl });
  assert.equal(htmlResp.code, 'NOT_AN_IMAGE');
  const bigUrl = 'https://upload.wikimedia.org/wikipedia/commons/huge.jpg';
  fetchResponses.set(bigUrl, { code: 200, bytes: Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(2 * 1024 * 1024)]) });
  const bigResp = post({ action: 'save_vocabulary_image', english: 'Goat', sourceUrl: bigUrl });
  assert.equal(bigResp.code, 'IMAGE_TOO_LARGE');
  assert.equal(imagesFolderExists(), false, 'Invalid content must not create the Images folder');
  console.log('✓ Non-image (fake .jpg) and oversized content rejected; nothing saved.');

  // 14e: Valid Wikimedia JPEG for "Pig" is saved into the Images subfolder only
  const rootFilesBefore = Array.from(files.values()).filter(f => f.parentFolderId === TARGET_FOLDER_ID).length;
  const savePigResp = post({ action: 'save_vocabulary_image', english: 'Pig', category: 'Animals', sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/pig.jpg', mimeType: 'text/html' });
  assert.equal(savePigResp.status, 'success', JSON.stringify(savePigResp));
  assert.equal(savePigResp.duplicate, false);
  assert.equal(savePigResp.entry.normEnglish, 'pig');
  assert.equal(savePigResp.entry.status, 'ready');
  const pigFile = files.get(savePigResp.entry.fileId);
  assert.equal(pigFile.mimeType, 'image/jpeg', 'Stored MIME type comes from magic bytes, not the caller');
  assert.ok(Buffer.from(pigFile.blob.getBytes()).equals(JPEG_BYTES), 'Stored bytes must be the exact binary image');
  const imagesFolder = rootFolder.getFoldersByName('Edo Language Studio Images').next();
  assert.equal(pigFile.parentFolderId, imagesFolder.getId(), 'Image must live in the Images subfolder');
  assert.equal(Array.from(files.values()).filter(f => f.parentFolderId === TARGET_FOLDER_ID).length, rootFilesBefore, 'No files added to the original lesson folder');
  console.log('✓ Valid Wikimedia image for "Pig" saved as exact binary in the Images subfolder only.');

  // 14f: Re-saving returns the existing entry; original bytes untouched; no new files
  const beforeDup = snapshotFiles();
  const dupPigResp = post({ action: 'save_vocabulary_image', english: 'Pig', sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/other_pig.jpg' });
  assert.equal(dupPigResp.status, 'success');
  assert.equal(dupPigResp.duplicate, true);
  assert.equal(dupPigResp.entry.fileId, savePigResp.entry.fileId);
  assert.deepEqual(snapshotFiles(), beforeDup, 'Duplicate save must not modify or create any file');
  console.log('✓ Duplicate save returns existing image; no file created or modified.');

  // 14g: A same-named file not in the index is never overwritten
  const strayBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47]), Buffer.alloc(100, 3)]);
  const strayFile = imagesFolder.createFile(makeBlob(strayBytes, 'image/jpeg', 'image_teeth.jpg'));
  const saveTeethResp = post({ action: 'save_vocabulary_image', english: 'Teeth', category: 'Human Body', sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/teeth.jpg' });
  assert.equal(saveTeethResp.status, 'success', JSON.stringify(saveTeethResp));
  assert.notEqual(saveTeethResp.entry.fileId, strayFile.getId(), 'Must save a new file instead of overwriting');
  assert.ok(Buffer.from(files.get(strayFile.getId()).blob.getBytes()).equals(strayBytes), 'Existing same-named file bytes must be unchanged');
  console.log('✓ Existing same-named file preserved byte-for-byte; new image saved alongside.');

  // 14h: Per-word cooldown blocks repeated attempts for a word that failed
  const failUrl = 'https://upload.wikimedia.org/wikipedia/commons/missing_frog.jpg';
  fetchResponses.set(failUrl, { code: 404, bytes: Buffer.alloc(0) });
  assert.equal(post({ action: 'save_vocabulary_image', english: 'Frog', sourceUrl: failUrl }).code, 'DOWNLOAD_FAILED');
  const fetchesAfterFirstFrog = fetchCalls.length;
  assert.equal(post({ action: 'save_vocabulary_image', english: 'Frog', sourceUrl: failUrl }).code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(fetchCalls.length, fetchesAfterFirstFrog, 'Cooldown must block the fetch');
  console.log('✓ Per-word cooldown prevents repeated download attempts.');

  // 14i: Shared index contains Pig and Teeth for all devices
  const updatedIndexResp = post({ action: 'get_image_index' });
  assert.equal(updatedIndexResp.index.images.pig.status, 'ready');
  assert.equal(updatedIndexResp.index.images.teeth.status, 'ready');
  assert.ok(!updatedIndexResp.index.images.cat && !updatedIndexResp.index.images.frog, 'Failed saves must not appear in the index');
  console.log('✓ Shared image index contains only verified entries.');

  // 14j: stream_image serves vocabulary images only
  const streamResp = post({ action: 'stream_image', fileId: savePigResp.entry.fileId });
  assert.equal(streamResp.status, 'success');
  assert.ok(streamResp.imageDataUrl.startsWith('data:image/jpeg;base64,'));
  const recAudioFile = Array.from(files.values()).find(f => !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && /^audio\//.test(f.mimeType));
  const recMetaFile = Array.from(files.values()).find(f => !f.trashed && f.parentFolderId === TARGET_FOLDER_ID && f.name.endsWith('_meta.json'));
  assert.ok(recAudioFile && recMetaFile, 'Test setup requires an existing recording and metadata file');
  const rootImage = rootFolder.createFile(makeBlob(JPEG_BYTES, 'image/jpeg', 'root_image.jpg'));
  const indexFileObj = imagesFolder.getFilesByName('edo_image_index.json').next();
  for (const [label, id] of [['audio recording', recAudioFile.getId()], ['metadata', recMetaFile.getId()], ['root-folder image', rootImage.getId()], ['image index JSON', indexFileObj.getId()]]) {
    const r = post({ action: 'stream_image', fileId: id });
    assert.equal(r.status, 'error', 'stream_image must refuse ' + label);
    assert.equal(r.code, 'ACCESS_DENIED', 'stream_image must refuse ' + label);
    assert.ok(!r.imageDataUrl, 'No data may be returned for ' + label);
  }
  rootImage.setTrashed(true);
  console.log('✓ stream_image refuses recordings, metadata, root-folder files and the index.');

  // 14k: The original folder check is unchanged: files in the Images subfolder are NOT studio lesson files
  assert.equal(sandbox.isFileInStudioFolder(pigFile), false, 'Images subfolder files must not pass the lesson-folder check');
  assert.equal(sandbox.isFileInStudioFolder(recAudioFile), true, 'Recordings must still pass the lesson-folder check');
  console.log('✓ Lesson-folder security check restored to direct children only.');

  // Test doGet health check (tokens are never accepted in GET URLs)
  const healthGet = JSON.parse(sandbox.doGet({}).getContent());
  assert.equal(healthGet.status, 'ok');
  assert.equal(healthGet.folderConnected, true);
  console.log('✓ Health check GET verified (tokens strictly confined to secure POST bodies).');

  console.log('\n=== ALL AUTOMATED TESTS ON gas/Code.gs PASSED! ===');
}

runTests();
