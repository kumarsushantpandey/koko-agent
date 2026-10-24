/**
 * Image Utilities for Client-Side Processing
 * -------------------------------------------
 * Provides zero-dependency, ultra-fast image compression and validation
 * using native HTMLCanvasElement. Scales down large photos to max 1280x1280
 * and encodes to optimized JPEG data URI to ensure instant transmission over
 * WebSockets without network lag or OOM issues.
 */

export interface ProcessedImage {
  dataUri: string;
  width: number;
  height: number;
  fileName?: string;
  sizeBytes: number;
}

const MAX_DIMENSION = 1280;
const COMPRESSION_QUALITY = 0.85;

/**
 * Validates and compresses an image File/Blob to an optimized base64 Data URI.
 */
export async function processImageFile(file: File | Blob, fileName?: string): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not a supported image format.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Failed to read image file."));

    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== "string") {
        return reject(new Error("Invalid file reader output."));
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image data."));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate proportional scale
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Unable to create canvas 2D rendering context."));
        }

        // Draw image onto canvas with bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to optimized JPEG format
        const outputMime = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUri = canvas.toDataURL(outputMime, COMPRESSION_QUALITY);
        const approxBytes = Math.round((dataUri.length * 3) / 4);

        resolve({
          dataUri,
          width,
          height,
          fileName: fileName || (file instanceof File ? file.name : "image.jpg"),
          sizeBytes: approxBytes,
        });
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
  });
}
