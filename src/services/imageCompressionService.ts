/**
 * Browser-Based Image Resizing & Compression Service
 *
 * Automatically checks selected image files before uploading to Google Drive:
 * - If an image is <= 1.5 MB and already in a backend-supported format (JPEG, PNG, WebP),
 *   it is kept as-is without unnecessary recompression.
 * - If an image is > 1.5 MB (or in iPhone HEIC/HEIF format), it is automatically resized
 *   and compressed in the browser while preserving the original aspect ratio (no cropping
 *   or distortion) and keeping visual quality as high as possible.
 * - Progressively reduces quality and dimensions until the binary size is strictly below
 *   1.5 MB and the base64 payload fits comfortably within the 2 MB Google Apps Script limit.
 */

export const TARGET_MAX_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024); // 1,572,864 bytes (1.5 MB)
export const BACKEND_MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2,097,152 bytes (2.0 MB)
// Leave headroom so binary size is < 1.5 MB AND base64 string + JSON wrapper is < 2.0 MB
export const SAFE_COMPRESSED_MAX_BYTES = TARGET_MAX_IMAGE_BYTES - 8192; // 1,564,672 bytes

const DIRECT_BACKEND_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Progressive longest-side dimension caps (in pixels), from highest resolution downward
export const DIMENSION_STEPS = [2400, 2048, 1600, 1280, 1024, 800, 640, 480];

// Progressive JPEG quality levels tried at each dimension step, from highest quality downward
export const QUALITY_STEPS = [0.92, 0.86, 0.8, 0.74, 0.66, 0.58, 0.5];

export interface PreparedImageResult {
  dataUrl: string;
  mimeType: string;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasCompressed: boolean;
  qualityUsed?: number;
}

export interface DecodedImageSource {
  width: number;
  height: number;
  drawToCanvas: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup?: () => void;
}

export interface ImageCompressionRuntime {
  readFileAsDataUrl?: (file: Blob) => Promise<string>;
  decodeImage?: (file: Blob, fileName?: string) => Promise<DecodedImageSource>;
  encodeCanvas?: (
    source: DecodedImageSource,
    width: number,
    height: number,
    mimeType: string,
    quality: number
  ) => Promise<string>;
}

/**
 * Checks whether a selected File/Blob is a supported image candidate
 * (JPG, PNG, WebP, iPhone HEIC/HEIF, or standard raster image).
 */
export function isSupportedImageFile(file: { type?: string; name?: string } | null | undefined): boolean {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase().trim();
  const name = String(file.name || '').toLowerCase().trim();

  if (mime === 'image/svg+xml' || name.endsWith('.svg')) {
    return false;
  }

  if (mime.startsWith('image/')) {
    return true;
  }

  return /\.(jpe?g|png|webp|heic|heif|bmp|gif|avif)$/i.test(name);
}

/**
 * Checks whether a file is an iPhone HEIC/HEIF image by MIME type or filename extension.
 */
export function isHeicImageFile(file: { type?: string; name?: string } | null | undefined): boolean {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase().trim();
  const name = String(file.name || '').toLowerCase().trim();
  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence' ||
    /\.(heic|heif)$/i.test(name)
  );
}

/**
 * Computes the exact decoded binary byte size of a base64 data URL.
 */
export function getDataUrlByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1).trim() : dataUrl.trim();
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Detects whether a base64 data URL begins with valid JPEG, PNG, or WebP magic bytes
 * accepted by the Google Apps Script gateway.
 */
export function detectDataUrlBackendMime(dataUrl: string): 'image/jpeg' | 'image/png' | 'image/webp' | '' {
  try {
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1).trim() : dataUrl.trim();
    if (base64.length < 16) return '';
    // Decode only the first 24 base64 chars (18 bytes) to inspect magic header
    const headB64 = base64.slice(0, 24);
    let bytes: number[] = [];
    if (typeof atob === 'function') {
      const bin = atob(headB64);
      for (let i = 0; i < bin.length; i++) {
        bytes.push(bin.charCodeAt(i) & 0xff);
      }
    } else if (typeof Buffer !== 'undefined') {
      bytes = Array.from(Buffer.from(headB64, 'base64'));
    }
    if (bytes.length < 12) return '';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    return '';
  } catch (_) {
    return '';
  }
}

/**
 * Calculates scaled dimensions that fit within `maxDimension` on the longest side
 * while strictly preserving the original aspect ratio without cropping or distortion.
 */
export function calculateScaledDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(originalWidth));
  const safeH = Math.max(1, Math.round(originalHeight));
  const longestSide = Math.max(safeW, safeH);

  if (longestSide <= maxDimension) {
    return { width: safeW, height: safeH };
  }

  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale))
  };
}

function defaultReadFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader is not available in this environment.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length > 0) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

async function defaultDecodeImage(file: Blob): Promise<DecodedImageSource> {
  // Strategy 1: HTMLImageElement with Object URL (Best support on iPhone Safari including HEIC & EXIF orientation)
  if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image element failed to decode.'));
        el.src = objectUrl;
      });
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width > 0 && height > 0) {
        return {
          width,
          height,
          drawToCanvas: (ctx, w, h) => {
            ctx.drawImage(img, 0, 0, w, h);
          },
          cleanup: () => {
            try {
              URL.revokeObjectURL(objectUrl);
            } catch (_) {}
          }
        };
      }
      URL.revokeObjectURL(objectUrl);
    } catch (_) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    }
  }

  // Strategy 2: createImageBitmap fallback
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width > 0 && bitmap.height > 0) {
      return {
        width: bitmap.width,
        height: bitmap.height,
        drawToCanvas: (ctx, w, h) => {
          ctx.drawImage(bitmap, 0, 0, w, h);
        },
        cleanup: () => {
          try {
            if (typeof bitmap.close === 'function') bitmap.close();
          } catch (_) {}
        }
      };
    }
  }

  throw new Error('IMAGE_DECODE_FAILED');
}

async function defaultEncodeCanvas(
  source: DecodedImageSource,
  width: number,
  height: number,
  mimeType: string,
  quality: number
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is not available in this environment.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to initialize 2D image canvas context.');
    }

    // Fill with clean white background before drawing so transparent PNG/WebP edges never turn black in JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = 'high';
    }

    source.drawToCanvas(ctx, width, height);

    // Use Blob when available to avoid synchronous large string allocations, then convert to DataURL
    if (typeof canvas.toBlob === 'function') {
      const blob = await new Promise<Blob | null>((resolve) => {
        try {
          canvas.toBlob((b) => resolve(b), mimeType, quality);
        } catch (_) {
          resolve(null);
        }
      });
      if (blob && blob.size > 0) {
        return await defaultReadFileAsDataUrl(blob);
      }
    }

    return canvas.toDataURL(mimeType, quality);
  } finally {
    // Immediately release iOS Safari canvas backing store memory
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Checks a selected image file and, if larger than 1.5 MB (or in HEIC/non-direct format),
 * progressively resizes and compresses it until it fits below 1.5 MB while keeping
 * visual quality as high as possible and preserving the exact aspect ratio.
 */
export async function prepareImageForUpload(
  file: Blob & { name?: string; type?: string },
  runtime?: ImageCompressionRuntime
): Promise<PreparedImageResult> {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    throw new Error('The selected image file is empty. Please choose a valid image.');
  }

  if (!isSupportedImageFile(file)) {
    throw new Error('Please select a valid JPG, PNG, WebP or iPhone HEIC image.');
  }

  const readAsDataUrl = runtime?.readFileAsDataUrl || defaultReadFileAsDataUrl;
  const decodeImage = runtime?.decodeImage || defaultDecodeImage;
  const encodeCanvas = runtime?.encodeCanvas || defaultEncodeCanvas;

  const normalizedMime = String(file.type || '').toLowerCase().trim();
  const isHeic = isHeicImageFile(file);
  const isDirectFormat = DIRECT_BACKEND_MIMES.has(normalizedMime) && !isHeic;

  // 1. Fast path: If the image is already <= 1.5 MB and a supported format (JPG/PNG/WebP),
  // verify its magic bytes and return it untouched at 100% original quality.
  if (file.size <= TARGET_MAX_IMAGE_BYTES && isDirectFormat) {
    const rawDataUrl = await readAsDataUrl(file);
    const detectedMime = detectDataUrlBackendMime(rawDataUrl);
    const decodedBytes = getDataUrlByteSize(rawDataUrl);
    if (detectedMime && decodedBytes > 0 && decodedBytes <= TARGET_MAX_IMAGE_BYTES) {
      return {
        dataUrl: rawDataUrl,
        mimeType: detectedMime,
        originalBytes: file.size,
        finalBytes: decodedBytes,
        width: 0,
        height: 0,
        originalWidth: 0,
        originalHeight: 0,
        wasCompressed: false
      };
    }
  }

  // 2. Decode image in browser to resize and/or compress below 1.5 MB
  let source: DecodedImageSource;
  try {
    source = await decodeImage(file, file.name);
  } catch (_) {
    if (isHeic) {
      throw new Error(
        'This browser could not process the HEIC image. Please open in iPhone Safari or select a JPG, PNG or WebP image.'
      );
    }
    throw new Error('Unable to process this image. Please select a valid JPG, PNG or WebP image.');
  }

  try {
    const origW = Math.max(1, Math.round(source.width));
    const origH = Math.max(1, Math.round(source.height));
    const origLongest = Math.max(origW, origH);

    // Build progressive dimension caps starting at the image's natural size (if <= 2400)
    // so we preserve maximum detail before stepping dimensions down if needed.
    const dimensionCandidates: number[] = [];
    if (origLongest <= DIMENSION_STEPS[0]) {
      dimensionCandidates.push(origLongest);
    }
    for (const step of DIMENSION_STEPS) {
      if (step < origLongest || dimensionCandidates.length === 0) {
        if (!dimensionCandidates.includes(step)) {
          dimensionCandidates.push(step);
        }
      }
    }

    for (const maxDim of dimensionCandidates) {
      const { width, height } = calculateScaledDimensions(origW, origH, maxDim);

      for (const quality of QUALITY_STEPS) {
        const candidateDataUrl = await encodeCanvas(source, width, height, 'image/jpeg', quality);
        const candidateBytes = getDataUrlByteSize(candidateDataUrl);
        const detectedMime = detectDataUrlBackendMime(candidateDataUrl);

        if (
          detectedMime &&
          candidateBytes > 0 &&
          candidateBytes <= SAFE_COMPRESSED_MAX_BYTES &&
          candidateDataUrl.length < BACKEND_MAX_IMAGE_BYTES
        ) {
          return {
            dataUrl: candidateDataUrl,
            mimeType: detectedMime,
            originalBytes: file.size,
            finalBytes: candidateBytes,
            width,
            height,
            originalWidth: origW,
            originalHeight: origH,
            wasCompressed: true,
            qualityUsed: quality
          };
        }
      }
    }

    throw new Error(
      'Unable to reduce this image below the 1.5 MB limit. Please choose a smaller or simpler image.'
    );
  } finally {
    if (source.cleanup) {
      try {
        source.cleanup();
      } catch (_) {}
    }
  }
}
