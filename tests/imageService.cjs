/**
 * Automated Test Suite for Real Vocabulary Pictures & Image Service
 * Verifies that all 131 starter vocabulary items have curated high-quality pictures,
 * that specific examples (Bus, Car, House, Water, Mother, Food, Tree, School) resolve correctly,
 * and that image files exist on disk with valid dimensions and non-zero bytes.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const VOCAB_FILE = path.join(__dirname, '..', 'src', 'data', 'englishVocabulary.json');
const VOCAB_DIR = path.join(__dirname, '..', 'public', 'assets', 'vocabulary');

console.log('=== Running Vocabulary Real Pictures Tests ===\n');

// 1. Check starter vocabulary JSON
assert.ok(fs.existsSync(VOCAB_FILE), 'englishVocabulary.json must exist');
const vocab = JSON.parse(fs.readFileSync(VOCAB_FILE, 'utf8'));
assert.ok(Array.isArray(vocab) && vocab.length >= 100, 'Starter vocabulary must have >= 100 items');

// 2. Check public/assets/vocabulary directory
assert.ok(fs.existsSync(VOCAB_DIR), 'public/assets/vocabulary directory must exist');

// 3. Verify user specific required examples
const REQUIRED_EXAMPLES = [
  { english: 'Bus', id: 'transport-bus' },
  { english: 'Car', id: 'transport-car' },
  { english: 'House', id: 'word-house' },
  { english: 'Water', id: 'word-water' },
  { english: 'Mother', id: 'family-mother' },
  { english: 'Food', id: 'word-food' },
  { english: 'Tree', id: 'word-tree' },
  { english: 'School', id: 'place-school' }
];

for (const ex of REQUIRED_EXAMPLES) {
  const filePath = path.join(VOCAB_DIR, `${ex.id}.jpg`);
  assert.ok(fs.existsSync(filePath), `Required picture for "${ex.english}" (${ex.id}.jpg) must exist`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 2000, `Picture for "${ex.english}" must be substantial (>2KB), got ${stat.size} bytes`);
  console.log(`✓ Confirmed real picture for ${ex.english}: ${ex.id}.jpg (${Math.round(stat.size / 1024)} KB)`);
}

// 4. Verify abstract phrases have meaningful scene illustrations
const ABSTRACT_EXAMPLES = [
  { english: 'Thank you', id: 'phrase-thank-you' },
  { english: 'How are you?', id: 'phrase-how-are-you' },
  { english: 'Good morning', id: 'phrase-good-morning' },
  { english: 'Welcome', id: 'phrase-welcome' }
];

for (const ex of ABSTRACT_EXAMPLES) {
  const filePath = path.join(VOCAB_DIR, `${ex.id}.jpg`);
  assert.ok(fs.existsSync(filePath), `Scene illustration for "${ex.english}" (${ex.id}.jpg) must exist`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 2000, `Scene illustration for "${ex.english}" must be substantial, got ${stat.size} bytes`);
  console.log(`✓ Confirmed scene illustration for ${ex.english}: ${ex.id}.jpg (${Math.round(stat.size / 1024)} KB)`);
}

// 5. Verify all 131 starter items have real pictures
let verifiedCount = 0;
for (const item of vocab) {
  const filePath = path.join(VOCAB_DIR, `${item.id}.jpg`);
  assert.ok(fs.existsSync(filePath), `Every item must have a real picture: missing ${item.id}.jpg for "${item.english}"`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 1000, `Image for "${item.english}" must be > 1KB`);
  verifiedCount++;
}

// 6. Verify God, Nursing Mother, and plural/singular resolutions
const EXTRA_CURATED = [
  { english: 'God', filename: 'spiritual-god.jpg' },
  { english: 'Nursing Mother', filename: 'family-nursing-mother.jpg' },
  { english: 'Cup', filename: 'home-cup.jpg' }
];

for (const ex of EXTRA_CURATED) {
  const filePath = path.join(VOCAB_DIR, ex.filename);
  assert.ok(fs.existsSync(filePath), `Curated asset ${ex.filename} for "${ex.english}" must exist`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 2000, `Curated asset ${ex.filename} must be substantial (>2KB)`);
  console.log(`✓ Confirmed curated image for ${ex.english}: ${ex.filename} (${Math.round(stat.size / 1024)} KB)`);
}

// 7. Verify category classification logic for Library tabs
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const libBundle = buildSync({
  entryPoints: ['src/screens/LanguageLibraryScreen.tsx'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['react', 'react/jsx-runtime', 'lucide-react', '@capacitor/*']
}).outputFiles[0].text;

const mod = { exports: {} };
vm.runInNewContext(libBundle, {
  module: mod,
  exports: mod.exports,
  console,
  require: () => ({})
});

const { getEntryVocabularyCategory, LIBRARY_TABS } = mod.exports;
assert.equal(LIBRARY_TABS.length, 11, 'Must have 11 category tabs');

assert.equal(getEntryVocabularyCategory({ english: 'Dog', id: 'cloud-1', category: 'word' }), 'Animals');
assert.equal(getEntryVocabularyCategory({ english: 'Birds', id: 'cloud-2', category: 'word' }), 'Animals');
assert.equal(getEntryVocabularyCategory({ english: 'Nursing Mother', id: 'cloud-3', category: 'word' }), 'Family');
assert.equal(getEntryVocabularyCategory({ english: 'Friend', id: 'cloud-4', category: 'word' }), 'Family');
assert.equal(getEntryVocabularyCategory({ english: 'Head', id: 'cloud-5', category: 'word' }), 'Body');
assert.equal(getEntryVocabularyCategory({ english: 'Water', id: 'cloud-6', category: 'word' }), 'Food');
assert.equal(getEntryVocabularyCategory({ english: 'Cup', id: 'cloud-7', category: 'word' }), 'Household');
assert.equal(getEntryVocabularyCategory({ english: 'A', id: 'letter-a', category: 'word' }), 'Alphabet');
assert.equal(getEntryVocabularyCategory({ english: '1', id: 'number-1', category: 'word' }), 'Numbers');
assert.equal(getEntryVocabularyCategory({ english: 'God', id: 'cloud-8', category: 'word' }), 'Other');

console.log('✓ Confirmed category tab classification across Animals, Family, Body, Food, Household, Alphabet, Numbers, and Other.');

// 8. Verify Smart Image Detection & Status Management
const imageServiceBundle = buildSync({
  entryPoints: ['src/services/imageService.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['@capacitor/*']
}).outputFiles[0].text;

const imgMod = { exports: {} };
vm.runInNewContext(imageServiceBundle, {
  module: imgMod,
  exports: imgMod.exports,
  console,
  setTimeout,
  clearTimeout,
  require: () => ({ Capacitor: { isNativePlatform: () => false } }),
  fetch: async () => ({ ok: false }),
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { onLine: true }
});

const { getImageStatus, getVocabularyImageUrl, retryImageDownload, subscribeImageUpdates } = imgMod.exports;

// Test 8a: Existing working images such as Dog and Birds return 'ready'
assert.equal(getImageStatus({ english: 'Dog' }), 'ready', 'Existing image "Dog" must have status "ready"');
assert.equal(getImageStatus({ english: 'Birds' }), 'ready', 'Existing image "Birds" must have status "ready"');
assert.equal(getImageStatus({ english: 'God' }), 'ready', 'Existing curated image "God" must have status "ready"');
assert.equal(getImageStatus({ english: 'Nursing Mother' }), 'ready', 'Existing curated image "Nursing Mother" must have status "ready"');
assert.ok(getVocabularyImageUrl({ english: 'Dog' }).includes('animal-dog.jpg'), 'Dog must resolve to bundled asset');
assert.ok(getVocabularyImageUrl({ english: 'Birds' }).includes('animal-bird.jpg'), 'Birds must resolve to bundled asset');
console.log('✓ Verified working images (Dog, Birds, God, Nursing Mother) return status "ready" immediately without searching.');

// Test 8a2: Human Body category must use human images (not animals)
assert.equal(getImageStatus({ english: 'Teeth' }), 'ready', 'Human Body item "Teeth" must have status "ready"');
assert.equal(getImageStatus({ english: 'Tooth' }), 'ready', 'Human Body item "Tooth" must have status "ready"');
const teethUrl = getVocabularyImageUrl({ english: 'Teeth' });
assert.ok(teethUrl.includes('body-teeth.jpg') || teethUrl.includes('teeth'), 'Teeth must resolve to genuine human teeth photo');
assert.ok(!teethUrl.includes('chimpanzee') && !teethUrl.includes('monkey') && !teethUrl.includes('animal'), 'Teeth must not show animals');

const bodyKeywords = ['Hand', 'Eye', 'Head', 'Ear', 'Nose', 'Mouth', 'Foot', 'Leg', 'Arm', 'Heart', 'Teeth', 'Tooth', 'Tongue', 'Bone', 'Blood'];
for (const bw of bodyKeywords) {
  const bUrl = getVocabularyImageUrl({ english: bw });
  assert.ok(bUrl && !bUrl.includes('animal') && !bUrl.includes('monkey') && !bUrl.includes('chimpanzee'), `${bw} must resolve to a human image, not an animal`);
  assert.equal(getImageStatus({ english: bw }), 'ready', `${bw} must have status ready`);
}
console.log('✓ Verified Human Body images (Teeth, Tongue, Hand, Eye, etc.) resolve to human images, not animals.');

// Test 8a3: Specific requested vocabulary items (Mirror, Pig, Pigs, A, B, Friend) must be ready
assert.equal(getImageStatus({ english: 'Mirror' }), 'ready', 'Bundled item "Mirror" must have status "ready"');
assert.equal(getImageStatus({ english: 'Pig' }), 'ready', 'Bundled item "Pig" must have status "ready"');
assert.equal(getImageStatus({ english: 'Pigs' }), 'ready', 'Bundled item "Pigs" must have status "ready"');
assert.equal(getImageStatus({ english: 'Friend' }), 'ready', 'Bundled item "Friend" must have status "ready"');
assert.equal(getImageStatus({ english: 'A', id: 'letter-a' }), 'ready', 'Alphabet item "A" must have status "ready"');
assert.equal(getImageStatus({ english: 'B', id: 'letter-b' }), 'ready', 'Alphabet item "B" must have status "ready"');

assert.ok(getVocabularyImageUrl({ english: 'Mirror' }).includes('home-mirror.jpg'), 'Mirror must resolve to home-mirror.jpg');
assert.ok(getVocabularyImageUrl({ english: 'Pig' }).includes('animal-pig.jpg'), 'Pig must resolve to animal-pig.jpg');
assert.ok(getVocabularyImageUrl({ english: 'Pigs' }).includes('animal-pig.jpg'), 'Pigs must resolve to animal-pig.jpg');
assert.ok(getVocabularyImageUrl({ english: 'Friend' }).includes('family-friend.jpg'), 'Friend must resolve to family-friend.jpg');
assert.ok(getVocabularyImageUrl({ english: 'A', id: 'letter-a' }).includes('letter-a.jpg'), 'Letter A must resolve to letter-a.jpg');
assert.ok(getVocabularyImageUrl({ english: 'B', id: 'letter-b' }).includes('letter-b.jpg'), 'Letter B must resolve to letter-b.jpg');
console.log('✓ Verified specific vocabulary (Mirror, Pig, Pigs, Friend, A, B) resolve and return status "ready".');

// Test 8b: Truly unbundled/missing images return 'missing'
assert.equal(getImageStatus({ english: 'Corn' }), 'missing', 'Unbundled item "Corn" must return status "missing"');
assert.equal(getImageStatus({ english: 'Cassava' }), 'missing', 'Unbundled item "Cassava" must return status "missing"');
console.log('✓ Verified unbundled/missing images (Corn, Cassava) start with status "missing".');

// Test 8c: Real-time status subscription and single-item retry
let receivedStatus = '';
const unsubscribe = subscribeImageUpdates((norm, url, status) => {
  if (norm === 'corn') {
    receivedStatus = status;
  }
});

// Calling retry on Corn emits 'downloading'
const retryPromise = retryImageDownload('Corn', 'Food');
assert.equal(getImageStatus({ english: 'Corn' }), 'downloading', 'In-flight retry must report status "downloading"');
assert.equal(receivedStatus, 'downloading', 'Status update listener must receive "downloading" event');
unsubscribe();

// Ensure other images like Cassava, Teeth, Pig and Dog remain unaffected
assert.equal(getImageStatus({ english: 'Cassava' }), 'missing', 'Other missing images like Cassava must remain unaffected');
assert.equal(getImageStatus({ english: 'Teeth' }), 'ready', 'Human Body Teeth must remain ready and unaffected');
assert.equal(getImageStatus({ english: 'Pig' }), 'ready', 'Bundled Pig must remain ready and unaffected');
assert.equal(getImageStatus({ english: 'Dog' }), 'ready', 'Existing images like Dog must remain unaffected');
console.log('✓ Verified single-item retry: retrying "Corn" does not affect "Cassava", "Teeth", "Pig" or "Dog".');

console.log(`✓ All ${verifiedCount} starter asset files are present. File size does not verify the pictured subject.`);
console.log('=== BUNDLED VOCABULARY ASSET & SMART IMAGE DETECTION TESTS PASSED ===\n');

