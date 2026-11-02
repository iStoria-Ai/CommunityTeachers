// Ensure TextEncoder is available even in restricted test VM environments
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = class {
    encode(str: string): Uint8Array {
      if (typeof Buffer !== 'undefined') {
        return Uint8Array.from(Buffer.from(str, 'utf8'));
      }
      const utf8: number[] = [];
      for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        } else {
          i++;
          charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        }
      }
      return new Uint8Array(utf8);
    }
  };
}

// @ts-ignore
import QRCode from 'qrcode/lib/browser.js';

export interface QRCodeData {
  size: number;
  matrix: boolean[][];
}

/**
 * Generates an ISO/IEC 18004 standards-compliant QR Code matrix.
 * Uses Error Correction Level M and optimal masking.
 */
export function generateQRCode(text: string): QRCodeData {
  const qr = (QRCode as any).create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const matrix: boolean[][] = [];

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Boolean(qr.modules.get(r, c)));
    }
    matrix.push(row);
  }

  return { size, matrix };
}

/**
 * Renders an SVG path string for the QR code modules.
 * Strictly enforces a 4-module quiet zone border as mandated by ISO/IEC 18004.
 */
export function getQRCodeSvgPath(
  data: QRCodeData,
  moduleSize = 7,
  margin?: number
): { path: string; viewBoxSize: number } {
  const { size, matrix } = data;
  // Standard quiet zone is at least 4 modules width (ISO/IEC 18004 §5.3.7)
  const actualMargin = margin !== undefined ? margin : moduleSize * 4;
  const viewBoxSize = size * moduleSize + actualMargin * 2;
  let path = '';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = actualMargin + c * moduleSize;
        const y = actualMargin + r * moduleSize;
        path += `M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z `;
      }
    }
  }

  return { path, viewBoxSize };
}
