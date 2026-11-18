export const MAX_IMAGE_FILE_BYTES = 350 * 1024;
export const MAX_IMAGE_UPLOAD_DATA_URL_LENGTH = 475_000;

export function estimateDataUrlByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1).trim();
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function validateImagePayloadSize(
  dataUrl: string,
  maxBytes: number = MAX_IMAGE_FILE_BYTES,
  maxLength: number = MAX_IMAGE_UPLOAD_DATA_URL_LENGTH
): { valid: boolean; byteSize: number } {
  const byteSize = estimateDataUrlByteSize(dataUrl);
  const valid =
    byteSize > 0 &&
    byteSize < maxBytes &&
    dataUrl.length <= maxLength;
  return { valid, byteSize };
}

export function formatImageByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function compressImageSourceToDataUrl(
  drawSource: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxLength: number = MAX_IMAGE_UPLOAD_DATA_URL_LENGTH,
  maxBytes: number = MAX_IMAGE_FILE_BYTES
): string {
  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const maxDimSteps = [900, 720, 560, 420];
  const qualitySteps = [0.8, 0.65, 0.5, 0.36, 0.25];

  let lastResult = '';
  for (const maxDim of maxDimSteps) {
    const scale = Math.min(1, maxDim / Math.max(safeW, safeH));
    const width = Math.max(1, Math.round(safeW * scale));
    const height = Math.max(1, Math.round(safeH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(drawSource, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      lastResult = candidate;
      const check = validateImagePayloadSize(candidate, maxBytes, maxLength);
      if (check.valid) {
        return candidate;
      }
    }
  }

  const finalCheck = validateImagePayloadSize(lastResult, maxBytes, maxLength);
  if (!finalCheck.valid) {
    throw new Error(
      `Compressed image (${formatImageByteSize(finalCheck.byteSize)}) still exceeds the 350 KB Firestore safety limit.`
    );
  }
  return lastResult;
}

export async function processUploadedPhotoFile(
  file: File,
  maxLength: number = MAX_IMAGE_UPLOAD_DATA_URL_LENGTH,
  maxBytes: number = MAX_IMAGE_FILE_BYTES
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPG, PNG, or WebP image file.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read selected file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read selected photo.'));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Invalid image file.'));
      image.src = rawDataUrl;
    });
    return compressImageSourceToDataUrl(
      img,
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxLength,
      maxBytes
    );
  } catch (err) {
    if (
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(rawDataUrl) &&
      validateImagePayloadSize(rawDataUrl, maxBytes, maxLength).valid
    ) {
      return rawDataUrl;
    }
    throw err instanceof Error
      ? err
      : new Error('Could not process image under 350 KB. Please choose a smaller JPG, PNG, or WebP photo.');
  }
}
