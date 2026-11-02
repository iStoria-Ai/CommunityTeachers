const assert = require('node:assert/strict');
const esbuild = require('esbuild');

console.log('=== Running QR Code & Community Branding Tests ===\n');

// 1. Bundle and test QR Code generator utility
const qrBundle = esbuild.buildSync({
  entryPoints: ['src/utils/qrCode.ts'],
  bundle: true,
  write: false,
  format: 'cjs'
}).outputFiles[0].text;

const qrMod = { exports: {} };
new Function('module', 'exports', qrBundle)(qrMod, qrMod.exports);
const { generateQRCode, getQRCodeSvgPath } = qrMod.exports;

// Test 1: Community Teachers Root URL QR Code
const url1 = 'https://edo.communityteachers.info/';
const qr1 = generateQRCode(url1);
assert.ok(qr1.size >= 21, 'QR Code version must be valid');
assert.equal(qr1.matrix.length, qr1.size, 'Matrix height must match size');
assert.equal(qr1.matrix[0].length, qr1.size, 'Matrix width must match size');
const svg1 = getQRCodeSvgPath(qr1);
assert.ok(svg1.viewBoxSize > 0, 'viewBoxSize must be positive');
assert.ok(svg1.path.length > 100, 'SVG path must contain modules');
console.log(`✓ Community Teachers QR Code verified: Version ${qr1.size}x${qr1.size}, SVG viewBox ${svg1.viewBoxSize}`);

// Test 2: Community Library Subpath URL QR Code
const url2 = 'https://edo.communityteachers.info/library/';
const qr2 = generateQRCode(url2);
assert.ok(qr2.size >= 21, 'QR Code version must be valid');
assert.equal(qr2.matrix.length, qr2.size, 'Matrix height must match size');
assert.equal(qr2.matrix[0].length, qr2.size, 'Matrix width must match size');
const svg2 = getQRCodeSvgPath(qr2);
assert.ok(svg2.viewBoxSize > 0, 'viewBoxSize must be positive');
assert.ok(svg2.path.length > 100, 'SVG path must contain modules');
console.log(`✓ Community Library QR Code verified: Version ${qr2.size}x${qr2.size}, SVG viewBox ${svg2.viewBoxSize}`);

// Test 3: Verify Modal Component Props and Destination Endpoints
const modalSource = require('fs').readFileSync('src/components/QRCodeModal.tsx', 'utf8');
assert.ok(modalSource.includes('https://edo.communityteachers.info/'), 'Must reference production root URL');
assert.ok(modalSource.includes('https://edo.communityteachers.info/library/'), 'Must reference production library URL');
assert.ok(modalSource.includes('Build to create a better tomorrow.'), 'Must include Teachers brand message');
assert.ok(modalSource.includes('Learn not to forget your culture.'), 'Must include Library brand message');
assert.ok(modalSource.includes('Scan to open on your phone or tablet'), 'Must include scanner subtitle');
assert.ok(modalSource.includes('Install on iPhone / iPad'), 'Must include iOS guidance card');
assert.ok(modalSource.includes('Install on Android'), 'Must include Android guidance card');
assert.ok(modalSource.includes('Open in Browser'), 'Must include Browser guidance card');
console.log('✓ QRCodeModal component branding, messages, and platform guidance verified.');

// Test 4: Verify Welcome Screen Integration
const welcomeSource = require('fs').readFileSync('src/screens/WelcomeScreen.tsx', 'utf8');
assert.ok(welcomeSource.includes('Community Teachers'), 'Welcome screen must display Community Teachers brand');
assert.ok(welcomeSource.includes('QRCodeModal'), 'Welcome screen must render QRCodeModal');
assert.ok(welcomeSource.includes('type="teachers"'), 'Welcome screen must pass type="teachers" to modal');
assert.ok(welcomeSource.includes('QrCode'), 'Welcome screen must render top-right QR trigger');
console.log('✓ WelcomeScreen QR icon and Community Teachers branding verified.');

// Test 5: Verify Community Library Integration
const librarySource = require('fs').readFileSync('src/screens/LanguageLibraryScreen.tsx', 'utf8');
assert.ok(librarySource.includes('rightAction={readOnly ? \'qr\' : \'close\'}'), 'Library must set rightAction to qr in readOnly mode');
assert.ok(librarySource.includes('type="library"'), 'Library must pass type="library" to QRCodeModal');
assert.ok(librarySource.includes('libraryUrl') || librarySource.includes('https://edo.communityteachers.info/library/'), 'Library modal must target library URL');
console.log('✓ Community Library QR icon and modal integration verified.');

console.log('\n=== ALL QR CODE & COMMUNITY BRANDING TESTS PASSED! ===');

