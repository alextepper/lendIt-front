const DEFAULTS = {
  maxSizeBytes: 10 * 1024 * 1024,
  maxDimension: 1920,
  initialQuality: 0.82,
  minQuality: 0.5,
  qualityStep: 0.08,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getTargetType(inputType) {
  // Keep GIF as-is (canvas would drop animation).
  if (inputType === 'image/gif') return null;
  // Prefer WebP for PNG (supports transparency + good compression).
  if (inputType === 'image/png') return 'image/webp';
  // Default to JPEG for everything else.
  return 'image/jpeg';
}

async function fileToImageBitmap(file) {
  // createImageBitmap is fast and widely supported in modern browsers.
  return await createImageBitmap(file);
}

function drawResizedToCanvas(bitmap, maxDimension) {
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to compress image'));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

/**
 * Compress an image client-side before upload.
 * - Resizes to `maxDimension` (keeps aspect ratio)
 * - Encodes to WebP/JPEG (GIF is returned as-is)
 * - Tries lowering quality until <= maxSizeBytes (best effort)
 */
export async function compressImageBeforeUpload(file, opts = {}) {
  const {
    maxSizeBytes,
    maxDimension,
    initialQuality,
    minQuality,
    qualityStep,
  } = { ...DEFAULTS, ...opts };

  const targetType = getTargetType(file.type);
  if (!targetType) return { file, didCompress: false };

  let bitmap;
  try {
    bitmap = await fileToImageBitmap(file);
  } catch {
    // If decoding fails, fall back to original (server-side will validate).
    return { file, didCompress: false };
  }

  const canvas = drawResizedToCanvas(bitmap, maxDimension);
  bitmap.close?.();

  let quality = clamp(initialQuality, minQuality, 0.95);
  let blob = await canvasToBlob(canvas, targetType, quality);

  while (blob.size > maxSizeBytes && quality > minQuality) {
    quality = clamp(quality - qualityStep, minQuality, 0.95);
    blob = await canvasToBlob(canvas, targetType, quality);
  }

  // If compression didn't help enough, keep original so the UI can show "too large".
  if (blob.size > maxSizeBytes) return { file, didCompress: false };

  const ext = targetType === 'image/webp' ? 'webp' : 'jpg';
  const name = (file.name || 'image')
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .concat(`.${ext}`);

  const outFile = new File([blob], name, { type: targetType, lastModified: Date.now() });
  return { file: outFile, didCompress: true };
}

