const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const jsQR = require('jsqr');

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

function decodeMatrixWithJsQR(qrData) {
  const moduleSize = 8;
  const margin = moduleSize * 4;
  const width = qrData.size * moduleSize + margin * 2;
  const rgba = new Uint8ClampedArray(width * width * 4);
  rgba.fill(255);

  for (let r = 0; r < qrData.size; r++) {
    for (let c = 0; c < qrData.size; c++) {
      if (qrData.matrix[r][c]) {
        for (let y = 0; y < moduleSize; y++) {
          for (let x = 0; x < moduleSize; x++) {
            const px = margin + c * moduleSize + x;
            const py = margin + r * moduleSize + y;
            const idx = (py * width + px) * 4;
            rgba[idx] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = 255;
          }
        }
      }
    }
  }

  const result = jsQR(rgba, width, width);
  return result ? result.data : null;
}

// Test 1: Community Teachers Root URL QR Code (Edo)
const url1 = 'https://edo.communityteachers.info/';
const qr1 = generateQRCode(url1);
assert.ok(qr1.size >= 21, 'QR Code version must be valid');
assert.equal(qr1.matrix.length, qr1.size, 'Matrix height must match size');
assert.equal(qr1.matrix[0].length, qr1.size, 'Matrix width must match size');
const decoded1 = decodeMatrixWithJsQR(qr1);
assert.equal(decoded1, url1, 'Independent jsQR reader must successfully decode Edo Teachers URL');
const svg1 = getQRCodeSvgPath(qr1);
assert.ok(svg1.viewBoxSize > 0, 'viewBoxSize must be positive');
assert.ok(svg1.path.length > 100, 'SVG path must contain modules');
console.log(`✓ Edo Teachers QR Code verified: Version ${qr1.size}x${qr1.size}, SVG viewBox ${svg1.viewBoxSize}, jsQR: ${decoded1}`);

// Test 2: Community Library Subpath URL QR Code (Edo)
const url2 = 'https://edo.communityteachers.info/library/';
const qr2 = generateQRCode(url2);
assert.ok(qr2.size >= 21, 'QR Code version must be valid');
assert.equal(qr2.matrix.length, qr2.size, 'Matrix height must match size');
assert.equal(qr2.matrix[0].length, qr2.size, 'Matrix width must match size');
const decoded2 = decodeMatrixWithJsQR(qr2);
assert.equal(decoded2, url2, 'Independent jsQR reader must successfully decode Edo Library URL');
const svg2 = getQRCodeSvgPath(qr2);
assert.ok(svg2.viewBoxSize > 0, 'viewBoxSize must be positive');
assert.ok(svg2.path.length > 100, 'SVG path must contain modules');
console.log(`✓ Edo Library QR Code verified: Version ${qr2.size}x${qr2.size}, SVG viewBox ${svg2.viewBoxSize}, jsQR: ${decoded2}`);

// Test 2b: Urhobo URLs QR Codes
const urlUrhoboHome = 'https://urhobo.communityteachers.info/';
const qrUrhoboHome = generateQRCode(urlUrhoboHome);
const decodedUrhoboHome = decodeMatrixWithJsQR(qrUrhoboHome);
assert.equal(decodedUrhoboHome, urlUrhoboHome, 'Independent jsQR reader must successfully decode Urhobo Teachers URL');
console.log(`✓ Urhobo Teachers QR Code verified: Version ${qrUrhoboHome.size}x${qrUrhoboHome.size}, jsQR: ${decodedUrhoboHome}`);

const urlUrhoboLib = 'https://urhobo.communityteachers.info/library/';
const qrUrhoboLib = generateQRCode(urlUrhoboLib);
const decodedUrhoboLib = decodeMatrixWithJsQR(qrUrhoboLib);
assert.equal(decodedUrhoboLib, urlUrhoboLib, 'Independent jsQR reader must successfully decode Urhobo Library URL');
console.log(`✓ Urhobo Library QR Code verified: Version ${qrUrhoboLib.size}x${qrUrhoboLib.size}, jsQR: ${decodedUrhoboLib}`);

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

// Test 4: Verify Welcome Screen & Settings QR Code Integration
const welcomeSource = require('fs').readFileSync('src/screens/WelcomeScreen.tsx', 'utf8');
assert.ok(welcomeSource.includes('Community Teachers'), 'Welcome screen must display Community Teachers brand');
assert.ok(welcomeSource.includes('QRCodeModal'), 'Welcome screen must render QRCodeModal');
assert.ok(welcomeSource.includes('type="library"'), 'Welcome screen must pass type="library" to modal');
assert.ok(welcomeSource.includes('libQrSvg'), 'Welcome screen must render inline Library QR SVG card');
console.log('✓ WelcomeScreen Library QR code card and modal integration verified.');

// Test 4b: Verify Settings Section QR Code Integration in App.tsx
const appSource = require('fs').readFileSync('src/App.tsx', 'utf8');
assert.ok(appSource.includes('Community Teachers QR Code'), 'Settings section must display Community Teachers QR Code');
assert.ok(appSource.includes('showTeachersQrModal'), 'App must manage state for Settings Teachers QR modal');
assert.ok(appSource.includes('type="teachers"'), 'App Settings must render QRCodeModal with type="teachers"');
console.log('✓ App Settings Community Teachers QR Code button & modal integration verified.');

// Test 5: Verify Community Library Integration
const librarySource = require('fs').readFileSync('src/screens/LanguageLibraryScreen.tsx', 'utf8');
assert.ok(librarySource.includes('rightAction={readOnly ? \'qr\' : \'close\'}'), 'Library must set rightAction to qr in readOnly mode');
assert.ok(librarySource.includes('type="library"'), 'Library must pass type="library" to QRCodeModal');
assert.ok(librarySource.includes('libraryUrl') || librarySource.includes('https://edo.communityteachers.info/library/'), 'Library modal must target library URL');
console.log('✓ Community Library QR icon and modal integration verified.');

console.log('\n=== ALL QR CODE & COMMUNITY BRANDING TESTS PASSED! ===');

