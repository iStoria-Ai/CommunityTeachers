import { Preferences } from '@capacitor/preferences';
import { CommunitySnapshot, getCommunityCacheKey } from './communityLibrary';
import { deleteLibrarySnapshot, listLibrarySnapshotKeys, writeLibrarySnapshot } from './localLibraryStore';
import { loadLibrary } from './storageService';
import { getPersistentUploadQueue, savePersistentUploadQueue } from './cloudSyncService';
import { getActiveLanguage } from '../languages';

export function getOneTimeResetKey(): string {
  return `${getActiveLanguage().storagePrefix}_library_reset_v3`;
}

export const ONE_TIME_RESET_KEY = 'edo_library_reset_v3';

export async function isLibraryResetCompleted(): Promise<boolean> {
  const key = getOneTimeResetKey();
  try {
    let completed =
      (typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'completed') ||
      (await Preferences.get({ key })).value === 'completed';
    // Backward compatibility for Edo
    if (!completed && getActiveLanguage().id === 'edo') {
      completed =
        (typeof localStorage !== 'undefined' && localStorage.getItem('edo_library_reset_v3') === 'completed') ||
        (await Preferences.get({ key: 'edo_library_reset_v3' })).value === 'completed';
    }
    return completed;
  } catch {
    return false;
  }
}

/** Reconcile only disposable cloud caches. Never rewrite recordings, consent, pending work, or answered history. */
export async function reconcileLocalLibraryWithCloud(snapshot: CommunitySnapshot): Promise<void> {
  if (!snapshot || !Array.isArray(snapshot.entries) || !Array.isArray(snapshot.answeredQuestionIds) || !Number.isFinite(Date.parse(snapshot.checkedAt))) throw new Error('A successful authoritative cloud response is required.');
  const activeAudio = new Set(snapshot.entries.map(entry => entry.cloudAudioFileId).filter(Boolean));
  const activeRecordings = new Set(snapshot.entries.map(entry => entry.recordingId).filter(Boolean));
  const local = await loadLibrary();
  const tombstones = new Set(snapshot.tombstones || []);
  const queue = getPersistentUploadQueue();
  const reconciled = queue.filter(item => {
    const entry = local.entries.find(record => record.id === item.lessonId);
    // Only confirmed uploads or explicitly tombstoned previously uploaded records leave the queue.
    if (entry?.recordingId && activeRecordings.has(entry.recordingId)) return false;
    if (entry?.cloudMetadataFileId && (tombstones.has(entry.cloudMetadataFileId) || Boolean(entry.recordingId && tombstones.has(entry.recordingId)))) return false;
    return true;
  });
  if (reconciled.length !== queue.length) savePersistentUploadQueue(reconciled);
  const audioPrefix = `${getActiveLanguage().storagePrefix}_community_audio_`;
  for (const key of await listLibrarySnapshotKeys()) {
    if (key.startsWith(audioPrefix) && !activeAudio.has(key.slice(audioPrefix.length))) {
      await deleteLibrarySnapshot(key);
    } else if (getActiveLanguage().id === 'edo' && key.startsWith('edo_community_audio_') && !activeAudio.has(key.slice('edo_community_audio_'.length))) {
      await deleteLibrarySnapshot(key);
    }
  }
}

export async function executeOneTimeLibraryReset(snapshot: CommunitySnapshot): Promise<void> {
  await reconcileLocalLibraryWithCloud(snapshot);
  const cacheKey = getCommunityCacheKey();
  await writeLibrarySnapshot(cacheKey, JSON.stringify(snapshot));
  const resetKey = getOneTimeResetKey();
  // Keep the legacy protected snapshot as recovery. Only obsolete public cache keys are removed.
  if (typeof localStorage !== 'undefined') {
    if (getActiveLanguage().id === 'edo') {
      localStorage.removeItem('edo_public_library_cache_v0');
      localStorage.setItem('edo_library_reset_v3', 'completed');
    }
    localStorage.setItem(resetKey, 'completed');
  }
  await Preferences.set({ key: resetKey, value: 'completed' });
}
