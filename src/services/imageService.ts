import verifiedSubjects from '../data/vocabularyPictureSubjects.json';
import starterVocabularyData from '../data/englishVocabulary.json';
import placeholderAssetList from '../data/placeholderImages.json';
import { readLibrarySnapshot, writeLibrarySnapshot } from './localLibraryStore';
import {
  fetchCloudImageIndex,
  saveCloudVocabularyImage,
  CloudImageEntry,
  CloudImageIndex
} from './cloudSyncService';
/**
 * Curated Vocabulary Image Service
 * Provides authentic, high-quality, properly licensed photographs and illustrations
 * for Edo Language Studio vocabulary.
 *
 * All static starter images are stored locally with the app in public/assets/vocabulary/
 * and work 100% offline without live Google Search or Drive dependencies.
 */

import { normalizeEnglish } from './vocabularyService';

export type ImageStatus = 'ready' | 'missing' | 'downloading' | 'failed';

export interface ImageAttribution {
  provider: 'unsplash' | 'wikimedia' | 'curated_studio';
  license: string;
  photographer?: string;
  sourceUrl?: string;
}

// Map from normalized English text or ID to the curated asset filename
const CURATED_IMAGE_FILENAMES: Record<string, string> = {
  // Body
  'hand': 'word-hand.jpg',
  'hands': 'word-hand.jpg',
  'eye': 'word-eye.jpg',
  'eyes': 'word-eye.jpg',
  'head': 'body-head.jpg',
  'ear': 'body-ear.jpg',
  'ears': 'body-ear.jpg',
  'nose': 'body-nose.jpg',
  'mouth': 'body-mouth.jpg',
  'foot': 'body-foot.jpg',
  'feet': 'body-foot.jpg',
  'leg': 'body-leg.jpg',
  'legs': 'body-leg.jpg',
  'arm': 'body-arm.jpg',
  'arms': 'body-arm.jpg',
  'heart': 'body-heart.jpg',
  'teeth': 'body-teeth.jpg',
  'tooth': 'body-teeth.jpg',
  'tongue': 'body-tongue.jpg',
  'knee': 'body-knee.jpg',
  'knees': 'body-knee.jpg',
  'finger': 'body-finger.jpg',
  'fingers': 'body-finger.jpg',
  'toe': 'body-toe.jpg',
  'toes': 'body-toe.jpg',
  'bone': 'body-bone.jpg',
  'bones': 'body-bone.jpg',
  'blood': 'body-blood.jpg',

  // Movement
  'go': 'move-go.jpg',
  'come': 'move-come.jpg',
  'where are you going': 'sentence-going.jpg',
  'i am coming': 'sentence-coming.jpg',
  'walk': 'move-walk.jpg',
  'run': 'move-run.jpg',
  'stop': 'move-stop.jpg',
  'enter': 'move-enter.jpg',
  'leave': 'move-leave.jpg',
  'return': 'move-return.jpg',
  'sit': 'move-sit.jpg',
  'stand': 'move-stand.jpg',
  'climb': 'move-climb.jpg',
  'fall': 'move-fall.jpg',

  // Transport
  'bus': 'transport-bus.jpg',
  'car': 'transport-car.jpg',
  'bicycle': 'transport-bicycle.jpg',
  'train': 'transport-train.jpg',
  'airplane': 'transport-airplane.jpg',
  'boat': 'transport-boat.jpg',
  'road': 'transport-road.jpg',
  'driver': 'transport-driver.jpg',
  'truck': 'transport-truck.jpg',
  'journey': 'transport-journey.jpg',

  // Home & Household
  'house': 'word-house.jpg',
  'home': 'word-house.jpg',
  'door': 'home-door.jpg',
  'window': 'home-window.jpg',
  'room': 'home-room.jpg',
  'bed': 'home-bed.jpg',
  'chair': 'home-chair.jpg',
  'table': 'home-table.jpg',
  'kitchen': 'home-kitchen.jpg',
  'roof': 'home-roof.jpg',
  'floor': 'home-floor.jpg',
  'key': 'home-key.jpg',
  'lamp': 'home-lamp.jpg',
  'cup': 'home-cup.jpg',
  'cups': 'home-cup.jpg',

  // Family & People
  'mother': 'family-mother.jpg',
  'nursing mother': 'family-nursing-mother.jpg',
  'father': 'family-father.jpg',
  'child': 'word-child.jpg',
  'children': 'word-child.jpg',
  'baby': 'family-baby.jpg',
  'brother': 'family-brother.jpg',
  'sister': 'family-sister.jpg',
  'grandmother': 'family-grandmother.jpg',
  'grandfather': 'family-grandfather.jpg',
  'friend': 'family-friend.jpg',
  'friends': 'family-friend.jpg',
  'family': 'family-family.jpg',

  // Food
  'food': 'word-food.jpg',
  'water': 'word-water.jpg',
  'rice': 'food-rice.jpg',
  'bread': 'food-bread.jpg',
  'meat': 'food-meat.jpg',
  'fish': 'food-fish.jpg',
  'soup': 'food-soup.jpg',
  'fruit': 'food-fruit.jpg',
  'fruits': 'food-fruit.jpg',
  'vegetables': 'food-vegetables.jpg',
  'yam': 'food-yam.jpg',
  'salt': 'food-salt.jpg',
  'oil': 'food-oil.jpg',
  'pepper': 'food-pepper.jpg',
  'egg': 'food-egg.jpg',
  'eggs': 'food-egg.jpg',
  'banana': 'food-banana.jpg',
  'bananas': 'food-banana.jpg',

  // Actions
  'eat': 'action-eat.jpg',
  'drink': 'action-drink.jpg',
  'sleep': 'action-sleep.jpg',
  'talk': 'action-talk.jpg',
  'listen': 'action-listen.jpg',
  'speak': 'action-speak.jpg',
  'read': 'action-read.jpg',
  'write': 'action-write.jpg',
  'work': 'action-work.jpg',
  'sing': 'action-sing.jpg',
  'dance': 'action-dance.jpg',
  'laugh': 'action-laugh.jpg',
  'buy': 'action-buy.jpg',
  'sell': 'action-sell.jpg',
  'cook': 'action-cook.jpg',
  'wash': 'action-wash.jpg',

  // Places
  'school': 'place-school.jpg',
  'church': 'place-church.jpg',
  'hospital': 'place-hospital.jpg',
  'market': 'place-market.jpg',
  'shop': 'place-shop.jpg',
  'office': 'place-office.jpg',
  'farm': 'place-farm.jpg',
  'town': 'place-town.jpg',
  'village': 'place-village.jpg',

  // Nature & Spiritual
  'god': 'spiritual-god.jpg',
  'tree': 'word-tree.jpg',
  'trees': 'word-tree.jpg',
  'sun': 'word-sun.jpg',
  'rain': 'nature-rain.jpg',
  'river': 'nature-river.jpg',
  'sky': 'nature-sky.jpg',
  'earth': 'nature-earth.jpg',
  'fire': 'nature-fire.jpg',
  'wind': 'nature-wind.jpg',
  'moon': 'nature-moon.jpg',
  'star': 'nature-star.jpg',
  'stars': 'nature-star.jpg',
  'stone': 'nature-stone.jpg',
  'mountain': 'nature-mountain.jpg',

  // Daily expressions & Animals & Objects
  'good morning': 'phrase-good-morning.jpg',
  'good afternoon': 'phrase-good-afternoon.jpg',
  'good evening': 'phrase-good-evening.jpg',
  'thank you': 'phrase-thank-you.jpg',
  'please': 'phrase-please.jpg',
  'welcome': 'phrase-welcome.jpg',
  'come here': 'phrase-come-here.jpg',
  'what is your name': 'sentence-your-name.jpg',
  'how are you': 'phrase-how-are-you.jpg',
  'yes': 'phrase-yes.jpg',
  'no': 'phrase-no.jpg',
  'goodbye': 'phrase-goodbye.jpg',
  'book': 'word-book.jpg',
  'books': 'word-book.jpg',
  'money': 'tool-money.jpg',
  'dog': 'animal-dog.jpg',
  'dogs': 'animal-dog.jpg',
  'cat': 'animal-cat.jpg',
  'cats': 'animal-cat.jpg',
  'bird': 'animal-bird.jpg',
  'birds': 'animal-bird.jpg',
  'goat': 'animal-goat.jpg',
  'goats': 'animal-goat.jpg',
  'shirt': 'clothes-shirt.jpg',
  'shoes': 'clothes-shoes.jpg',
  'today': 'time-today.jpg',
  'tomorrow': 'time-tomorrow.jpg',
  'night': 'time-night.jpg'
};

// Ensure all starter vocabulary items map to their curated image asset
for (const item of (starterVocabularyData as Array<{ id: string; english: string }>)) {
  const norm = normalizeEnglish(item.english);
  if (norm && !CURATED_IMAGE_FILENAMES[norm]) {
    CURATED_IMAGE_FILENAMES[norm] = `${item.id}.jpg`;
  }
}

const ONLINE_IMAGES_CACHE_KEY = 'edo_online_vocabulary_images_v1';

// In-memory image registry and state
const inMemoryCache = new Map<string, string>();
const sharedCloudIndex = new Map<string, CloudImageEntry>();
const failedSearches = new Set<string>();
const discoveryQueue: { english: string; category?: string; id?: string }[] = [];
const queuedWords = new Set<string>();
const activeSearches = new Set<string>();
const imageListeners = new Set<(wordNorm: string, url: string, status?: ImageStatus) => void>();
let activeFetchCount = 0;
const MAX_CONCURRENT_SEARCHES = 2;
let throttleTimer: number | null = null;

/**
 * Bundled asset files that are generated text cards rather than real pictures.
 * They are still displayed as a fallback, but their status is 'missing' so they can be repaired.
 */
const PLACEHOLDER_ASSET_FILES = new Set<string>(placeholderAssetList as string[]);

function isPlaceholderAssetForWord(norm: string): boolean {
  const filename = CURATED_IMAGE_FILENAMES[norm];
  return Boolean(filename && PLACEHOLDER_ASSET_FILES.has(filename));
}

/**
 * Read-only mode (Children's Library): no discovery, no retries, no Google Drive saves,
 * no local snapshot writes. Once enabled it stays enabled for the page lifetime.
 */
let imageServiceReadOnly = false;
export function setImageServiceReadOnly(readOnly: boolean): void {
  if (readOnly) imageServiceReadOnly = true;
}
export function isImageServiceReadOnly(): boolean {
  return imageServiceReadOnly;
}

/**
 * Returns the base URL for static assets respecting Vite's base path.
 */
function getBaseUrl(): string {
  try {
    return import.meta.env?.BASE_URL || '/';
  } catch (_) {
    return '/';
  }
}

/**
 * Subscribes to real-time background image updates.
 */
export function subscribeImageUpdates(
  callback: (wordNorm: string, url: string, status?: ImageStatus) => void
): () => void {
  imageListeners.add(callback);
  return () => {
    imageListeners.delete(callback);
  };
}

function notifyImageListeners(wordNorm: string, url: string, status?: ImageStatus): void {
  for (const listener of imageListeners) {
    try {
      listener(wordNorm, url, status);
    } catch {
      // Ignore listener error
    }
  }
}

type ImageParams = {
  id?: string;
  english?: string;
  illustrationKey?: string;
  imageUrl?: string;
  skipLocalCache?: boolean;
};

/**
 * Resolves the best picture for a word and reports whether it is only a placeholder card.
 * Real images (explicit URL, verified subject, real bundled photo, shared Drive index, cached
 * discovery) always win over a placeholder card, which is kept only as a display fallback.
 */
function resolveImage(params: ImageParams): { url: string; isPlaceholder: boolean } {
  const norm = normalizeEnglish(params.english || '');
  if (norm === 'yam') return { url: '', isPlaceholder: false };

  // 1. Explicit image URL already provided
  if (params.imageUrl && params.imageUrl.trim()) {
    return { url: params.imageUrl, isPlaceholder: false };
  }

  const baseUrl = getBaseUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  let placeholderFallback = '';

  // Returns the asset URL for a real photo, or records a placeholder as fallback and returns ''.
  const bundled = (filename: string | undefined): string => {
    if (!filename) return '';
    const url = `${cleanBase}assets/vocabulary/${filename}`;
    if (PLACEHOLDER_ASSET_FILES.has(filename)) {
      if (!placeholderFallback) placeholderFallback = url;
      return '';
    }
    return url;
  };

  // Priority 1: For Human Body lessons, verified human anatomy images have absolute priority
  // over generic illustrations, cartoon drawings, and online search results.
  const isBodySubject = [
    'hand', 'hands', 'eye', 'eyes', 'head', 'ear', 'ears', 'nose', 'mouth',
    'foot', 'feet', 'leg', 'legs', 'arm', 'arms', 'heart', 'teeth', 'tooth',
    'tongue', 'knee', 'knees', 'finger', 'fingers', 'toe', 'toes', 'bone',
    'bones', 'blood', 'neck', 'hair', 'shoulder', 'stomach', 'chest', 'back', 'skin'
  ].includes(norm);

  if (isBodySubject) {
    const bodyPhoto = bundled(CURATED_IMAGE_FILENAMES[norm]);
    if (bodyPhoto) return { url: bodyPhoto, isPlaceholder: false };
    if (params.id) {
      const real = bundled(`${params.id}.jpg`);
      if (real) return { url: real, isPlaceholder: false };
    }
  }

  // Priority 2: Verified subject illustration (for audited non-body vocabulary items)
  const subjectAsset = (verifiedSubjects as Record<string, string>)[norm];
  if (subjectAsset) {
    return { url: `${cleanBase}assets/vocabulary/verified/${subjectAsset}.svg`, isPlaceholder: false };
  }

  // 3. Match by normalized English text
  if (params.english) {
    const norm = normalizeEnglish(params.english);

    // In-memory cache check (0ms immediate return)
    if (inMemoryCache.has(norm)) {
      return { url: inMemoryCache.get(norm)!, isPlaceholder: false };
    }

    // Shared Google Drive image index check
    const cloudEntry = sharedCloudIndex.get(norm);
    if (cloudEntry && cloudEntry.status === 'ready' && cloudEntry.url) {
      inMemoryCache.set(norm, cloudEntry.url);
      return { url: cloudEntry.url, isPlaceholder: false };
    }

    // Direct curated dictionary lookup
    const direct = bundled(CURATED_IMAGE_FILENAMES[norm]);
    if (direct) return { url: direct, isPlaceholder: false };

    // Singular form heuristics (e.g. "birds" -> "bird", "dogs" -> "dog", "cups" -> "cup")
    let sing = '';
    if (norm.endsWith('ies') && norm.length > 3) sing = norm.slice(0, -3) + 'y';
    else if (norm.endsWith('es') && norm.length > 2) sing = norm.slice(0, -2);
    else if (norm.endsWith('s') && norm.length > 1) sing = norm.slice(0, -1);
    if (sing) {
      const singular = bundled(CURATED_IMAGE_FILENAMES[sing]);
      if (singular) return { url: singular, isPlaceholder: false };
    }

    // Check persistent storage for dynamically discovered images
    try {
      if (!params.skipLocalCache && typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(ONLINE_IMAGES_CACHE_KEY);
        if (cached) {
          const map = JSON.parse(cached);
          if (typeof map[norm] === 'string' && /^https:\/\//.test(map[norm])) {
            inMemoryCache.set(norm, map[norm]);
            return { url: map[norm], isPlaceholder: false };
          }
        }
      }
    } catch (_) { }
  }

  // 4. Match by illustrationKey
  if (params.illustrationKey) {
    const byKey = bundled(CURATED_IMAGE_FILENAMES[normalizeEnglish(params.illustrationKey)]);
    if (byKey) return { url: byKey, isPlaceholder: false };
  }

  return { url: placeholderFallback, isPlaceholder: Boolean(placeholderFallback) };
}

/** True only when a real (non-placeholder) picture is available for the word. */
function hasRealImage(params: ImageParams): boolean {
  const resolved = resolveImage(params);
  return Boolean(resolved.url) && !resolved.isPlaceholder;
}

/**
 * Evaluates the authoritative image status: 'ready' | 'missing' | 'downloading' | 'failed'.
 * Placeholder text cards are never reported as 'ready'.
 */
export function getImageStatus(params: ImageParams): ImageStatus {
  const norm = normalizeEnglish(params.english || params.id || '');
  if (!norm) return 'missing';
  if (activeSearches.has(norm)) return 'downloading';
  if (hasRealImage(params)) return 'ready';
  if (failedSearches.has(norm)) return 'failed';
  return 'missing';
}

/**
 * Resolves the picture URL for an English word, id, or illustrationKey.
 * May return a placeholder card as a display fallback; use getImageStatus for readiness.
 */
export function getVocabularyImageUrl(params: ImageParams): string {
  return resolveImage(params).url;
}

/**
 * Moves on-screen visible words to the front of the image discovery queue.
 */
export function prioritizeImageDiscovery(englishWords: string[]): void {
  if (imageServiceReadOnly) return;
  if (!englishWords || englishWords.length === 0) return;
  const toMove: { english: string; category?: string; id?: string }[] = [];

  for (const word of englishWords) {
    const norm = normalizeEnglish(word);
    if (!norm || hasRealImage({ english: word }) || failedSearches.has(norm)) continue;
    const idx = discoveryQueue.findIndex(item => normalizeEnglish(item.english) === norm);
    if (idx !== -1) {
      toMove.push(discoveryQueue.splice(idx, 1)[0]);
    } else if (!queuedWords.has(norm)) {
      queuedWords.add(norm);
      toMove.push({ english: word });
    }
  }

  if (toMove.length > 0) {
    discoveryQueue.unshift(...toMove);
    processImageDiscoveryQueue();
  }
}

/**
 * Enqueues an English vocabulary word for quiet background image discovery.
 */
export function enqueueImageDiscovery(english: string, category?: string, id?: string): void {
  if (imageServiceReadOnly) return;
  const norm = normalizeEnglish(english);
  if (!norm) return;
  if (hasRealImage({ english, id })) return;
  if (failedSearches.has(norm) || queuedWords.has(norm) || activeSearches.has(norm)) return;

  queuedWords.add(norm);
  discoveryQueue.push({ english, category, id });
  processImageDiscoveryQueue();
}

/**
 * Background worker to fetch missing images quietly with limited concurrency (max 2 parallel).
 */
function processImageDiscoveryQueue(): void {
  if (imageServiceReadOnly) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  while (activeFetchCount < MAX_CONCURRENT_SEARCHES && discoveryQueue.length > 0) {
    const item = discoveryQueue.shift();
    if (!item) break;
    const norm = normalizeEnglish(item.english);
    queuedWords.delete(norm);

    // If already resolved or failed, skip
    if (hasRealImage({ english: item.english, id: item.id }) || failedSearches.has(norm)) {
      continue;
    }

    activeFetchCount++;
    activeSearches.add(norm);

    void (async () => {
      try {
        const url = await discoverOnlineVocabularyImage(item.english, item.category, item.id);
        if (url) {
          inMemoryCache.set(norm, url);
          notifyImageListeners(norm, url, 'ready');
        } else {
          failedSearches.add(norm);
          notifyImageListeners(norm, '', 'failed');
        }
      } catch {
        failedSearches.add(norm);
        notifyImageListeners(norm, '', 'failed');
      } finally {
        activeSearches.delete(norm);
        activeFetchCount--;

        if (!throttleTimer) {
          throttleTimer = window.setTimeout(() => {
            throttleTimer = null;
            processImageDiscoveryQueue();
          }, 200);
        }
      }
    })();
  }
}

/**
 * Discovers and caches a licensed picture for dynamically discovered online vocabulary.
 * Uses Wikimedia Commons API (CC0 / CC-BY, free, CORS-enabled, no API key).
 */
export async function discoverOnlineVocabularyImage(englishWord: string, category?: string, id?: string): Promise<string | null> {
  const norm = normalizeEnglish(englishWord);
  if (!norm || norm === 'yam') return null;
  if (imageServiceReadOnly) return null;

  // Check if we already have a real (non-placeholder) picture
  const resolved = resolveImage({ english: englishWord, id });
  if (resolved.url && !resolved.isPlaceholder) return resolved.url;

  // Check in-memory cache
  if (inMemoryCache.has(norm)) return inMemoryCache.get(norm)!;

  // Check shared cloud index
  const cloud = sharedCloudIndex.get(norm);
  if (cloud && cloud.status === 'ready' && cloud.url) {
    inMemoryCache.set(norm, cloud.url);
    return cloud.url;
  }

  // Check cached dynamic images in localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(ONLINE_IMAGES_CACHE_KEY);
      if (cached) {
        const map = JSON.parse(cached);
        if (map[norm]) {
          inMemoryCache.set(norm, map[norm]);
          return map[norm];
        }
      }
    }
  } catch (_) { }

  // Check persistent storage snapshot
  try {
    const stored = await readLibrarySnapshot('edo_vocabulary_image_' + norm);
    if (stored && typeof stored === 'string' && stored.startsWith('http')) {
      inMemoryCache.set(norm, stored);
      return stored;
    }
  } catch (_) { }

  // Context-aware search term for ambiguous words: Human Body words must always be qualified with "Human"
  let searchTerm = englishWord.trim();
  const isBodyWord = category === 'Body' || [
    'head', 'nose', 'hand', 'ear', 'mouth', 'foot', 'leg', 'arm', 'heart', 'body',
    'face', 'tooth', 'teeth', 'hair', 'neck', 'belly', 'chest', 'knee', 'bone', 'skin',
    'blood', 'stomach', 'back', 'finger', 'toe', 'tongue', 'shoulder'
  ].includes(norm);

  if (isBodyWord) {
    searchTerm = 'Human ' + englishWord.trim();
  } else if (category && category !== 'Other' && category !== 'Words' && category !== 'Phrases') {
    if (norm === 'cup') searchTerm = 'Coffee cup';
    else if (norm === 'god') searchTerm = 'Sunrise sunlight';
    else if (norm === 'nursing mother') searchTerm = 'Breastfeeding infant';
  }

  // Animal disqualifier list to prevent animal pictures (e.g. chimpanzee teeth, elephant skin) from appearing in Human Body
  const isAnimalMedia = (urlOrTitle: string): boolean => {
    const lower = urlOrTitle.toLowerCase();
    return [
      'chimpanzee', 'chimp', 'monkey', 'kangaroo', 'elephant', 'ape', 'gorilla',
      'primate', 'macaca', 'pan_troglodytes', 'canis', 'felis', 'horse', 'cow',
      'pig', 'lion', 'tiger', 'bear', 'wolf', 'shark', 'animal'
    ].some(animal => lower.includes(animal));
  };

  // Fetch from Wikimedia Commons PageImages API (properly licensed CC0 / CC-BY, CORS enabled)
  try {
    const endpoint = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      searchTerm
    )}&prop=pageimages&format=json&pithumbsize=500&origin=*`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        const firstPageKey = Object.keys(pages)[0];
        const pageObj = pages[firstPageKey];
        const thumbnail = pageObj?.thumbnail?.source;
        const pageTitle = pageObj?.title || '';
        if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http')) {
          if (isBodyWord && (isAnimalMedia(thumbnail) || isAnimalMedia(pageTitle))) {
            // Strictly reject animal pictures for Human Body words
            return null;
          }
          void saveDiscoveredImage(norm, thumbnail, englishWord, category, id);
          return thumbnail;
        }
      }
    }

    // Fallback search with generator query if exact title did not match
    const searchEndpoint = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      searchTerm
    )}&gsrlimit=1&prop=pageimages&pithumbsize=500&format=json&origin=*`;

    const searchController = new AbortController();
    const searchTimer = setTimeout(() => searchController.abort(), 6000);
    const searchRes = await fetch(searchEndpoint, { signal: searchController.signal });
    clearTimeout(searchTimer);

    if (searchRes.ok) {
      const sData = await searchRes.json();
      const sPages = sData?.query?.pages;
      if (sPages) {
        const first = Object.values(sPages)[0] as { title?: string; thumbnail?: { source?: string } } | undefined;
        const sThumbnail = first?.thumbnail?.source;
        const sTitle = first?.title || '';
        if (sThumbnail && typeof sThumbnail === 'string' && sThumbnail.startsWith('http')) {
          if (isBodyWord && (isAnimalMedia(sThumbnail) || isAnimalMedia(sTitle))) {
            // Strictly reject animal pictures for Human Body words
            return null;
          }
          void saveDiscoveredImage(norm, sThumbnail, englishWord, category, id);
          return sThumbnail;
        }
      }
    }
  } catch {
    // Fail silently without disrupting user
  }

  return null;
}

async function saveDiscoveredImage(
  norm: string,
  url: string,
  english?: string,
  category?: string,
  vocabId?: string
): Promise<void> {
  if (imageServiceReadOnly) return;
  inMemoryCache.set(norm, url);
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(ONLINE_IMAGES_CACHE_KEY);
      const map = cached ? JSON.parse(cached) : {};
      map[norm] = url;
      localStorage.setItem(ONLINE_IMAGES_CACHE_KEY, JSON.stringify(map));
    }
  } catch (_) { }
  void writeLibrarySnapshot('edo_vocabulary_image_' + norm, url).catch(() => { });

  // Persist to shared Google Drive folder and update shared index in background
  // Only licensed Wikimedia images are sent; the backend enforces the same allow-list.
  const isWikimediaSource = /^https:\/\/upload\.wikimedia\.org\//.test(url);
  if (english && isWikimediaSource && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const cloudResp = await saveCloudVocabularyImage({
        english,
        category,
        vocabId,
        sourceUrl: url
      });
      if (cloudResp.ok && cloudResp.entry && isTrustedImageUrl(cloudResp.entry.url)) {
        sharedCloudIndex.set(norm, cloudResp.entry);
        if (cloudResp.entry.url) {
          inMemoryCache.set(norm, cloudResp.entry.url);
          notifyImageListeners(norm, cloudResp.entry.url, 'ready');
        }
      }
    } catch (_) { }
  }
}

/**
 * Accepts only image URLs produced by the shared Drive index or Wikimedia.
 * Protects the UI from a malformed or tampered index entry.
 */
function isTrustedImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  return /^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]+(&sz=w\d+)?$/.test(url)
    || /^https:\/\/upload\.wikimedia\.org\/[^\s"'<>]+$/.test(url);
}

function applyIndexEntries(index: CloudImageIndex | null | undefined, notify: boolean): void {
  if (!index || typeof index !== 'object' || !index.images || typeof index.images !== 'object') return;
  for (const [norm, entry] of Object.entries(index.images)) {
    if (!entry || entry.status !== 'ready' || !isTrustedImageUrl(entry.url)) continue;
    // Never replace a working bundled photo with a cloud copy
    if (CURATED_IMAGE_FILENAMES[norm] && !isPlaceholderAssetForWord(norm)) continue;
    sharedCloudIndex.set(norm, entry);
    inMemoryCache.set(norm, entry.url);
    if (notify) notifyImageListeners(norm, entry.url, 'ready');
  }
}

/**
 * Loads the shared Google Drive image index and warms in-memory caches.
 * Read-only mode (Children's Library): reads only — no local snapshot writes,
 * no discovery and no Google Drive saves.
 */
export async function syncSharedImageIndex(readOnly = false): Promise<void> {
  if (readOnly) setImageServiceReadOnly(true);
  const writesAllowed = !readOnly && !imageServiceReadOnly;

  // 1. Local snapshot first for instant display (Studio only)
  if (writesAllowed) {
    try {
      const cachedRaw = await readLibrarySnapshot('edo_image_index_v1');
      if (cachedRaw && typeof cachedRaw === 'string') {
        try {
          applyIndexEntries(JSON.parse(cachedRaw) as CloudImageIndex, false);
        } catch (_) {
          // Corrupt snapshot is ignored; the cloud index below is authoritative
        }
      }
    } catch (_) { }
  }

  // 2. Authoritative shared index from Google Drive
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const res = await fetchCloudImageIndex();
    if (res.ok && res.index && res.index.images) {
      applyIndexEntries(res.index, true);
      if (writesAllowed) {
        void writeLibrarySnapshot('edo_image_index_v1', JSON.stringify(res.index)).catch(() => { });
      }
    }
  } catch (_) { }
}

/**
 * Manually retries image discovery and repair for a single lesson.
 * Clears failed state, searches, validates, persists to Google Drive, and updates shared index.
 */
export async function retryImageDownload(english: string, category?: string, id?: string): Promise<string | null> {
  if (imageServiceReadOnly) return null;
  const norm = normalizeEnglish(english);
  if (!norm || norm === 'yam') return null;
  if (activeSearches.has(norm)) return null;

  failedSearches.delete(norm);
  activeSearches.add(norm);
  notifyImageListeners(norm, '', 'downloading');

  try {
    const discovered = await discoverOnlineVocabularyImage(english, category, id);
    activeSearches.delete(norm);
    if (discovered) {
      inMemoryCache.set(norm, discovered);
      notifyImageListeners(norm, discovered, 'ready');
      return discovered;
    } else {
      failedSearches.add(norm);
      notifyImageListeners(norm, '', 'failed');
      return null;
    }
  } catch {
    activeSearches.delete(norm);
    failedSearches.add(norm);
    notifyImageListeners(norm, '', 'failed');
    return null;
  }
}
